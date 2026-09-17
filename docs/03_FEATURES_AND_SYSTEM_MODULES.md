# 03. System Features & Module Deep Dive

This document provides an exhaustive, mathematically and architecturally detailed analysis of each feature and subsystem within AuraMed.

---

## 📑 Module Index
1. [Module 1: Zero-PHI Edge Ingestion Gateway (Rust / Axum)](#module-1-zero-phi-edge-ingestion-gateway)
2. [Module 2: Real-Time Stream Analytics (Apache Flink 1.18)](#module-2-real-time-stream-analytics)
3. [Module 3: Feast Real-Time Feature Store](#module-3-feast-real-time-feature-store)
4. [Module 4: Continuous-Discrete PK/PD Unscented Kalman Filter](#module-4-continuous-discrete-pkpd-unscented-kalman-filter)
5. [Module 5: Temporal Graph Neural Network (TGNN)](#module-5-temporal-graph-neural-network-tgnn)
6. [Module 6: Inductive Split-Conformal Safety Gate](#module-6-inductive-split-conformal-safety-gate)
7. [Module 7: Neo4j Pharmacology Knowledge Graph](#module-7-neo4j-pharmacology-knowledge-graph)
8. [Module 8: HL7 CDS Hooks 1.0 Clinical Microservice](#module-8-hl7-cds-hooks-10-clinical-microservice)
9. [Module 9: SMART-on-FHIR Clinician Dashboard Application](#module-9-smart-on-fhir-clinician-dashboard-application)

---

## Module 1: Zero-PHI Edge Ingestion Gateway
- **Source Directory:** `auramed/ingestion-gateway`
- **Core Technology:** Rust, Axum, Tokio, RD-Kafka.

### Key Capabilities & Algorithms
1. **Edge De-Identification & Zero-PHI Boundary:**
   To comply with HIPAA Safe Harbor and GDPR Article 9, all Direct Identifiers (Patient Names, Social Security Numbers, Medical Record Numbers, Residential Addresses) are stripped at the edge proxy before serialization.
2. **Cryptographic Salted HMAC-SHA256 Tokenization:**
   Instead of using reversible database identifiers, AuraMed computes a cryptographically secure, irreversible pseudonymous token:
   $$\text{Token} = \text{HMAC-SHA256}(K_{\text{master}}, \text{Salt} \parallel \text{RawPatientID})$$
   - $K_{\text{master}}$: 256-bit AES/HMAC Master Key secured in AWS KMS / HashiCorp Vault.
   - $\text{Salt}$: High-entropy, tenant-isolated cryptographic salt.
   - Properties: Deterministic across institutional feeds (allows longitudinal linking) while mathematically impossible to invert without the KMS master key.
3. **High-Throughput Ingestion Endpoints:**
   - `POST /api/v1/telemetry/dispense`: Accepts pharmacy claim events (NDC, RxNorm, quantity dispensed, days supply).
   - `POST /api/v1/telemetry/observations`: Accepts clinical lab telemetry (LOINC codes, measurement timestamp, numerical values for SBP, HbA1c, eGFR).
   - `POST /api/v1/telemetry/encounters`: Accepts outpatient, ER, or inpatient admission timestamps to prevent false adherence flags during hospitalization.

---

## Module 2: Real-Time Stream Analytics
- **Source Directory:** `auramed/streaming-job`
- **Core Technology:** Apache Flink 1.18, Java 17, Flink Kafka Connector.

### Key Capabilities & Algorithms
1. **90-Day Event-Time Sliding Window:**
   Maintains a stateful sliding window partitioned by `patientToken` with event-time watermarking to handle late-arriving pharmacy claims.
2. **90-Bit CMS PDC Bitmask:**
   Computes the Centers for Medicare & Medicaid Services (CMS) standard **Proportion of Days Covered (PDC)** using a bitwise representation:
   - Each day in the 90-day window is represented by a single bit (1 = covered by active medication supply, 0 = uncovered).
   - PDC is calculated as:
     $$\text{PDC} = \frac{\text{PopCount}(\text{Bitmask}_{90})}{90}$$
   - Handles overlapping fills (pushes forward the start date of the second fill rather than double-counting).
3. **Refill Gap Index (RGI):**
   Quantifies medication desert intervals:
   $$\text{RGI} = \frac{\sum \text{Days in Uncovered Gaps}}{\text{Window Length (90)}}$$
4. **Pickup Interval Variance ($\sigma^2_{\text{pickup}}$):**
   Calculates the statistical variance of the time between consecutive refills:
   $$\sigma^2 = \frac{1}{N-1}\sum_{i=1}^N (\Delta t_i - \overline{\Delta t})^2$$
   High variance indicates erratic, chaotic pickup behaviors even if the total pill count appears adequate.
5. **OLS Biomarker Trajectory Drift:**
   Computes the linear slope ($\beta_1$) of lab measurements over time via Ordinary Least Squares to detect early therapeutic slippage before catastrophic decompensation:
   $$\beta_1 = \frac{\sum (t_i - \bar{t})(y_i - \bar{y})}{\sum (t_i - \bar{t})^2}$$

---

## Module 3: Feast Real-Time Feature Store
- **Source Directory:** `auramed/feature-store`
- **Core Technology:** Feast 0.36, Redis 7.2 Alpine, Apache Iceberg, MinIO.

### Key Capabilities & Schema
1. **Low-Latency Serving (<1ms):**
   Feast online features are stored in Redis as hash sets keyed by `auramed:patient:{token}`. When an EHR opens a chart, features are read in under 1 millisecond:
   ```json
   {
     "pdc_90d": "0.522",
     "refill_gap_index": "0.478",
     "covered_days": "47",
     "pickup_interval_variance": "14.2",
     "sbp_slope_per_day": "0.137"
   }
   ```
2. **Offline Parquet Data Lake:**
   Historical sliding windows are written in batch to MinIO/S3 in Apache Parquet format. This feeds downstream model training and provides hold-out datasets for conformal quantile calibration.

---

## Module 4: Continuous-Discrete PK/PD Unscented Kalman Filter
- **Source Directory:** `auramed/ml-core/pkpd_ukf.py`
- **Core Technology:** Python 3.10, NumPy, SciPy, Scaled Unscented Transform.

### Mathematical Formulation
The filter tracks a 3-dimensional latent continuous physiological state:
$$x(t) = \begin{bmatrix} A_{\text{gut}}(t) & C_{\text{plasma}}(t) & E_{\text{biomarker}}(t) \end{bmatrix}^T$$

#### 1. Continuous Pharmacokinetic Differential Equations (One-Compartment Oral Model)
$$\frac{dA_{\text{gut}}}{dt} = -k_a A_{\text{gut}}$$
$$\frac{dC_{\text{plasma}}}{dt} = \frac{k_a \cdot F}{V_d} A_{\text{gut}} - \left(\frac{CL}{V_d}\right) C_{\text{plasma}}$$
- $k_a$: Oral absorption rate constant ($\text{hr}^{-1}$)
- $F$: Absolute oral bioavailability fraction
- $V_d$: Apparent volume of distribution ($\text{L}$)
- $CL$: Systemic clearance ($\text{L/hr}$)

#### 2. Continuous Pharmacodynamic Indirect Turnover Response
The drug inhibits the biomarker synthesis or turnover via a sigmoidal $E_{max}$ Hill equation:
$$\frac{dE}{dt} = k_{\text{out}} \left[ E_0 \left(1 - \frac{E_{max} \cdot C(t)^\gamma}{EC_{50}^\gamma + C(t)^\gamma}\right) - E(t) \right]$$
- $E_0$: Natural baseline of the biomarker without medication (e.g., untreated SBP = 152 mmHg).
- $E_{max}$: Maximum drug-induced therapeutic reduction (e.g., 26 mmHg).
- $EC_{50}$: Plasma concentration producing 50% of maximum effect.
- $\gamma$: Hill cooperativity coefficient.
- $k_{\text{out}}$: Endogenous physiological turnover rate constant.

#### 3. Scaled Unscented Transform & Numerical Integration
- Generates $2n + 1 = 7$ deterministic sigma points $\chi_i$ capturing the mean and state covariance $P(t)$:
  $$\chi_0 = \hat{x}$$
  $$\chi_i = \hat{x} + \left(\sqrt{(n + \lambda) P}\right)_i, \quad i = 1, \dots, n$$
  $$\chi_{i+n} = \hat{x} - \left(\sqrt{(n + \lambda) P}\right)_i, \quad i = 1, \dots, n$$
- Propagates sigma points forward in continuous time using a 4th-order Runge-Kutta (RK4) ODE solver.

#### 4. Discrete Measurement Update & Mahalanobis Residual Divergence
When an outpatient lab measurement $y_k$ (e.g., SBP = 152 mmHg) arrives at discrete time $t_k$:
- Measurement residual (innovation): $\tilde{y}_k = y_k - H \hat{x}_{k|k-1}$
- Innovation covariance: $S_k = H P_{k|k-1} H^T + R$
- **Mahalanobis Residual Divergence ($r_k$):**
  $$r_k = \sqrt{\tilde{y}_k^T S_k^{-1} \tilde{y}_k}$$
  - If $r_k \le 2.0\sigma$: The observed biomarker is consistent with normal pharmacometric variation under adherence.
  - If $r_k > 3.0\sigma$: The biomarker has diverged significantly from expected full-adherence control, indicating therapeutic discordance.

---

## Module 5: Temporal Graph Neural Network (TGNN)
- **Source Directory:** `auramed/ml-core/tgnn_adherence.py`
- **Core Technology:** PyTorch 2.2, Multi-Head Graph Attention (GAT), Gated Recurrent Units (GRU).

### Architecture & Operation
1. **Multi-Head Graph Attention Layer (Structural Context):**
   Constructs a patient-specific medication graph where nodes represent prescribed drugs, chronic conditions, and metabolic enzymes. Edges represent documented drug-drug interactions or shared clearance pathways.
   The attention coefficient $\alpha_{ij}^k$ between node $i$ and neighbor $j$ under attention head $k$ is:
   $$\alpha_{ij}^k = \frac{\exp\left(\text{LeakyReLU}\left(a^T [W x_i \parallel W x_j \parallel W_e e_{ij}]\right)\right)}{\sum_{l \in \mathcal{N}_i} \exp\left(\text{LeakyReLU}\left(a^T [W x_i \parallel W x_l \parallel W_e e_{il}]\right)\right)}$$
2. **Global Graph Pooling:**
   Combines node embeddings using mean and max pooling into a static patient structural representation $h_{\text{graph}} \in \mathbb{R}^{32}$.
3. **Temporal GRU (Longitudinal Dynamics):**
   Processes a sequential vector of 8 telemetry variables over consecutive 30-day time steps:
   $$z_t = [\text{PDC}_t, \text{RGI}_t, \sigma^2_t, \text{Biomarker}_t, \text{Encounter}_t, \dots]$$
   A 2-layer GRU updates hidden states: $h_{\text{temp}} = \text{GRU}(z_1, \dots, z_T)$.
4. **Classification Head:**
   Concatenates structural and temporal embeddings: $h = [h_{\text{graph}} \parallel h_{\text{temp}}]$, followed by a linear projection and Softmax output producing probabilities over 3 classes:
   $$P(Y) = [P(\text{Concordant}), P(\text{Intermittent}), P(\text{Abandoned})]$$

---

## Module 6: Inductive Split-Conformal Safety Gate
- **Source Directory:** `auramed/ml-core/conformal_gate.py` & `validate_conformal_safety.py`
- **Core Technology:** Conformal Prediction, Shannon Information Entropy.

### The Problem of Alert Fatigue
In modern hospital EHRs, physicians dismiss over 90% of automated alerts because typical machine learning models are overconfident and produce uncalibrated probabilities on out-of-distribution patients.

### AuraMed's Mathematical Safety Guarantees
1. **Non-Conformity Scoring:**
   On a holdout calibration dataset of $n = 1,000$ validated patients, the non-conformity score of each patient is evaluated:
   $$s_i = 1 - P(Y = y_i \mid X_i)$$
2. **Finite-Sample Corrected Quantile ($\hat{q}$):**
   For a desired clinical safety level of 90% coverage ($\alpha = 0.10$):
   $$\text{level} = \frac{\lceil(n+1)(1-\alpha)\rceil}{n}$$
   $$\hat{q} = \text{Quantile}\left(\{s_i\}_{i=1}^n, \text{level}\right)$$
3. **Conformal Prediction Set Construction:**
   For any new patient $X_{n+1}$:
   $$C(X_{n+1}) = \left\{ y \in \{\text{Concordant}, \text{Intermittent}, \text{Abandoned}\} \mid 1 - P(Y = y \mid X_{n+1}) \le \hat{q} \right\}$$
   **Theoretical Guarantee:** $P\left(Y_{n+1} \in C(X_{n+1})\right) \ge 1 - \alpha = 90\%$.
4. **Epistemic Shannon Entropy Suppression Rule:**
   Computes normalized Shannon entropy $H(P)$:
   $$H(P) = -\frac{1}{\ln 3} \sum_{k=1}^3 P_k \ln(P_k)$$
   **The Abstinence Decision Rule:**
   $$\text{If } |C(X)| > 1 \quad \mathbf{OR} \quad H(P) > 0.10 \implies \text{Verdict} = \mathbf{INDETERMINATE} \implies \text{SUPPRESS ALERT}$$
   - If the model is uncertain, conflicting, or lacks sufficient longitudinal data, **no alert is shown to the doctor**.
   - If $H(P) \le 0.10$ and $|C(X)| = 1$, the model has high epistemic certainty, and an alert is authorized.

---

## Module 7: Neo4j Pharmacology Knowledge Graph
- **Source Directory:** `auramed/knowledge-graph`
- **Core Technology:** Neo4j 5.18 Community, APOC Library, Cypher, `neo4j-python-driver`.

### Ontology & Knowledge Schema
- **Nodes:**
  - `(:Medication {name, rxnorm, bioactivation_required, oral_bioavailability})`
  - `(:Enzyme {name, family, organ_location})`
  - `(:Phenotype {name, activity_score, clearance_factor})`
  - `(:LabBiomarker {name, loinc, unit, physiological_target})`
- **Relationships:**
  - `[:METABOLIZED_BY {clearance_fraction, pathway_importance}]`
  - `[:INHIBITS {inhibition_potency, ki_micromolar}]`
  - `[:INDUCES {fold_increase}]`
  - `[:MODULATES_LAB {expected_delta, direction}]`

### Clinical Cypher Traversal for Confounder Elimination
When a patient exhibits biomarker non-response, AuraMed queries Neo4j to evaluate if a co-prescribed medication or genetic metabolizer status explains the lab deviation without patient non-adherence:
```cypher
MATCH (m1:Medication)-[:INHIBITS]->(e:Enzyme)<-[:METABOLIZED_BY]-(m2:Medication)
WHERE m1.rxnorm IN $patient_active_rxnorms 
  AND m2.rxnorm IN $patient_active_rxnorms
  AND m1 <> m2
RETURN m1.name AS Inhibitor, e.name AS Enzyme, m2.name AS Substrate, 
       m2.bioactivation_required AS Prodrug_Blocked
```
- **Example:** If Lisinopril or Metformin efficacy is compromised by severe renal clearance inhibition or competitive transporter blockade (OCT1/2), Neo4j surfaces the metabolic conflict, **preventing a false accusation of non-adherence**.

---

## Module 8: HL7 CDS Hooks 1.0 Clinical Microservice
- **Source Directory:** `auramed/cds-hooks-service`
- **Core Technology:** FastAPI, Pydantic v2, Uvicorn.
- **Specification:** HL7 CDS Hooks 1.0.

### Supported Hook Services
1. `auramed-patient-view` (`hook: patient-view`):
   - Fired automatically whenever a physician opens a patient's chart in Epic, Cerner, or an open-source EMR.
   - Evaluates adherence telemetry, checks the conformal safety gate, and renders an EHR card if discordance is confirmed.
2. `auramed-medication-prescribe` (`hook: medication-prescribe`):
   - Fired during the order signing workflow when a physician prescribes a medication.
   - Alerts the physician if past adherence discordance indicates that ordering another daily retail pill is likely to fail, recommending a 90-day mail-order delivery or once-weekly formulation instead.

### Non-Punitive CDS Card Architecture
- **Summary:** `"Therapeutic Discordance Observed"` (never "Patient Non-Adherent").
- **Detail:** Clear pharmacometrics rationale explaining PDC %, refill gap index, biomarker drift, and calibrated conformal confidence.
- **1-Click FHIR Suggestions (ServiceRequest):**
  - Order Comprehensive Metabolic Panel (CMP, LOINC 24323-8).
  - Order Remote Home Blood Pressure Telemetry (RPM, LOINC 85354-9).
  - Create Clinical Consultation Task for Pharmacy Review.
- **SMART App Launch Link:** Embedded deep link directly into the AuraMed SMART-on-FHIR visualization app.

---

## Module 9: SMART-on-FHIR Clinician Dashboard Application
- **Source Directory:** `auramed/smart-on-fhir-app`
- **Core Technology:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.

### User Interface Features & Interactive Controls
1. **Hospital-Grade White Theme & Dark Theme Switcher:**
   - Designed by default in an authoritative, clinical **White Theme** featuring soft slate borders and clean clinical cards for high readability in hospital environments, with instant toggle to Dark Mode.
2. **Patient Demographic & Pharmacogenomic (PGx) Header:**
   - Displays Name, MRN, DOB, Condition, Current Medication, eGFR, and PGx Metabolizer Phenotype (e.g., CYP2D6 \*1/\*1 Normal Metabolizer).
3. **Biomarker Trajectory Chart (`BiomarkerTrajectoryChart.tsx`):**
   - Renders observed patient lab measurements against counterfactual PK/PD simulation.
   - Displays the $\pm 2\sigma$ pharmacometric confidence envelope.
   - Highlights medication refill events and gap lapses directly on the time axis.
4. **Refill Timeline & 90-Bit Bitmask (`RefillTimeline.tsx`):**
   - Displays interactive day-by-day dispensing status with color-coded badges for covered vs. uncovered days.
   - Summarizes PDC Score, Covered Days Count, Refill Gap Index, and Interval Variance.
5. **1-Click Clinical Action Panel (`ClinicalActionPanel.tsx`):**
   - **Action 1:** Switch to 90-Day Mail-Order Supply (removes retail pickup friction).
   - **Action 2:** Order Comprehensive Metabolic Panel (LOINC 24323-8).
   - **Action 3:** Order Remote Home BP Telemetry (LOINC 85354-9).
   - **Action 4:** Refer to Clinical Pharmacist Consultation.
6. **Neo4j Pharmacology Graph Modal (`PharmacologyContradictionModal.tsx`):**
   - Displays an interactive visual representation of CYP450 enzymes, active pathways, and metabolizer phenotypes, proving no metabolic contraindications exist.
7. **SBAR Consultation Note Generator (`ClinicalNoteModal.tsx`):**
   - Automatically drafts an EMR-ready **SBAR Note** (Situation, Background, Assessment, Recommendation) with 1-click clipboard copy.
8. **Patient SMS Assistant Modal (`PatientOutreachModal.tsx`):**
   - Generates non-punitive, empathetic SMS messages for patient outreach with customizable templates.
9. **Clinician Active Learning Feedback Modal (`ClinicianFeedbackModal.tsx`):**
   - Enables clinicians to submit ground-truth audit feedback (e.g., confirming adherence lapse, noting unrecorded hospital admission) to retrain and calibrate the conformal prediction model.
10. **Live Stream Telemetry Simulation:**
    - Dedicated "Simulate Live Ingest" button that simulates real-time Kafka event ingestion and dynamic Flink sliding window re-calibration.
11. **Clinic Triage Roster View (`ClinicRosterView.tsx`):**
    - High-density population health table showing chronic cohorts (Hypertension & Diabetes).
    - Sortable by Mahalanobis Divergence Sigma, PDC %, and Refill Gap Index for rapid panel triage.
