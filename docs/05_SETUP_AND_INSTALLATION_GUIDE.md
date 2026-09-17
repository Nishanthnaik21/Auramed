# 05. Setup, Installation & Verification Manual

This document provides complete instructions for setting up, configuring, executing, and testing AuraMed in local, containerized, and production cloud environments.

---

## 💻 System Prerequisites

| Dependency | Minimum Version | Verification Command | Notes |
| :--- | :--- | :--- | :--- |
| **Python** | 3.10 or higher | `python --version` | Required for ML Core, Conformal Engine, and CDS Hooks. |
| **Node.js & npm** | Node 18+ / npm 9+ | `node -v && npm -v` | Required for the SMART-on-FHIR React Clinician Dashboard. |
| **Git** | 2.30+ | `git --version` | Version control. |
| **Docker & Docker Compose** | Docker 24+ / Compose v2 | `docker info` | *Optional:* Enables full Kafka, Redis, Neo4j, and Flink containers. |

> **Note on Execution Modes:**
> AuraMed is designed with a **Dual-Mode Orchestration Architecture**:
> 1. **High-Performance Native Mode (Default):** Runs immediately on any laptop without needing Docker installed. The system launches the Python ML/CDS services and Vite React UI natively, using embedded pharmacometrics and conformal models.
> 2. **Full Distributed Cluster Mode:** Automatically activates when a running Docker daemon is detected, spawning the Kafka broker, Redis feature store, Neo4j graph database, MinIO lakehouse, and Flink streaming containers.

---

## ⚡ Quick-Start (1-Command Orchestration)

To execute the entire platform in a single terminal command:

```bash
# Navigate to the workspace root
cd "c:\Users\Nishanth Naik\Desktop\manipal"

# Execute the unified orchestration runner
python start_all.py
```

### What `start_all.py` Executes Automatically:
1. **Pre-flight System Diagnostics:** Checks Python executable, Node/npm paths, and Docker availability.
2. **Clinical Safety Validation Gate:** Executes `auramed/ml-core/validate_conformal_safety.py` to mathematically verify that inductive split-conformal coverage satisfies the $\ge 90\%$ safety threshold.
3. **Docker Infrastructure (if available):** Executes `docker compose up -d` for Kafka, Redis, Neo4j, and MinIO.
4. **CDS Hooks Microservice:** Spawns FastAPI CDS Hooks service on `http://127.0.0.1:8000`.
5. **SMART-on-FHIR Clinician App:** Spawns Vite development server on `http://127.0.0.1:5173`.
6. **Browser Auto-Launch:** Automatically opens `http://localhost:5173` in your default browser.
7. **Graceful Signal Handling:** Manages clean shutdown of all spawned processes on `Ctrl+C`.

---

## 🔧 Step-by-Step Manual Setup

If you prefer to start individual components manually in separate terminals:

### 1. Python Environment Setup
```bash
# Navigate to workspace
cd "c:\Users\Nishanth Naik\Desktop\manipal"

# Install ML Core and CDS Hooks dependencies
pip install fastapi uvicorn pydantic redis neo4j numpy scipy torch
```

### 2. Frontend Dependencies Setup
```bash
cd "c:\Users\Nishanth Naik\Desktop\manipal\auramed\smart-on-fhir-app"
npm install
```

### 3. Run Pre-flight Mathematical Safety Gate
```bash
cd "c:\Users\Nishanth Naik\Desktop\manipal\auramed\ml-core"
python validate_conformal_safety.py
```
*Expected Output:*
```text
[SUCCESS] Empirical Coverage = 91.86% >= 90.00%
[SUCCESS] Clinical safety validation PASSED.
```

### 4. Start the CDS Hooks Microservice (Terminal 1)
```bash
cd "c:\Users\Nishanth Naik\Desktop\manipal\auramed\cds-hooks-service"
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
*Verification:*
- Health Check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- Discovery: [http://127.0.0.1:8000/cds-services](http://127.0.0.1:8000/cds-services)

### 5. Start the SMART-on-FHIR UI (Terminal 2)
```bash
cd "c:\Users\Nishanth Naik\Desktop\manipal\auramed\smart-on-fhir-app"
npm run dev -- --host 127.0.0.1 --port 5173
```
*Verification:*
- Clinician Dashboard: [http://localhost:5173](http://localhost:5173)

---

## 🐳 Full Containerized Cluster Mode (Docker Compose)

To launch the full enterprise distributed infrastructure:

```bash
cd "c:\Users\Nishanth Naik\Desktop\manipal\auramed"
docker compose up -d
```

### Container Port Mapping Table:

| Container Name | Service | Host Port | Internal Port | Protocol / Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `auramed-kafka` | Apache Kafka (KRaft) | `9092` | `29092` | Claims & observation event streaming |
| `auramed-redis` | Redis 7.2 (Feast Store) | `6379` | `6379` | Online sub-millisecond feature store |
| `auramed-neo4j` | Neo4j 5.18 Community | `7474`, `7687` | `7474`, `7687` | Cypher graph browser & Bolt protocol |
| `auramed-minio` | MinIO S3 Lakehouse | `9000`, `9001` | `9000`, `9001` | Parquet telemetry & training data lake |
| `auramed-ingestion` | Rust Ingestion Gateway | `8080` | `8080` | Edge Zero-PHI REST proxy |
| `auramed-flink-jobmanager` | Apache Flink 1.18 | `8081` | `8081` | Stream job manager web console |

---

## 🧪 Automated Verification & Test Suite

The AuraMed platform includes **14 comprehensive unit and integration test suites** verifying the mathematical pharmacometrics, neural attention layers, conformal gates, knowledge graph queries, and CDS Hooks responses.

### 1. Test ML Core (UKF, TGNN, Conformal Gate)
```bash
cd "c:\Users\Nishanth Naik\Desktop\manipal\auramed\ml-core"
python -m pytest test_ml_core.py -v
```
**Tests Executed:**
- `test_pkpd_ukf_disposition_and_pharmacodynamics`: Verifies 1-compartment absorption ODEs, drug clearance, and positive-definite state covariance.
- `test_pkpd_ukf_mahalanobis_residual_divergence`: Verifies innovation covariance calculation and divergence detection when lab measurements slip.
- `test_tgnn_graph_attention_layer`: Verifies Multi-Head GAT layer message passing and edge feature weighting.
- `test_tgnn_temporal_graph_model_forward`: Verifies end-to-end forward pass across combined graph pooling and 2-layer GRU.
- `test_split_conformal_calibrator`: Verifies non-conformity scoring, $\hat{q}$ quantile calculation, and finite-sample calibration.
- `test_conformal_uncertainty_gating`: Verifies that ambiguous distributions ($H(P) > 0.10$) are classified as `INDETERMINATE` and suppressed.

### 2. Test CDS Hooks Microservice
```bash
cd "c:\Users\Nishanth Naik\Desktop\manipal\auramed\cds-hooks-service"
python -m pytest test_cds_hooks.py -v
```
**Tests Executed:**
- `test_cds_services_discovery`: Verifies HL7 discovery payload advertising `patient-view` and `medication-prescribe`.
- `test_deterministic_patient_tokenization`: Verifies HMAC-SHA256 zero-PHI edge token equivalence.
- `test_patient_view_card_generation`: Verifies that non-punitive cards with FHIR `ServiceRequest` order sets are formulated for discordant patients.
- `test_patient_view_alert_suppression`: Verifies that concordant patients or patients with high entropy receive zero cards.

### 3. Test Neo4j Pharmacology Service
```bash
cd "c:\Users\Nishanth Naik\Desktop\manipal\auramed\knowledge-graph"
python -m pytest test_pharmacology_service.py -v
```
**Tests Executed:**
- `test_pharmacology_models`: Verifies Pydantic schemas for CYP enzyme competition, inhibition, and confounder risk score.
- `test_mock_pharmacology_confounder_detection`: Verifies that enzymatic competitive inhibition pathways are properly flagged.

---

## ⚙️ Environment Variables Reference

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `REDIS_HOST` | `localhost` | Hostname of the Feast Redis online store. |
| `REDIS_PORT` | `6379` | Port for Redis connections. |
| `NEO4J_URI` | `neo4j://localhost:7687` | Bolt protocol connection URI for Neo4j. |
| `NEO4J_AUTH` | `neo4j/auramedpassword` | Username and password credentials for Neo4j. |
| `SMART_APP_LAUNCH_URL` | `http://localhost:5173` | Launch URL for the SMART-on-FHIR clinician app. |
| `AURAMED_MASTER_SECRET` | `c3VwZXItc2VjcmV0...` | Base64-encoded 256-bit KMS key for patient tokenization. |
| `AURAMED_SALT` | `auramed_phi_pepper_2026_prod` | High-entropy cryptographic pepper for zero-PHI hashing. |

---

## 🛠️ Troubleshooting & FAQ

### 1. Port Conflict on 8000 or 5173
- **Symptom:** `Error: listen EADDRINUSE: address already in use 127.0.0.1:8000` or `:5173`.
- **Solution (Windows PowerShell):**
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
  Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process -Force
  ```

### 2. npm Not Found
- **Symptom:** `start_all.py` warns that `npm` command is not found.
- **Solution:** Ensure Node.js 18+ is installed from [nodejs.org](https://nodejs.org) and added to your system `PATH`. Restart your terminal.

### 3. Conformal Safety Validation Gate Fails
- **Symptom:** `Clinical Safety Gate FAILED with error...`
- **Solution:** Verify that `numpy`, `scipy`, and `torch` are installed in your active Python environment:
  ```bash
  pip install numpy scipy torch
  ```
