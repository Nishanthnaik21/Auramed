"""Comprehensive Test Suite for AuraMed ML Core & Clinical Uncertainty Engine."""

import math
import numpy as np
import pytest
import torch

from pkpd_ukf import ContinuousDiscretePKPDUKF, DoseEvent, LabMeasurement, PKPDParameters
from tgnn_adherence import TemporalGraphAdherenceModel, ADHERENCE_CLASSES
from conformal_gate import SplitConformalCalibrator, ConformalDecision


# ------------------------------------------------------------------------------
# 1. PK/PD Unscented Kalman Filter Tests
# ------------------------------------------------------------------------------

def test_pkpd_ukf_disposition_and_pharmacodynamics():
    params = PKPDParameters(
        ka=0.5,
        bioavailability=0.4,
        clearance=3.0,
        v_d=50.0,
        e0=150.0,
        emax=30.0,
        ec50=0.10,
        gamma=1.0,
    )
    ukf = ContinuousDiscretePKPDUKF(params=params)

    # Initial state: no drug, baseline biomarker
    assert ukf.x[0] == 0.0
    assert ukf.x[1] == 0.0
    assert ukf.x[2] == 150.0

    # Ingest 20 mg dose at t = 0
    ukf.apply_dose(20.0)
    assert ukf.x[0] == 20.0

    # Predict forward to t = 4 hours (absorption and distribution peak)
    ukf.predict_to_time(t_target=4.0, t_current=0.0)

    # Plasma concentration must have risen
    assert ukf.x[1] > 0.02, "Plasma concentration should increase after absorption"
    # Gut concentration must have depleted
    assert ukf.x[0] < 20.0, "Gut drug amount must decrease"
    # SBP biomarker should have dropped below baseline 150 mmHg
    assert ukf.x[2] < 150.0, "Biomarker effect should show reduction from baseline"

    # Verify covariance remains symmetric and positive-definite
    P = ukf.P
    np.testing.assert_allclose(P, P.T, atol=1e-6)
    eigvals = np.linalg.eigvalsh(P)
    assert np.all(eigvals > 0), "State covariance must remain positive-definite"


def test_pkpd_ukf_mahalanobis_residual_divergence():
    params = PKPDParameters(e0=140.0, emax=20.0, ec50=0.05)
    ukf = ContinuousDiscretePKPDUKF(params=params, measurement_noise_var=9.0)

    # Patient takes dose at t=0
    ukf.apply_dose(25.0)
    ukf.predict_to_time(t_target=6.0, t_current=0.0)

    expected_sbp = ukf.x[2]

    # Case A: Lab reading matches pharmacological expectation
    y_pred, residual, r_small = ukf.update_measurement(expected_sbp + 0.5)
    assert abs(residual) < 1.0
    assert r_small < 1.0, "Concordant lab reading should yield small Mahalanobis divergence"

    # Reset filter for Case B: Non-adherent / resistant spike
    ukf_divergent = ContinuousDiscretePKPDUKF(params=params, measurement_noise_var=9.0)
    ukf_divergent.apply_dose(25.0)
    ukf_divergent.predict_to_time(t_target=6.0, t_current=0.0)

    # Lab reading spikes to 160 mmHg despite drug
    _, _, r_large = ukf_divergent.update_measurement(160.0)
    assert r_large > 3.0, "Severe divergence from model must produce Mahalanobis r > 3.0"


# ------------------------------------------------------------------------------
# 2. Temporal Graph Neural Network Tests
# ------------------------------------------------------------------------------

def test_tgnn_adherence_forward_pass_and_probabilities():
    torch.manual_seed(42)

    # 4 nodes (2 medications, 1 condition, 1 clearance pathway), 16 features each
    x = torch.randn(4, 16)

    # Graph edges (bidirectional relationships)
    edge_index = torch.tensor([
        [0, 1, 1, 2, 2, 3, 0, 3],
        [1, 0, 2, 1, 3, 2, 3, 0],
    ], dtype=torch.long)

    # Longitudinal telemetry sequence: batch_size=2, seq_len=12 (e.g. 12 sliding windows), 8 features
    telemetry_seq = torch.randn(2, 12, 8)

    model = TemporalGraphAdherenceModel(
        node_in_dim=16,
        edge_dim=4,
        graph_hidden_dim=32,
        telemetry_in_dim=8,
        temporal_hidden_dim=32,
        num_classes=3,
    )
    model.eval()

    with torch.no_grad():
        probs = model(x, edge_index, edge_attr=None, telemetry_seq=telemetry_seq)

    # Output assertions
    assert probs.shape == (2, 3), "Output probabilities must have shape [batch_size, num_classes]"
    assert torch.all(probs >= 0.0), "Probabilities must be non-negative"
    assert torch.all(probs <= 1.0), "Probabilities must be bounded by 1.0"

    # Must sum to 1.0 across classes
    sums = probs.sum(dim=-1)
    np.testing.assert_allclose(sums.numpy(), np.ones(2), atol=1e-5)


def test_tgnn_gradient_backpropagation():
    model = TemporalGraphAdherenceModel(
        node_in_dim=8,
        graph_hidden_dim=16,
        telemetry_in_dim=4,
        temporal_hidden_dim=16,
        num_classes=3,
    )
    model.train()

    x = torch.randn(3, 8, requires_grad=True)
    edge_index = torch.tensor([[0, 1, 2], [1, 2, 0]], dtype=torch.long)
    telemetry = torch.randn(1, 5, 4, requires_grad=True)

    probs = model(x, edge_index, None, telemetry)
    loss = F_loss = -torch.log(probs[0, 0] + 1e-8)
    loss.backward()

    assert x.grad is not None, "Gradients must propagate through graph attention layers"
    assert telemetry.grad is not None, "Gradients must propagate through temporal GRU"


# ------------------------------------------------------------------------------
# 3. Conformal Prediction Gating & Epistemic Uncertainty Tests
# ------------------------------------------------------------------------------

def test_conformal_calibrator_split_coverage():
    np.random.seed(42)
    calibrator = SplitConformalCalibrator(alpha=0.10, entropy_threshold=0.10)

    # 150 validation samples
    n_val = 150
    val_probs = np.random.dirichlet(np.array([4.0, 1.0, 0.5]), size=n_val)
    val_labels = np.random.choice([0, 1, 2], size=n_val, p=[0.7, 0.2, 0.1])

    q_hat = calibrator.calibrate(val_probs, val_labels)

    assert calibrator.is_calibrated is True
    assert 0.0 < q_hat < 1.0, "q_hat threshold must be strictly within (0, 1)"


def test_conformal_alert_suppression_under_ambiguity():
    calibrator = SplitConformalCalibrator(alpha=0.10, entropy_threshold=0.10)
    calibrator.q_hat = 0.50  # Cutoff at P >= 0.50
    calibrator.is_calibrated = True

    # Ambiguous input: Model cannot separate Concordant vs Intermittent
    ambiguous_probs = [0.46, 0.44, 0.10]
    decision = calibrator.evaluate_sample(ambiguous_probs)

    # Both classes have 1 - P <= 0.54, but let's check prob cutoff = 1 - 0.50 = 0.50
    # Here, no class reaches 0.50 -> empty set or high entropy
    # Entropy of [0.46, 0.44, 0.10] is high:
    entropy = calibrator.calculate_epistemic_entropy(ambiguous_probs)
    assert entropy > 0.10, f"Expected entropy > 0.10, got {entropy}"

    # Critical Assertion: Must suppress alert and declare INDETERMINATE
    assert decision.is_indeterminate is True
    assert decision.final_clinical_verdict == "INDETERMINATE"
    assert "ALERT SUPPRESSED" in decision.safety_justification


def test_conformal_confident_singleton_prediction():
    calibrator = SplitConformalCalibrator(alpha=0.10, entropy_threshold=0.10)
    calibrator.q_hat = 0.70  # Requires P >= 0.30 to enter set
    calibrator.is_calibrated = True

    # Clear concordant case (high confidence yielding normalized entropy < 0.10)
    confident_probs = [0.99, 0.006, 0.004]
    decision = calibrator.evaluate_sample(confident_probs)

    # Low entropy
    assert decision.epistemic_entropy <= 0.10
    # Singleton set {Concordant}
    assert decision.conformal_prediction_set == ["Concordant"]
    assert decision.set_size == 1

    # Verdict must be Concordant (not indeterminate)
    assert decision.is_indeterminate is False
    assert decision.final_clinical_verdict == "Concordant"
    assert "CONFIDENT PREDICTION" in decision.safety_justification
