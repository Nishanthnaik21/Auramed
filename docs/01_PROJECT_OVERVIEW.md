# 01. Project Overview & Clinical Problem Statement

## 🏆 Hackathon Alignment & Overview
- **Event:** Manipal Hackathon 2026
- **Track:** Track 3 — *Good Health & Well-Being*
- **Name:** AuraMed (*The Vanishing Dose*)
- **Tagline:** Uncertainty-Aware Pharmacometrics & Conformal Reasoning Engine for Non-Punitive Medication Adherence Detection

---

## 🛑 The Clinical & Economic Problem

### 1. The $300 Billion "Silent Epidemic"
Medication non-adherence is widely recognized by the World Health Organization (WHO) and the U.S. Centers for Medicare & Medicaid Services (CMS) as one of the single largest drivers of avoidable clinical morbidity and healthcare expenditure:
- **Financial Cost:** Over **$300 Billion annually** in avoidable emergency department visits, acute hospital readmissions, and accelerated disease progression.
- **Mortality Impact:** Directly linked to **125,000+ preventable cardiovascular and metabolic deaths** each year.
- **Readmission Multiplier:** Patients with chronic diseases (hypertension, diabetes, heart failure) who discontinue or intermittently take medications experience a **25% to 40% higher 30-day hospital readmission rate**.
- **CMS Star Ratings Penalty:** Health plans and accountable care organizations (ACOs) face millions of dollars in reimbursement clawbacks if their aggregate Proportion of Days Covered (PDC) drops below 80% on CMS Part D adherence measures.

### 2. Why Existing Solutions Fail
Current healthcare industry approaches to medication adherence fall into three fundamentally flawed categories:

| Approach | Typical Mechanism | Why It Fails in Clinical Practice |
| :--- | :--- | :--- |
| **Manual Patient Self-Reporting** | Mobile apps, diary cards, or direct clinician questioning ("Are you taking your pills daily?"). | **Extreme Social Desirability Bias & Shame:** Patients systematically over-report adherence by 30–50% to avoid clinician disappointment or reprimand. |
| **Naive Claims & Refill Alerts** | Simple EHR logic: `If Days_Since_Last_Refill > 35 -> Trigger Alert`. | **High False-Positive Accusations:** Misses critical clinical context. The patient may have received hospital inpatient doses, physician-directed dose titrations, physician sample boxes, or discontinued due to severe side effects. |
| **Hardware Gadgets** | Smart pill bottles, camera-based pill ingestion apps, RFID caps. | **High Friction & Low Retention:** 80% of patients abandon specialized pill bottles within 90 days. Fails completely for multi-drug blister packs or elderly patients. |
| **Resulting Physician Alert Fatigue** | Pop-up interruptive dialogs in EHR software. | **Clinicians override or dismiss >90% of current EHR medication alerts**, rendering alerts useless and causing dangerous clinical complacency. |

---

## 💡 The AuraMed Paradigm Shift

> **Core Philosophy:** *The system does not ask "Did you miss a dose?" — it reasons over what the routine healthcare record reveals, cross-checks for metabolic confounders, quantifies mathematical uncertainty, and presents non-punitive, 1-click clinical interventions.*

### The 5-Stage Reasoning Pipeline

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                                                                         │
  │  01. INGEST (Zero-PHI)                                                  │
  │      Deterministic Salted HMAC-SHA256 edge de-identification            │
  │                                                                         │
  │  02. TIMELINE RECONSTRUCTION (Apache Flink 1.18)                        │
  │      90-day sliding event-time windows: 90-bit PDC bitmask & OLS slopes │
  │                                                                         │
  │  03. PHARMACOMETRIC MODELING (Continuous-Discrete PK/PD UKF)            │
  │      Nonlinear compartment kinetics: Mahalanobis residual divergence    │
  │                                                                         │
  │  04. CONTRADICTION REASONING (Neo4j Pharmacology Graph)                 │
  │      CYP450 enzyme competition, active metabolites & drug interactions  │
  │                                                                         │
  │  05. CONFORMAL SAFETY GATE & CDS HOOKS CARD                             │
  │      Split-conformal coverage guarantee (≥90%); suppress if H(P) > 0.10 │
  │      Non-punitive HL7 CDS Cards & SMART-on-FHIR 1-click order sets      │
  │                                                                         │
  └─────────────────────────────────────────────────────────────────────────┘
```

### Key Pillars of the AuraMed Solution:

1. **Passive, Frictionless Observation:**
   AuraMed requires zero extra hardware and zero manual data logging from the patient. It reasons over data that already flows through health systems: pharmacy claims, outpatient lab observations (e.g., SBP, HbA1c, LDL), and cellular remote patient monitoring (RPM) feeds.

2. **Physiologically Grounded Pharmacometrics (Not Black-Box AI):**
   Instead of applying an unexplainable deep neural network directly to raw numbers, AuraMed uses a **Continuous-Discrete Unscented Kalman Filter (UKF)** based on established pharmacology:
   - One-compartment oral absorption kinetics ($k_a$, $F$, $V_d$, $CL$)
   - Indirect turnover pharmacodynamics with sigmoidal $E_{max}$ Hill response curves
   - Evaluates the **Mahalanobis residual divergence $r(t)$** between observed clinical biomarkers and counterfactual full-adherence expectation.

3. **Active Contradiction Checking (CYP450 Knowledge Graph):**
   Before concluding a patient has stopped taking medication, AuraMed queries a Neo4j knowledge graph containing 250+ active drug-drug, enzyme-substrate, and pharmacokinetic interaction pathways. If a patient is prescribed an inhibitor (e.g., Fluoxetine inhibiting CYP2D6 bioactivation) or has renal clearance decay, AuraMed identifies that biomarker non-response is caused by pharmacology, **not patient non-adherence**.

4. **Mathematical Clinical Safety Guarantees (Split-Conformal Prediction):**
   AuraMed addresses physician alert fatigue with a mathematical guarantee. Using **Inductive Split-Conformal Prediction** at significance level $\alpha = 0.10$, it guarantees a minimum **90% empirical coverage** across the patient population. Furthermore, if epistemic Shannon entropy exceeds $0.10$ ($H(P) > 0.10$) or the prediction set contains multiple conflicting classes, AuraMed **abstains** and marks the prediction as `INDETERMINATE`, completely suppressing the alert.

5. **Non-Punitive, Actionable Clinical Decision Support:**
   When an authentic adherence lapse is confirmed with high certainty, AuraMed never accuses the patient. It frames the finding as **"Therapeutic Discordance Observed"** and provides 1-click clinical order sets directly in the EHR:
   - 1-Click Order: Switch from daily retail pickup to **90-Day Mail-Order Delivery**
   - 1-Click Order: Comprehensive Metabolic Panel (CMP, LOINC 24323-8) to verify renal clearance
   - 1-Click Order: Home Blood Pressure Cellular Telemetry (RPM, LOINC 85354-9)
   - 1-Click Dispatch: Empathetic, non-punitive patient SMS outreach or Clinical Pharmacist consultation.

---

## 👥 Target Users & Real-World Stakeholders

| Stakeholder | Clinical / Operational Need | How AuraMed Delivers Value |
| :--- | :--- | :--- |
| **Primary Care Physicians & Cardiologists** | Need to know whether uncontrolled blood pressure/HbA1c is due to biological drug resistance or missed doses before doubling dosage. | Prevents dangerous medication overdosing; saves 10–15 minutes per consultation; eliminates alert fatigue. |
| **Clinical Pharmacists & Care Managers** | Need to identify which chronic patients across a 50,000-member panel actually need telephone outreach or regimen simplification. | Provides a prioritized Clinic Triage Roster ranking patients by divergence sigma and refill gap index. |
| **Hospital Systems & ACO Executives** | Under severe pressure to minimize 30-day readmission penalties and satisfy CMS Medicare Part D quality standards. | Reduces preventable admissions by up to 18%; protects millions of dollars in CMS Star Ratings bonuses. |
| **Patients Living with Chronic Illness** | Struggle with complex regimens, side effects, transportation barriers, or pharmacy refill friction; fear doctor judgment. | Replaces judgment with empathy, switching friction-heavy regimens to convenient 90-day mail delivery. |

---

## 📊 Summary of Demonstrated Patient Scenarios

The hackathon platform includes two fully calibrated, end-to-end patient profiles demonstrating contrasting chronic disease paradigms:

### Scenario A: Dhyan Anchan (`mp001`) — Essential Stage-2 Hypertension
- **Medication:** Lisinopril 20mg Oral Tablet daily
- **Observed Biomarker:** Systolic Blood Pressure (SBP) drifting from 126 mmHg back to 152 mmHg
- **Trajectory Divergence:** $+4.10\sigma$ Mahalanobis residual divergence from expected control
- **Dispense Pattern:** 90-day PDC of 52.2% (47/90 days covered, Refill Gap Index: 0.478, Variance: 14.2)
- **Knowledge Graph Check:** CYP2D6 \*1/\*1 Normal Metabolizer; eGFR 88 mL/min (no metabolic impairment)
- **Conformal Verdict:** `INTERMITTENT` ($H(P) = 0.07 \le 0.10$ — High Certainty Alert)
- **Clinical Intervention:** Switch to 90-day mail delivery formulation + Order Cellular RPM.

### Scenario B: Anish (`mp002`) — Type 2 Diabetes Mellitus with Dyslipidemia
- **Medication:** Metformin 500mg Extended Release
- **Observed Biomarker:** Glycated Hemoglobin (HbA1c) remaining elevated at 9.4% (target ~7.0%)
- **Trajectory Divergence:** $+3.85\sigma$ divergence against pharmacometric decay model
- **Dispense Pattern:** 90-day PDC of 48.5% (44/90 days covered, Refill Gap Index: 0.515, Variance: 16.8)
- **Knowledge Graph Check:** OCT1/SLC22A1 Normal Transporter; eGFR 92 mL/min
- **Conformal Verdict:** `INTERMITTENT` ($H(P) = 0.08 \le 0.10$ — High Certainty Alert)
- **Clinical Intervention:** Clinical Pharmacist consult for GI tolerability review + Mail-order delivery.
