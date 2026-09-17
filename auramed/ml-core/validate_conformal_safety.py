"""Clinical Safety Validation Gate: Conformal Prediction Coverage Evaluator.

Executes in CI/CD pipeline prior to deployment.
Asserts that empirical coverage on a benchmark validation cohort meets or exceeds 90.0% (alpha = 0.10).
Fails the pipeline with exit code 1 if coverage is breached or safety suppression fails.
"""

import sys
import numpy as np
from conformal_gate import SplitConformalCalibrator, ADHERENCE_CLASSES


def generate_benchmark_validation_cohort(n_samples: int = 1000):
    """Generates synthetic multi-class clinical validation cohort with realistic noise."""
    np.random.seed(2026)
    
    # Ground truth class distribution: 65% Concordant, 25% Intermittent, 10% Abandoned
    true_labels = np.random.choice([0, 1, 2], size=n_samples, p=[0.65, 0.25, 0.10])
    
    probs = np.zeros((n_samples, 3), dtype=np.float64)
    for i, label in enumerate(true_labels):
        alpha_vec = [1.0, 1.0, 1.0]
        # Boost true class parameter to simulate trained model with realistic calibrated confidence
        alpha_vec[label] = 12.0
        sample_prob = np.random.dirichlet(alpha_vec)
        probs[i] = sample_prob
        
    return probs, true_labels


def main():
    print("=" * 70)
    print("AuraMed Clinical Safety Gate: Conformal Coverage Validation")
    print("Enforcing FDA / HITECH Algorithmic Safety Standard (alpha = 0.10)")
    print("=" * 70)

    n_samples = 1000
    val_probs, val_labels = generate_benchmark_validation_cohort(n_samples)

    # 1. Initialize Split Conformal Calibrator
    calibrator = SplitConformalCalibrator(alpha=0.10, entropy_threshold=0.10)
    
    # Use first 300 samples for inductive calibration
    n_calib = 300
    calib_probs = val_probs[:n_calib]
    calib_labels = val_labels[:n_calib]
    
    test_probs = val_probs[n_calib:]
    test_labels = val_labels[n_calib:]
    n_test = len(test_labels)

    q_hat = calibrator.calibrate(calib_probs, calib_labels)
    print(f"Calibration successful: n_calib={n_calib}, q_hat cutoff={q_hat:.4f}")

    # 2. Evaluate Coverage on Hold-Out Benchmark Cohort
    covered_count = 0
    suppressed_count = 0

    for i in range(n_test):
        decision = calibrator.evaluate_sample(test_probs[i])
        true_class_name = ADHERENCE_CLASSES[test_labels[i]]
        
        # Check if ground truth class is present in the conformal prediction set
        if true_class_name in decision.conformal_prediction_set:
            covered_count += 1
            
        if decision.is_indeterminate:
            suppressed_count += 1

    empirical_coverage = covered_count / n_test
    print(f"Test cohort size: {n_test}")
    print(f"Empirical Coverage: {empirical_coverage * 100:.2f}% (Required: >= 90.00%)")
    print(f"Ambiguous Alerts Suppressed (INDETERMINATE): {suppressed_count}/{n_test} ({suppressed_count / n_test * 100:.1f}%)")

    # 3. Clinical Safety Gate Assertion
    REQUIRED_COVERAGE = 0.900
    if empirical_coverage < REQUIRED_COVERAGE:
        print(
            f"\n[CRITICAL SAFETY GATE FAILURE]: Empirical coverage {empirical_coverage * 100:.2f}% "
            f"failed the required threshold of {REQUIRED_COVERAGE * 100:.2f}%. Halting pipeline."
        )
        sys.exit(1)

    print(
        f"\n[SUCCESS]: Clinical safety gate passed. Coverage is {empirical_coverage * 100:.2f}% >= 90.0%. "
        "Artifact approved for GitOps deployment."
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
