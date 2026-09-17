# ==============================================================================
# AWS EKS Kubernetes Cluster (Version 1.30+)
# ==============================================================================

variable "kubernetes_version" {
  type    = string
  default = "1.30"
}

# ------------------------------------------------------------------------------
# EKS Cluster IAM Role
# ------------------------------------------------------------------------------

resource "aws_iam_role" "eks_cluster_role" {
  name = "auramed-${var.environment}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster_role.name
}

resource "aws_iam_role_policy_attachment" "eks_vpc_resource_controller" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
  role       = aws_iam_role.eks_cluster_role.name
}

# ------------------------------------------------------------------------------
# EKS Cluster
# ------------------------------------------------------------------------------

resource "aws_eks_cluster" "auramed_eks" {
  name     = "auramed-${var.environment}"
  version  = var.kubernetes_version
  role_arn = aws_iam_role.eks_cluster_role.arn

  vpc_config {
    subnet_ids              = concat(aws_subnet.public.*.id, aws_subnet.private_app.*.id)
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = ["0.0.0.0/0"] # In high-security production, restrict to VPN CIDRs
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  encryption_config {
    provider {
      key_arn = aws_kms_key.auramed_cmek.arn
    }
    resources = ["secrets"]
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_vpc_resource_controller
  ]

  tags = {
    Name        = "auramed-${var.environment}-cluster"
    Environment = var.environment
  }
}

# ------------------------------------------------------------------------------
# Managed Node Group IAM Role
# ------------------------------------------------------------------------------

resource "aws_iam_role" "eks_node_role" {
  name = "auramed-${var.environment}-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_role.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_role.name
}

resource "aws_iam_role_policy_attachment" "eks_registry_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_role.name
}

# ------------------------------------------------------------------------------
# Launch Template with IMDSv2 & Encrypted Volumes
# ------------------------------------------------------------------------------

resource "aws_launch_template" "eks_node_template" {
  name_prefix   = "auramed-eks-node-"
  image_id      = "" # Auto-resolved by EKS managed node group
  instance_type = "m6i.xlarge"

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 Hardened
    http_put_response_hop_limit = 1
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 100
      volume_type           = "gp3"
      encrypted             = true
      kms_key_id            = aws_kms_key.auramed_cmek.arn
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name                                        = "auramed-worker-node"
      "kubernetes.io/cluster/auramed-production" = "owned"
    }
  }
}

# ------------------------------------------------------------------------------
# EKS Managed Node Group (Private Application Subnets)
# ------------------------------------------------------------------------------

resource "aws_eks_node_group" "auramed_nodes" {
  cluster_name    = aws_eks_cluster.auramed_eks.name
  node_group_name = "auramed-general-workers"
  node_role_arn   = aws_iam_role.eks_node_role.arn
  subnet_ids      = aws_subnet.private_app.*.id

  scaling_config {
    desired_size = 6
    max_size     = 20
    min_size     = 3
  }

  update_config {
    max_unavailable = 1
  }

  launch_template {
    id      = aws_launch_template.eks_node_template.id
    version = "$Latest"
  }

  labels = {
    role = "application"
    tier = "private"
  }

  tags = {
    Environment = var.environment
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_registry_policy,
  ]
}
