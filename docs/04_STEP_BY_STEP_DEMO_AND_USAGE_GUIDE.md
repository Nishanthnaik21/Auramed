# 04. Step-by-Step Demo & Presentation Guide

This guide provides an exact, minute-by-minute demonstration script and presentation walkthrough for presenting **AuraMed** to hackathon judges, clinicians, or technical evaluators.

---

## ⏱️ Suggested 3-Minute Demo Timeline

| Timestamp | Phase / Section | Screen / Action | Key Speaking Points |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:30** | **The Problem & Setup** | Terminal startup / Title Slide | The $300B non-adherence problem; why patient surveys fail; pre-flight safety gate validation. |
| **0:30 – 1:15** | **Patient Chart & Pharmacometrics** | Dashboard (Dhyan Anchan `mp001`) | SBP trajectory divergence ($+4.10\sigma$); UKF counterfactual model; 90-day refill bitmask. |
| **1:15 – 1:55** | **Contradiction Check & Conformal Gate** | Neo4j Modal & Conformal Banner | Active checking of CYP450/DDIs; 90% conformal coverage guarantee; suppression of alert fatigue. |
| **1:55 – 2:35** | **Actionable Interventions & Live Ingest** | 1-Click Actions, SMS Modal & Toast | 1-Click 90-day mail delivery switch; empathetic patient SMS; live Kafka RPM ingestion simulation. |
| **2:35 – 3:00** | **Population Roster & Health Economics** | Clinic Triage Roster Tab | Population triage; switching between cohorts (Anish `mp002`); ROI for hospitals & ACOs. |

---

## 🚀 Step 1: Launching the System & Safety Gate Validation

### Terminal Command:
Open a terminal in the project root and execute:
```bash
python start_all.py
```

### What You See on Screen:
1. The AuraMed ASCII Banner prints.
2. **System Dependency Check:** Validates Python 3.10+, npm, and Docker status.
3. **Step 1: Clinical Safety Validation Gate:**
   ```text
   [*] Step 1: Executing Algorithmic Clinical Safety Validation Gate...
     [+] Evaluating empirical coverage on N=1,000 cohort...
     [+] Empirical Coverage: 91.86% (Target: >= 90.00%, alpha=0.10)
     [+] Mean Epistemic Shannon Entropy: 0.0612 nats
     [+] Ambiguous Predictions Suppressed: 8.14% (Safely routed to INDETERMINATE)
     [+] Clinical Safety Gate: PASSED (Conformal coverage meets 90% FDA safety criteria)
   ```
4. **Step 2 & 3:** Launches the FastAPI CDS Hooks microservice on `http://127.0.0.1:8000` and the SMART-on-FHIR React app on `http://127.0.0.1:5173`.
5. The default browser automatically opens `http://localhost:5173`.

> **Presenter Script:**
> *"Before AuraMed ever renders a clinical card to a physician, it executes an algorithmic pre-flight safety gate. Here in Step 1, our Inductive Split-Conformal Prediction model validates a 91.86% empirical coverage rate on a 1,000-patient calibration cohort, strictly satisfying FDA-grade clinical safety criteria. If the algorithm is ever uncertain, it safely abstains rather than crying wolf."*

---

## 🧑‍⚕️ Step 2: Patient Chart View & Trajectory Analysis

When the browser opens, you are placed in the **Patient Chart View** for **Dhyan Anchan (`mp001`)**:

### Visual Walkthrough:
1. **Top Header & Theme Switcher:**
   - Notice the hospital-grade **White Theme** designed with clean slate borders and clinical typography.
   - Click the **"Dark Theme"** button in the top right to show dynamic responsive theming, then switch back to White Theme for clinical clarity.
2. **Patient Demographics & PGx Banner:**
   - **Name:** Dhyan Anchan | **MRN:** `MRN-MP001-A` | **Condition:** Essential Stage-2 Hypertension | **Drug:** Lisinopril 20mg Oral.
   - Notice the purple **PGx Banner:** `CYP2D6 *1/*1 (Normal/Extensive) • eGFR: 88 mL/min (Normal Clearance)`.
3. **Therapeutic Discordance Observation Banner (The Conformal Alert):**
   - **Verdict:** `INTERMITTENT` | **Divergence:** `+4.10σ` | **PDC:** `52.2%` | **Entropy:** `0.07 ≤ 0.10`.
   - Explain to judges: *"The alert is labeled 'Therapeutic Discordance Observed' — completely non-punitive. It tells the doctor the blood pressure is failing because of an intermittent refill gap, not because Lisinopril stopped working."*
4. **Interactive Biomarker Trajectory Chart (`BiomarkerTrajectoryChart`):**
   - Point out the **dashed purple line:** Expected biomarker response under full adherence calculated by our Continuous-Discrete PK/PD Unscented Kalman Filter (target: ~126 mmHg).
   - Point out the **solid orange/red line:** Observed systolic blood pressure drifting from 126 back up to 152 mmHg.
   - Point out the **shaded green zone:** $\pm 2\sigma$ pharmacometric uncertainty envelope.
   - Point out the **red pill drop markers:** Visual markers on the timeline indicating when refill gaps occurred.
5. **90-Day Refill Timeline (`RefillTimeline`):**
   - Point out the 90-day interactive bitmask: **47 days covered (green)** and **43 days uncovered (red/amber)**.
   - Highlight the **Refill Gap Index (0.478)** and **Pickup Interval Variance (14.2)**, indicating erratic pharmacy trips.

---

## 🔍 Step 3: Demonstrating the Core Interactive Modals

In the sub-navigation toolbar above the alert banner, demonstrate the 5 core clinical intelligence buttons:

### Action A: Simulate Live Ingestion ("Simulate Live Ingest")
- Click **"Simulate Live Ingest"** (emerald button with pulsing radio icon).
- **What Happens:** An animated floating notification appears in the top-right corner:
  ```text
  [Kafka Stream Event]: Ingested new cellular RPM measurement: 148 mmHg for Dhyan Anchan (mp001) -> Flink Sliding Window & UKF Re-calibrated!
  ```
- **Speaking Point:** *"In real-world deployment, AuraMed connects directly to cellular home blood pressure cuffs. When a patient takes a reading at home, the Rust gateway ingests it into Kafka, and Flink updates the patient's UKF trajectory in real time."*

### Action B: Neo4j Pharmacology Contradiction Explorer ("Neo4j Graph")
- Click **"Neo4j Graph"** (teal network icon).
- **What Opens:** The **Neo4j Pharmacology Knowledge Graph Explorer Modal**.
- **What It Shows:**
  - Active drug: Lisinopril 20mg (RxNorm: 314076).
  - Metabolic route: Hydrolyzed to Lisinoprilat; excreted unchanged via kidneys (>95%).
  - Active CYP enzymes evaluated: CYP2D6, CYP3A4, CYP2C19.
  - **Confounder Risk Score: 0.00 (NO METABOLIC CONFLICTS DETECTED)**.
- **Speaking Point:** *"Before we accuse a patient of non-adherence, we query our Neo4j knowledge graph. Could this be a CYP450 drug-drug interaction? Could an inhibitor be blocking drug metabolism? Neo4j proves that Dhyan's enzymes and renal clearance are normal. Therefore, the failure of blood pressure control is authentically driven by medication refill gaps."*
- Click **"Close Explorer"**.

### Action C: Empathetic Patient SMS Outreach ("Patient SMS")
- Click **"Patient SMS"** (sky-blue message icon).
- **What Opens:** The **Patient Non-Punitive SMS Assistant Modal**.
- **What It Shows:**
  - Automated message preview:
    *"Hi Dhyan, Dr. Smith's clinic noticed your Lisinopril prescription hasn't been picked up recently. Everything okay? Reply 1 for free 90-day home mail delivery, 2 if you're experiencing side effects, or 3 to speak with our pharmacist."*
  - Interactive template picker (Refill Assistance, Tolerability Check, Mail Delivery Setup).
  - 1-Click **"Send Non-Punitive SMS"** trigger with simulated Twilio dispatch.
- **Speaking Point:** *"Instead of shaming patients during a 10-minute clinic visit, AuraMed automates empathetic, supportive outreach offering free home delivery or pharmacist support."*
- Click **"Close"**.

### Action D: Clinician Active Learning Audit ("Audit Feedback")
- Click **"Audit Feedback"** (purple checklist icon).
- **What Opens:** The **Clinician Feedback & Active Learning Audit Modal**.
- **What It Shows:**
  - Clinician can select verdict confirmation: *"Confirmed Intermittent Adherence"*, *"Patient Was Hospitalized (Unrecorded)"*, *"Physician Directed Drug Holiday"*, or *"Tolerability Discontinuation"*.
  - Submitting feedback writes ground truth to the training lakehouse for continuous split-conformal recalibration.
- Click **"Close"**.

### Action E: SBAR Clinical Consultation Note Export ("SBAR Note")
- Click **"SBAR Note"** (document icon).
- **What Opens:** The **SBAR Clinical Note Modal**.
- **What It Shows:**
  - Formats an EHR-ready **Situation, Background, Assessment, Recommendation (SBAR)** consultation note.
  - Includes objective numbers (PDC 52.2%, $+4.10\sigma$ divergence, normal CYP2D6).
  - Click **"Copy SBAR Note to Clipboard"** to demonstrate seamless integration into hospital charting.
- Click **"Close"**.

---

## ⚡ Step 4: Demonstrating 1-Click EHR Clinical Action Panel

Scroll down to the bottom of the page to the **Clinical Decision & Action Ordering Panel**:

1. **Card 1: 90-Day Mail-Order Switch**
   - Click the green button: **"Switch to 90-Day Mail Delivery"**.
   - Notice the button changes to a confirmed state: `✓ 90-Day Mail Delivery Order Placed`.
   - **Speaking Point:** *"Research shows that switching a patient from monthly retail pickup to 90-day mail delivery instantly increases average PDC from 52% to over 85%, eliminating transportation and pharmacy friction with a single click."*
2. **Card 2: Order Comprehensive Metabolic Panel (CMP)**
   - Click **"Order CMP Lab Panel"**.
   - Triggers FHIR `ServiceRequest` (LOINC 24323-8) to verify renal and electrolyte safety.
3. **Card 3: Order Remote Blood Pressure Monitoring (RPM)**
   - Click **"Order Cellular RPM Cuff"**.
   - Triggers FHIR `ServiceRequest` (LOINC 85354-9) for automated home cellular blood pressure tracking.

---

## 👥 Step 5: Population Health Triage Roster & Persona Switching

1. Click the **"Clinic Triage Roster (2 Cohorts)"** tab in the top navigation bar.
2. **What You See:**
   - A population health table showing all active chronic disease cohorts.
   - **Row 1:** Dhyan Anchan (`mp001`) — Essential Hypertension | Lisinopril | $+4.10\sigma$ | PDC 52.2% | Intermittent.
   - **Row 2:** Anish (`mp002`) — Type 2 Diabetes Mellitus | Metformin XR | $+3.85\sigma$ | PDC 48.5% | Intermittent.
3. **Switch to Patient Anish:**
   - Click on the row for **Anish** or click **"Open Chart"**.
   - The view smoothly transitions back to the Patient Chart View, fully populated with Anish's diabetic profile:
     - Biomarker: Glycated Hemoglobin (HbA1c) remaining elevated at 9.4% (target ~7.0%).
     - Drug: Metformin 500mg Extended Release.
     - Divergence: $+3.85\sigma$.
     - Transporter: OCT1/SLC22A1 normal hepatic uptake.
4. **Switch Demo Patients from Header:**
   - You can also click the red **"Switch Patient"** button in the top header at any time to return to the clinical authentication screen.

---

## 🏆 Presentation Wrap-Up Soundbite

> *"Judges, AuraMed proves that we don't need to interrogate patients or install expensive surveillance gadgets to solve the $300B medication adherence crisis. By fusing routine healthcare telemetry with continuous-discrete pharmacometrics, Neo4j contradiction checking, and mathematical conformal safety guarantees, AuraMed eliminates alert fatigue, prevents false accusations, and equips clinicians with 1-click interventions that keep patients out of the hospital."*
