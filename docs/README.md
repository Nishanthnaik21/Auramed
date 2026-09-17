# AuraMed — Complete Documentation Master Index

Welcome to the comprehensive documentation directory for **AuraMed** (also presented as *"The Vanishing Dose"* at Manipal Hackathon 2026, Track 3: Good Health & Well-Being).

This documentation suite has been engineered specifically to provide **complete, presentation-ready, and technically rigorous details** of the entire system for hackathon judges, clinical advisors, engineering leads, and stakeholders.

---

## 📑 Documentation Structure & Quick Links

| Document | Title | Description & Presentation Utility |
| :--- | :--- | :--- |
| [**01_PROJECT_OVERVIEW.md**](./01_PROJECT_OVERVIEW.md) | **Executive Overview & Problem Statement** | Problem statement, clinical & economic motivation ($300B non-adherence crisis), core philosophy, and key differentiators. |
| [**02_ARCHITECTURE_AND_DATAFLOW.md**](./02_ARCHITECTURE_AND_DATAFLOW.md) | **System Architecture & Dataflow** | End-to-end architecture diagrams, layer-by-layer technical breakdown, Rust edge proxy, Flink streaming, Feast/Redis, ML core, Neo4j, and cloud infrastructure. |
| [**03_FEATURES_AND_SYSTEM_MODULES.md**](./03_FEATURES_AND_SYSTEM_MODULES.md) | **Deep Dive into System Features & Modules** | Mathematical, algorithmic, and engineering details of all 9 system modules (UKF, TGNN, Conformal Gate, Neo4j, CDS Hooks, React UI). |
| [**04_STEP_BY_STEP_DEMO_AND_USAGE_GUIDE.md**](./04_STEP_BY_STEP_DEMO_AND_USAGE_GUIDE.md) | **Step-by-Step Demo & Usage Guide** | Chronological presentation and demo script, persona workflows (Dhyan Anchan & Anish), modal usage, live Kafka streaming simulation, and 1-click actions. |
| [**05_SETUP_AND_INSTALLATION_GUIDE.md**](./05_SETUP_AND_INSTALLATION_GUIDE.md) | **Installation, Setup & Testing Manual** | Prerequisites, local & Docker setup instructions, running `start_all.py`, executing the 14-test verification suite, and environment configuration. |
| [**06_PRESENTATION_CHEATSHEET_AND_PITCH_DECK.md**](./06_PRESENTATION_CHEATSHEET_AND_PITCH_DECK.md) | **Presentation Cheatsheet & Judge Q&A** | 30-second elevator pitch, 3-minute demo pitch, 5-slide alignment, anticipated judge questions & bulletproof answers, and competitive matrix. |

---

## 🎯 High-Level Project Summary

### The Problem
Medication non-adherence is a **$300 Billion annual drain** on healthcare systems, responsible for over **125,000 preventable deaths** and 25% of hospital readmissions. Traditional methods rely either on **punitive patient self-reporting** ("Did you take your pills?"), which patients fabricate, or **simplistic refill alerts**, which cause rampant physician alert fatigue (over 90% dismissal rate) and falsely accuse patients experiencing legitimate clinical side effects or drug-drug interactions.

### The AuraMed Solution
**AuraMed** is an **Uncertainty-Aware Pharmacometrics & Conformal Reasoning Engine**. Rather than interrogating the patient or triggering naive alarms, AuraMed passively analyzes longitudinal, routinely available healthcare telemetry (pharmacy dispenses, EMR lab observations, and remote cellular blood pressure/glucose readings).

It uses a **Continuous-Discrete PK/PD Unscented Kalman Filter (UKF)** to model the expected drug concentration and biomarker response, cross-checks for metabolic confounders via a **Neo4j Pharmacology Knowledge Graph**, and evaluates predictions through an **Inductive Split-Conformal Prediction Gate** ($\alpha = 0.10$) with **Epistemic Shannon Entropy suppression**. If evidence is noisy or conflicting ($H(P) > 0.10$), the alert is safely suppressed. When an authentic lapse is confirmed, AuraMed delivers non-punitive, 1-click clinical decision support cards directly inside the electronic health record via **HL7 CDS Hooks 1.0** and **SMART-on-FHIR**.

```
[Routine EMR & Claims Feeds]
            │
            ▼
┌──────────────────────────────────────┐
│  Rust Ingestion Gateway              │ ➔ Salted HMAC-SHA256 Zero-PHI Tokenization
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Apache Flink 1.18 Engine            │ ➔ 90-day Sliding Windows, PDC Bitmask & OLS Slopes
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Feast Online Store (Redis <1ms)     │ ➔ Sub-millisecond Longitudinal Telemetry Serving
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Continuous-Discrete PK/PD UKF       │ ➔ State-Space Biomarker Trajectory & Divergence r(t)
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Neo4j Knowledge Graph Traversal     │ ➔ CYP450 Metabolic Clearance & Drug Interaction Check
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Split-Conformal Safety Gate         │ ➔ 90% Coverage Guarantee; Suppress if Entropy > 0.10
└──────────────────┬───────────────────┘
                   ▼
┌──────────────────────────────────────┐
│  FastAPI CDS Hooks & SMART-on-FHIR   │ ➔ Non-Punitive CDS Cards & Hospital-Grade React UI
└──────────────────────────────────────┘
```

---

## ⚡ 60-Second Quick Start

To launch the entire platform with pre-flight safety gate validation and automatic browser dashboard launching:

```bash
# From workspace root
python start_all.py
```

- **Clinician Dashboard UI:** [http://localhost:5173](http://localhost:5173)
- **CDS Hooks Discovery:** [http://127.0.0.1:8000/cds-services](http://127.0.0.1:8000/cds-services)
- **Service Health Check:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

To run the automated mathematical and clinical safety test suite:
```bash
python auramed/ml-core/test_ml_core.py
python auramed/cds-hooks-service/test_cds_hooks.py
python auramed/knowledge-graph/test_pharmacology_service.py
```
*(All 14 unit and integration test suites pass out of the box).*
