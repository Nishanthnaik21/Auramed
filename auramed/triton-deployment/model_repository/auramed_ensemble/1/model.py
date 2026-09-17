"""Triton Inference Server Python Backend Driver for AuraMed Ensemble Pipeline.

Ensemble integration:
1. PK/PD Continuous-Discrete Unscented Kalman Filter
2. Temporal Graph Neural Network (TGNN)
3. Inductive Split-Conformal Uncertainty Gate
"""

from __future__ import annotations

import json
import os
import sys
from typing import List

import numpy as np
import torch

# Ensure sibling ml-core directory is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
ml_core_dir = os.path.abspath(os.path.join(current_dir, "../../../../ml-core"))
if ml_core_dir not in sys.path:
    sys.path.insert(0, ml_core_dir)

from pkpd_ukf import ContinuousDiscretePKPDUKF, DoseEvent, LabMeasurement, PKPDParameters
from tgnn_adherence import TemporalGraphAdherenceModel, ADHERENCE_CLASSES
from conformal_gate import SplitConformalCalibrator

# Mock or import Triton pb_utils
try:
    import triton_python_backend_utils as pb_utils
except ImportError:
    # Standalone test stub
    class pb_utils:
        class InferenceResponse:
            def __init__(self, output_tensors):
                self.output_tensors = output_tensors
        class Tensor:
            def __init__(self, name, nparray):
                self.name = name
                self.nparray = nparray
            def as_numpy(self):
                return self.nparray
        @staticmethod
        def get_input_tensor_by_name(request, name):
            return request.get(name)


class TritonPythonModel:
    """Triton Model implementation integrating PK/PD UKF, TGNN, and Conformal Prediction."""

    def initialize(self, args):
        """Initializes model state, neural network weights, and conformal calibrator."""
        self.model_config = json.loads(args["model_config"])

        # 1. Initialize TGNN
        self.device = torch.device("cpu")
        self.tgnn = TemporalGraphAdherenceModel(
            node_in_dim=16,
            edge_dim=4,
            graph_hidden_dim=32,
            telemetry_in_dim=8,
            temporal_hidden_dim=64,
            num_classes=3,
        ).to(self.device)
        self.tgnn.eval()

        # 2. Initialize PK/PD Parameters
        self.pkpd_params = PKPDParameters(
            ka=0.50,
            bioavailability=0.30,
            clearance=3.5,
            v_d=60.0,
            e0=145.0,
            emax=25.0,
            ec50=0.08,
            gamma=1.2,
        )

        # 3. Initialize & Calibrate Conformal Evaluator (90% coverage guarantee)
        self.calibrator = SplitConformalCalibrator(alpha=0.10, entropy_threshold=0.10)

        # Synthetic calibration population for initialization
        np.random.seed(42)
        n_calib = 200
        synth_probs = np.random.dirichlet(np.array([5.0, 1.0, 1.0]), size=n_calib)
        synth_labels = np.random.choice([0, 1, 2], size=n_calib, p=[0.7, 0.2, 0.1])
        self.calibrator.calibrate(synth_probs, synth_labels)

    def execute(self, requests):
        """Executes inference for a dynamic batch of requests."""
        responses = []

        for request in requests:
            # 1. Extract inputs
            doses_tensor = pb_utils.get_input_tensor_by_name(request, "PATIENT_DOSES").as_numpy()
            labs_tensor = pb_utils.get_input_tensor_by_name(request, "LAB_MEASUREMENTS").as_numpy()
            nodes_tensor = pb_utils.get_input_tensor_by_name(request, "GRAPH_NODES").as_numpy()
            edges_tensor = pb_utils.get_input_tensor_by_name(request, "GRAPH_EDGES").as_numpy()
            telemetry_tensor = pb_utils.get_input_tensor_by_name(request, "TELEMETRY_FEATURES").as_numpy()

            # 2. Run PK/PD UKF
            ukf = ContinuousDiscretePKPDUKF(params=self.pkpd_params)
            dose_events = [DoseEvent(time_hours=float(row[0]), dose_mg=float(row[1])) for row in doses_tensor]
            lab_events = [LabMeasurement(time_hours=float(row[0]), measured_value=float(row[1])) for row in labs_tensor]

            t_max = max(
                [d.time_hours for d in dose_events] + [l.time_hours for l in lab_events] + [24.0]
            )
            step_results = ukf.run_trajectory(dose_events, lab_events, t_end_hours=t_max)

            # Get latest Mahalanobis residual divergence
            divergence_val = 0.0
            pred_biomarker_val = step_results[-1].counterfactual_biomarker
            for step in reversed(step_results):
                if step.mahalanobis_divergence is not None:
                    divergence_val = float(step.mahalanobis_divergence)
                    pred_biomarker_val = float(step.counterfactual_biomarker)
                    break

            # 3. Run TGNN Adherence Prediction
            with torch.no_grad():
                x_torch = torch.from_numpy(nodes_tensor).float().to(self.device)
                edge_index_torch = torch.from_numpy(edges_tensor).long().to(self.device)
                # Expand telemetry to [batch=1, seq_len, 8]
                if telemetry_tensor.ndim == 2:
                    telemetry_torch = torch.from_numpy(telemetry_tensor).unsqueeze(0).float().to(self.device)
                else:
                    telemetry_torch = torch.from_numpy(telemetry_tensor).float().to(self.device)

                probs = self.tgnn(
                    x=x_torch,
                    edge_index=edge_index_torch,
                    edge_attr=None,
                    telemetry_seq=telemetry_torch,
                )
                probs_np = probs.cpu().numpy()[0]

            # 4. Evaluate Conformal Prediction Gate
            decision = self.calibrator.evaluate_sample(probs_np)

            # 5. Assemble Output Tensors
            out_class = np.array([decision.final_clinical_verdict.encode("utf-8")], dtype=object)
            out_set = np.array([c.encode("utf-8") for c in decision.conformal_prediction_set], dtype=object)
            out_indeterminate = np.array([decision.is_indeterminate], dtype=bool)
            out_mahalanobis = np.array([divergence_val], dtype=np.float32)
            out_biomarker = np.array([pred_biomarker_val], dtype=np.float32)
            out_probs = np.array(probs_np, dtype=np.float32)

            response = pb_utils.InferenceResponse(
                output_tensors=[
                    pb_utils.Tensor("PREDICTED_CLASS", out_class),
                    pb_utils.Tensor("CONFORMAL_SET", out_set),
                    pb_utils.Tensor("IS_INDETERMINATE", out_indeterminate),
                    pb_utils.Tensor("MAHALANOBIS_DIVERGENCE", out_mahalanobis),
                    pb_utils.Tensor("PREDICTED_BIOMARKER", out_biomarker),
                    pb_utils.Tensor("PREDICTED_PROBABILITIES", out_probs),
                ]
            )
            responses.append(response)

        return responses

    def finalize(self):
        """Cleanup resources."""
        pass
