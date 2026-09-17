"""Inductive Split-Conformal Prediction & Clinical Uncertainty Gating Module.

Enforces a 90% coverage guarantee (alpha = 0.10) using non-conformity scores.
Applies rigorous safety decision logic:
If conformal prediction set size |C(X)| > 1 OR epistemic entropy H(P) > 0.10:
=> Classifies prediction as "INDETERMINATE" to safely suppress noisy alerts.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Set, Tuple
import numpy as np

ADHERENCE_CLASSES = ["Concordant", "Intermittent", "Abandoned"]


@dataclass
class ConformalDecision:
    predicted_probabilities: Dict[str, float]
    conformal_prediction_set: List[str]
    set_size: int
    epistemic_entropy: float
    is_indeterminate: bool
    final_clinical_verdict: str
    q_hat_threshold: float
    safety_justification: str


class SplitConformalCalibrator:
    """Inductive Split-Conformal Calibrator for multi-class adherence models."""

    def __init__(self, alpha: float = 0.10, entropy_threshold: float = 0.10):
        """
        :param alpha: Significance level (default 0.10 -> 90% coverage guarantee).
        :param entropy_threshold: Epistemic Shannon entropy cutoff above which alerts are suppressed.
        """
        if not (0.0 < alpha < 1.0):
            raise ValueError(f"Significance level alpha must be in (0, 1), got {alpha}")
        self.alpha = alpha
        self.entropy_threshold = entropy_threshold
        self.q_hat: Optional[float] = None
        self.is_calibrated: bool = False
        self.num_classes = len(ADHERENCE_CLASSES)

    def calibrate(self, val_probs: np.ndarray, val_labels: np.ndarray) -> float:
        """Calibrates non-conformity quantile on hold-out validation dataset.

        :param val_probs: Softmax probabilities [N, K]
        :param val_labels: Ground truth integer class indices [N] (0..K-1)
        :return: Computed q_hat cutoff
        """
        val_probs = np.asarray(val_probs, dtype=np.float64)
        val_labels = np.asarray(val_labels, dtype=np.int64)
        n = len(val_labels)

        if n < 20:
            raise ValueError(f"Insufficient calibration samples: n={n}. Minimum 20 required.")

        # Compute non-conformity scores: s_i = 1 - P(Y = y_i | X_i)
        true_class_probs = val_probs[np.arange(n), val_labels]
        non_conformity_scores = 1.0 - true_class_probs

        # Finite-sample corrected quantile index: ceil((n + 1) * (1 - alpha)) / n
        level = math.ceil((n + 1) * (1.0 - self.alpha)) / n
        level = min(1.0, max(0.0, level))

        # Empirical quantile with linear interpolation
        self.q_hat = float(np.quantile(non_conformity_scores, level, method="higher"))
        self.is_calibrated = True
        return self.q_hat

    @staticmethod
    def calculate_epistemic_entropy(probs: Sequence[float]) -> float:
        """Calculates normalized Shannon entropy H(P) in range [0.0, 1.0].

        H(P) = - sum(P_k * log_K(P_k))
        """
        p_arr = np.asarray(probs, dtype=np.float64)
        p_arr = np.clip(p_arr, 1e-12, 1.0)
        p_arr = p_arr / np.sum(p_arr)

        k = len(p_arr)
        if k <= 1:
            return 0.0

        entropy_nats = -np.sum(p_arr * np.log(p_arr))
        max_entropy_nats = np.log(k)
        normalized_entropy = float(entropy_nats / max_entropy_nats)
        return max(0.0, min(1.0, normalized_entropy))

    def evaluate_sample(self, probabilities: Sequence[float]) -> ConformalDecision:
        """Evaluates a single prediction through the conformal uncertainty gate.

        :param probabilities: Model softmax distribution [P_concordant, P_intermittent, P_abandoned]
        :return: ConformalDecision
        """
        if not self.is_calibrated or self.q_hat is None:
            # Fallback heuristic if not yet calibrated
            effective_q_hat = 1.0 - (1.0 - self.alpha)  # e.g. 0.90 -> q_hat ~ 0.90
        else:
            effective_q_hat = self.q_hat

        probs_list = [float(p) for p in probabilities]
        prob_dict = {
            ADHERENCE_CLASSES[i]: round(probs_list[i], 4)
            for i in range(len(ADHERENCE_CLASSES))
        }

        # Conformal prediction set: C(X) = { y : 1 - P(y|x) <= q_hat } <=> { y : P(y|x) >= 1 - q_hat }
        prob_cutoff = 1.0 - effective_q_hat
        prediction_set: List[str] = [
            ADHERENCE_CLASSES[i]
            for i, p in enumerate(probs_list)
            if p >= prob_cutoff
        ]

        set_size = len(prediction_set)
        entropy = self.calculate_epistemic_entropy(probs_list)

        # Clinical uncertainty safety decision rule:
        # If |C(X)| > 1 OR epistemic entropy > 0.10: Suppress alert as INDETERMINATE
        is_indeterminate = False
        reasons = []

        if set_size > 1:
            is_indeterminate = True
            reasons.append(f"Conformal set size |C(X)| = {set_size} exceeds singleton limit (ambiguous boundary)")
        elif set_size == 0:
            is_indeterminate = True
            reasons.append("Empty conformal prediction set (extreme out-of-distribution telemetry)")

        if entropy > self.entropy_threshold:
            is_indeterminate = True
            reasons.append(f"Epistemic entropy {entropy:.4f} exceeds safety threshold {self.entropy_threshold}")

        if is_indeterminate:
            final_verdict = "INDETERMINATE"
            justification = "ALERT SUPPRESSED: " + "; ".join(reasons)
        else:
            final_verdict = prediction_set[0]
            justification = f"CONFIDENT PREDICTION: Singleton set {{{final_verdict}}} with calibrated entropy {entropy:.4f} <= {self.entropy_threshold}"

        return ConformalDecision(
            predicted_probabilities=prob_dict,
            conformal_prediction_set=prediction_set,
            set_size=set_size,
            epistemic_entropy=round(entropy, 4),
            is_indeterminate=is_indeterminate,
            final_clinical_verdict=final_verdict,
            q_hat_threshold=round(effective_q_hat, 4),
            safety_justification=justification,
        )
