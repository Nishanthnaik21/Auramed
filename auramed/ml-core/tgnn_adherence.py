"""Temporal Graph Neural Network (TGNN) for Latent Adherence Classification.

Processes the patient's medication-condition graph (nodes: medications, conditions;
edges: interactions, co-prescriptions) combined with longitudinal adherence telemetry
to output calibrated latent class probabilities: [Concordant, Intermittent, Abandoned].
"""

from __future__ import annotations

from typing import List, Optional, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F

ADHERENCE_CLASSES = ["Concordant", "Intermittent", "Abandoned"]


class GraphAttentionLayer(nn.Module):
    """Multi-Head Graph Attention Network (GAT) layer with edge features."""

    def __init__(self, in_features: int, out_features: int, edge_dim: int = 4, heads: int = 2, dropout: float = 0.1):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.heads = heads
        self.dropout = nn.Dropout(dropout)

        self.lin_node = nn.Linear(in_features, heads * out_features, bias=False)
        self.lin_edge = nn.Linear(edge_dim, heads * out_features, bias=False)

        # Attention coefficients: a_src, a_dst, a_edge
        self.att_src = nn.Parameter(torch.zeros(1, heads, out_features))
        self.att_dst = nn.Parameter(torch.zeros(1, heads, out_features))
        self.att_edge = nn.Parameter(torch.zeros(1, heads, out_features))

        nn.init.xavier_uniform_(self.lin_node.weight)
        nn.init.xavier_uniform_(self.lin_edge.weight)
        nn.init.xavier_uniform_(self.att_src)
        nn.init.xavier_uniform_(self.att_dst)
        nn.init.xavier_uniform_(self.att_edge)

        self.leaky_relu = nn.LeakyReLU(0.2)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor, edge_attr: Optional[torch.Tensor] = None) -> torch.Tensor:
        num_nodes = x.size(0)
        h = self.lin_node(x).view(num_nodes, self.heads, self.out_features)

        src, dst = edge_index[0], edge_index[1]
        alpha_src = (h[src] * self.att_src).sum(dim=-1)
        alpha_dst = (h[dst] * self.att_dst).sum(dim=-1)
        alpha = alpha_src + alpha_dst

        if edge_attr is not None:
            edge_proj = self.lin_edge(edge_attr).view(-1, self.heads, self.out_features)
            alpha_edge = (edge_proj * self.att_edge).sum(dim=-1)
            alpha = alpha + alpha_edge

        alpha = self.leaky_relu(alpha)
        # Softmax normalization over incoming edges for each destination node
        # Numerically stable edge softmax
        alpha_exp = torch.exp(alpha - alpha.max(dim=0, keepdim=True)[0])
        alpha_sum = torch.zeros(num_nodes, self.heads, device=x.device).scatter_add_(
            0, dst.unsqueeze(-1).expand(-1, self.heads), alpha_exp
        )
        alpha_norm = alpha_exp / (alpha_sum[dst] + 1e-12)
        alpha_norm = self.dropout(alpha_norm)

        # Message passing aggregation
        out = torch.zeros(num_nodes, self.heads, self.out_features, device=x.device)
        msg = h[src] * alpha_norm.unsqueeze(-1)
        out = out.scatter_add(0, dst.view(-1, 1, 1).expand(-1, self.heads, self.out_features), msg)

        return out.view(num_nodes, self.heads * self.out_features)


class TemporalGraphAdherenceModel(nn.Module):
    """End-to-end Temporal Graph Neural Network for Latent Adherence Estimation."""

    def __init__(
        self,
        node_in_dim: int = 16,
        edge_dim: int = 4,
        graph_hidden_dim: int = 32,
        telemetry_in_dim: int = 8,
        temporal_hidden_dim: int = 64,
        num_classes: int = 3,
        num_gru_layers: int = 2,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.num_classes = num_classes

        # 1. Structural Graph Representation (Medications + Conditions + Pathways)
        self.gat1 = GraphAttentionLayer(node_in_dim, graph_hidden_dim, edge_dim=edge_dim, heads=2, dropout=dropout)
        self.bn1 = nn.BatchNorm1d(graph_hidden_dim * 2)
        self.gat2 = GraphAttentionLayer(graph_hidden_dim * 2, graph_hidden_dim, edge_dim=edge_dim, heads=1, dropout=dropout)

        # Graph global pooling projection
        self.graph_pooling_fc = nn.Sequential(
            nn.Linear(graph_hidden_dim, graph_hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
        )

        # 2. Temporal Sequential Encoder (Sliding Window Telemetry + UKF Mahalanobis divergence)
        self.temporal_gru = nn.GRU(
            input_size=telemetry_in_dim,
            hidden_size=temporal_hidden_dim,
            num_layers=num_gru_layers,
            batch_first=True,
            dropout=dropout if num_gru_layers > 1 else 0.0,
        )

        # 3. Fusion & Multi-Class Classification Head
        combined_dim = graph_hidden_dim + temporal_hidden_dim
        self.classifier = nn.Sequential(
            nn.Linear(combined_dim, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, num_classes),
        )

    def encode_graph(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: Optional[torch.Tensor] = None,
        batch_node_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """Encodes patient medication graph into a fixed-size structural vector."""
        h = F.elu(self.gat1(x, edge_index, edge_attr))
        h = self.bn1(h)
        h = self.gat2(h, edge_index, edge_attr)

        if batch_node_mask is not None:
            # Masked global mean pooling for batched graphs
            mask = batch_node_mask.unsqueeze(-1).float()
            pooled = (h * mask).sum(dim=0) / (mask.sum(dim=0) + 1e-9)
        else:
            pooled = h.mean(dim=0, keepdim=True)

        return self.graph_pooling_fc(pooled)

    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: Optional[torch.Tensor],
        telemetry_seq: torch.Tensor,
        batch_node_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """Forward pass generating softmax probability distribution over adherence classes.

        :param x: Node feature tensor [num_nodes, node_in_dim]
        :param edge_index: Graph connectivity [2, num_edges]
        :param edge_attr: Edge attributes [num_edges, edge_dim]
        :param telemetry_seq: Sequential telemetry [batch_size, seq_len, telemetry_in_dim]
        :param batch_node_mask: Optional mask for node pooling
        :return: Softmax probability tensor [batch_size, 3] -> [Concordant, Intermittent, Abandoned]
        """
        # Graph structural embedding [1, graph_hidden_dim]
        graph_embed = self.encode_graph(x, edge_index, edge_attr, batch_node_mask)

        # Expand graph embedding to batch size if needed
        batch_size = telemetry_seq.size(0)
        if graph_embed.size(0) == 1 and batch_size > 1:
            graph_embed = graph_embed.expand(batch_size, -1)

        # Temporal sequence encoding
        _, h_n = self.temporal_gru(telemetry_seq)
        temporal_embed = h_n[-1]  # [batch_size, temporal_hidden_dim]

        # Fusion
        fused = torch.cat([graph_embed, temporal_embed], dim=-1)

        # Logits and Softmax
        logits = self.classifier(fused)
        probabilities = F.softmax(logits, dim=-1)

        return probabilities
