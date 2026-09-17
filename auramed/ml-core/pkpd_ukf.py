"""Pharmacokinetic/Pharmacodynamic (PK/PD) Continuous-Discrete Unscented Kalman Filter.

Implements a continuous-discrete one-compartment disposition state-space model with
sigmoidal Emax pharmacodynamics. Evaluates latent drug concentrations C(t),
counterfactual biomarker trajectories ŷ(t), and Mahalanobis residual divergence r(t).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
import numpy as np


@dataclass
class PKPDParameters:
    """Clinical pharmacometrics parameters for a standard cardiovascular agent (e.g. Lisinopril/Amlodipine)."""
    ka: float = 0.50          # Absorption rate constant (1/hr)
    bioavailability: float = 0.30 # Bioavailability fraction F (0.0 to 1.0)
    clearance: float = 3.5    # Systemic clearance CL (L/hr)
    v_d: float = 60.0         # Volume of distribution Vd (L)
    e0: float = 145.0         # Baseline biomarker (e.g. SBP in mmHg)
    emax: float = 25.0        # Maximum drug-induced reduction (mmHg)
    ec50: float = 0.08        # Half-maximal effect concentration (mg/L)
    gamma: float = 1.2        # Hill coefficient of cooperativity
    kout: float = 0.05        # Biomarker indirect turnover rate (1/hr)


@dataclass
class DoseEvent:
    time_hours: float
    dose_mg: float


@dataclass
class LabMeasurement:
    time_hours: float
    measured_value: float


@dataclass
class FilterStepResult:
    time_hours: float
    estimated_plasma_conc: float
    counterfactual_biomarker: float
    observed_biomarker: Optional[float]
    mahalanobis_divergence: Optional[float]
    state_covariance: np.ndarray


class ContinuousDiscretePKPDUKF:
    """Continuous-discrete Unscented Kalman Filter for PK/PD state-space estimation."""

    def __init__(
        self,
        params: Optional[PKPDParameters] = None,
        process_noise_diag: Tuple[float, float, float] = (1e-4, 1e-4, 0.05),
        measurement_noise_var: float = 9.0,  # e.g. SBP lab noise std = 3 mmHg -> var = 9
        alpha: float = 1.0,
        beta: float = 2.0,
        kappa: float = 0.0,
    ):
        self.params = params or PKPDParameters()
        self.n = 3  # State dimension: [A_gut, C_plasma, E_biomarker]
        self.Q = np.diag(process_noise_diag)
        self.R = np.array([[measurement_noise_var]])

        # Scaled Unscented Transform weights (alpha=1.0, beta=2.0 for physical kinetics)
        self.alpha = alpha
        self.beta = beta
        self.kappa = kappa
        self.lambda_ = (alpha ** 2) * (self.n + kappa) - self.n

        # Positive, well-conditioned weights
        self.wm = np.full(2 * self.n + 1, 1.0 / (2.0 * (self.n + self.lambda_)))
        self.wc = np.full(2 * self.n + 1, 1.0 / (2.0 * (self.n + self.lambda_)))
        self.wm[0] = self.lambda_ / (self.n + self.lambda_)
        self.wc[0] = (self.lambda_ / (self.n + self.lambda_)) + (1.0 - alpha ** 2 + beta)

        # Initial state [A_gut (mg), C_plasma (mg/L), E_biomarker (mmHg)]
        self.x = np.array([0.0, 0.0, self.params.e0], dtype=np.float64)
        self.P = np.diag([0.5, 0.005, 4.0])
        self.ke = self.params.clearance / self.params.v_d

    def _ode_dynamics(self, state: np.ndarray) -> np.ndarray:
        """Continuous-time PK/PD nonlinear differential equations."""
        a_gut = max(0.0, state[0])
        c_plasma = max(0.0, state[1])
        e_biomarker = state[2]

        # PK continuous derivatives
        d_a_gut = -self.params.ka * a_gut
        d_c_plasma = (self.params.ka * self.params.bioavailability * a_gut / self.params.v_d) - (self.ke * c_plasma)

        # PD indirect turnover response: dE/dt = kout * (E0 * (1 - Emax*C^gamma / (EC50^gamma + C^gamma)) - E)
        hill_term = 0.0
        if c_plasma > 1e-9:
            c_g = c_plasma ** self.params.gamma
            ec_g = self.params.ec50 ** self.params.gamma
            hill_term = self.params.emax * c_g / (ec_g + c_g)

        target_effect = self.params.e0 - hill_term
        d_e_biomarker = self.params.kout * (target_effect - e_biomarker)

        return np.array([d_a_gut, d_c_plasma, d_e_biomarker])

    def _rk4_integrate(self, state: np.ndarray, dt: float) -> np.ndarray:
        """4th-order Runge-Kutta numerical integration step."""
        k1 = self._ode_dynamics(state)
        k2 = self._ode_dynamics(state + 0.5 * dt * k1)
        k3 = self._ode_dynamics(state + 0.5 * dt * k2)
        k4 = self._ode_dynamics(state + dt * k3)
        return state + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)

    def _generate_sigma_points(self, x: np.ndarray, P: np.ndarray) -> np.ndarray:
        """Generates 2n + 1 sigma points using Cholesky factor with jitter."""
        sigma_points = np.zeros((2 * self.n + 1, self.n))
        sigma_points[0] = x

        # Add jitter for numerical positive-definiteness
        jitter = 1e-9 * np.eye(self.n)
        P_sym = 0.5 * (P + P.T) + jitter
        try:
            chol = np.linalg.cholesky((self.n + self.lambda_) * P_sym)
        except np.linalg.LinAlgError:
            eigvals, eigvecs = np.linalg.eigh(P_sym)
            eigvals = np.maximum(eigvals, 1e-9)
            P_sym = eigvecs @ np.diag(eigvals) @ eigvecs.T
            chol = np.linalg.cholesky((self.n + self.lambda_) * P_sym)

        for i in range(self.n):
            sigma_points[i + 1] = x + chol[:, i]
            sigma_points[i + 1 + self.n] = x - chol[:, i]

        return sigma_points

    def predict_to_time(self, t_target: float, t_current: float, dt_step: float = 0.5) -> None:
        """Propagates state forward from t_current to t_target across multiple integration sub-steps."""
        total_dt = t_target - t_current
        if total_dt <= 0:
            return

        steps = max(1, int(math.ceil(total_dt / dt_step)))
        dt = total_dt / steps

        for _ in range(steps):
            sigma_points = self._generate_sigma_points(self.x, self.P)
            propagated_sigmas = np.zeros_like(sigma_points)

            for i in range(2 * self.n + 1):
                propagated_sigmas[i] = self._rk4_integrate(sigma_points[i], dt)

            # Reconstruct mean
            x_pred = np.zeros(self.n)
            for i in range(2 * self.n + 1):
                x_pred += self.wm[i] * propagated_sigmas[i]

            # Reconstruct covariance with process noise scaled by dt
            P_pred = np.zeros((self.n, self.n))
            for i in range(2 * self.n + 1):
                diff = propagated_sigmas[i] - x_pred
                P_pred += self.wc[i] * np.outer(diff, diff)

            P_pred += self.Q * dt

            # Physical non-negativity constraints on drug mass and concentration
            x_pred[0] = max(0.0, x_pred[0])
            x_pred[1] = max(0.0, x_pred[1])

            self.x = x_pred
            self.P = P_pred

    def apply_dose(self, dose_mg: float) -> None:
        """Discrete dose ingestion event into gastrointestinal absorption compartment."""
        self.x[0] += dose_mg
        self.P[0, 0] += 0.01 * (dose_mg ** 2)

    def update_measurement(self, observed_val: float) -> Tuple[float, float, float]:
        """Measurement update step with Mahalanobis residual divergence computation.

        :param observed_val: Observed clinical biomarker (e.g. SBP).
        :return: Tuple of (expected_y, residual, mahalanobis_divergence)
        """
        sigma_points = self._generate_sigma_points(self.x, self.P)

        # Observation function h(x) observes biomarker E (index 2)
        gamma = sigma_points[:, 2]  # Shape (2n + 1,)

        y_pred = float(np.sum(self.wm * gamma))

        # Innovation covariance S
        diff_y = gamma - y_pred
        s_scalar = float(np.sum(self.wc * (diff_y ** 2))) + float(self.R[0, 0])

        # Cross-covariance Pxy (vector of length n)
        diff_x = sigma_points - self.x  # (2n + 1, n)
        pxy = np.zeros(self.n)
        for i in range(2 * self.n + 1):
            pxy += self.wc[i] * diff_x[i] * diff_y[i]

        # Kalman gain K = Pxy / S
        kalman_gain = pxy / s_scalar

        # Innovation residual
        residual = observed_val - y_pred

        # Mahalanobis divergence: r = sqrt(residual^2 / S)
        mahalanobis_divergence = math.sqrt((residual ** 2) / s_scalar)

        # State and covariance update
        self.x = self.x + kalman_gain * residual
        self.P = self.P - np.outer(kalman_gain, kalman_gain) * s_scalar

        return y_pred, residual, mahalanobis_divergence

    def run_trajectory(
        self,
        doses: Sequence[DoseEvent],
        measurements: Sequence[LabMeasurement],
        t_end_hours: float,
    ) -> List[FilterStepResult]:
        """Runs the continuous-discrete filter over a scheduled timeline of doses and lab measurements."""
        # Collate all discrete events
        events: List[Tuple[float, str, object]] = []
        for d in doses:
            events.append((d.time_hours, "DOSE", d))
        for m in measurements:
            events.append((m.time_hours, "MEASUREMENT", m))

        events.sort(key=lambda x: x[0])

        results: List[FilterStepResult] = []
        current_time = 0.0

        for t_event, event_type, payload in events:
            if t_event > t_end_hours:
                break

            # Propagate continuous dynamics up to event time
            if t_event > current_time:
                self.predict_to_time(t_event, current_time)
                current_time = t_event

            if event_type == "DOSE":
                dose = payload  # type: DoseEvent
                self.apply_dose(dose.dose_mg)
                results.append(
                    FilterStepResult(
                        time_hours=current_time,
                        estimated_plasma_conc=float(self.x[1]),
                        counterfactual_biomarker=float(self.x[2]),
                        observed_biomarker=None,
                        mahalanobis_divergence=None,
                        state_covariance=self.P.copy(),
                    )
                )

            elif event_type == "MEASUREMENT":
                meas = payload  # type: LabMeasurement
                y_pred, residual, mahalanobis_r = self.update_measurement(meas.measured_value)
                results.append(
                    FilterStepResult(
                        time_hours=current_time,
                        estimated_plasma_conc=float(self.x[1]),
                        counterfactual_biomarker=y_pred,
                        observed_biomarker=meas.measured_value,
                        mahalanobis_divergence=mahalanobis_r,
                        state_covariance=self.P.copy(),
                    )
                )

        if current_time < t_end_hours:
            self.predict_to_time(t_end_hours, current_time)
            results.append(
                FilterStepResult(
                    time_hours=t_end_hours,
                    estimated_plasma_conc=float(self.x[1]),
                    counterfactual_biomarker=float(self.x[2]),
                    observed_biomarker=None,
                    mahalanobis_divergence=None,
                    state_covariance=self.P.copy(),
                )
            )

        return results
