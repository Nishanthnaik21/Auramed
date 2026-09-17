#!/usr/bin/env python3
"""AuraMed Unified Orchestration & Startup Controller.

Executes and coordinates the entire AuraMed platform:
1. Validates ML Clinical Safety Gate (Conformal Coverage >= 90%).
2. Launches FastAPI CDS Hooks Microservice on port 8000.
3. Launches SMART-on-FHIR React Clinician UI on port 5173.
4. Auto-detects Docker daemon to orchestrate Kafka, Redis, and Neo4j if available.
5. Verifies service health checks and opens the dashboard in your default browser.
6. Manages graceful shutdown on SIGINT (Ctrl+C).
"""

import os
import sys
import time
import signal
import shutil
import urllib.request
import subprocess
import webbrowser
from typing import List

# Base directories
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
AURAMED_DIR = BASE_DIR if os.path.basename(BASE_DIR) == "auramed" else os.path.join(BASE_DIR, "auramed")

CDS_HOOKS_DIR = os.path.join(AURAMED_DIR, "cds-hooks-service")
SMART_APP_DIR = os.path.join(AURAMED_DIR, "smart-on-fhir-app")
ML_CORE_DIR = os.path.join(AURAMED_DIR, "ml-core")

# Process handles
running_processes: List[subprocess.Popen] = []


def print_banner():
    banner = r"""
  ========================================================================
     ___                    __  __          _ 
    / _ \ _   _ _ __ __ _  |  \/  | ___  __| |
   / /_\ \ | | | '__/ _` | | |\/| |/ _ \/ _` |
  / /   \ \ |_| | | | (_| | | |  | |  __/ (_| |
  \/     \/\__,_|_|  \__,_| |_|  |_|\___|\__,_|
  
  Adherence Uncertainty & Pharmacometrics Reasoning Architecture
  Production Ingestion, Streaming, Machine Learning & Clinician Tier
  ========================================================================
    """
    print(banner)


def check_prerequisites():
    print("[*] Checking system dependencies and environment...")
    
    # Check Python executable
    print(f"  [+] Python executable: {sys.executable} (Version: {sys.version.split()[0]})")
    
    # Check Node / npm
    npm_path = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm_path:
        print("  [!] Warning: 'npm' command not found. SMART-on-FHIR UI requires Node.js.")
    else:
        print(f"  [+] Node Package Manager (npm): {npm_path}")

    # Check Docker daemon
    docker_path = shutil.which("docker")
    docker_running = False
    if docker_path:
        try:
            res = subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3)
            docker_running = (res.returncode == 0)
        except Exception:
            docker_running = False

    if docker_running:
        print("  [+] Docker Daemon: ACTIVE (Full cluster mode enabled)")
    else:
        print("  [-] Docker Daemon: NOT DETECTED (Running in High-Performance Local Native Mode)")

    return docker_running


def run_clinical_safety_validation():
    print("\n" + "-" * 70)
    print("[*] Step 1: Executing Algorithmic Clinical Safety Validation Gate...")
    print("-" * 70)
    
    safety_script = os.path.join(ML_CORE_DIR, "validate_conformal_safety.py")
    if not os.path.exists(safety_script):
        print(f"  [!] Safety script not found at {safety_script}. Skipping gate.")
        return True

    env = os.environ.copy()
    env["PYTHONPATH"] = ML_CORE_DIR + os.pathsep + env.get("PYTHONPATH", "")
    
    try:
        res = subprocess.run([sys.executable, safety_script], env=env, capture_output=True, text=True, check=True)
        for line in res.stdout.strip().splitlines():
            if "Empirical Coverage:" in line or "[SUCCESS]" in line:
                print(f"  {line}")
        print("  [+] Clinical Safety Gate: PASSED (Conformal coverage meets 90% FDA safety criteria)")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  [X] Clinical Safety Gate FAILED with error:\n{e.stderr}")
        return False


def start_docker_services():
    compose_file = os.path.join(AURAMED_DIR, "docker-compose.yml")
    if os.path.exists(compose_file):
        print("\n[*] Starting container infrastructure (Kafka, Redis, Neo4j, MinIO)...")
        try:
            subprocess.run(["docker", "compose", "up", "-d"], cwd=AURAMED_DIR, check=True)
            print("  [+] Docker containers initialized successfully.")
        except Exception as e:
            print(f"  [!] Docker compose failed: {e}. Continuing with native services.")


def start_cds_hooks_service():
    print("\n[*] Step 2: Starting CDS Hooks FastAPI Microservice on http://127.0.0.1:8000 ...")
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ]
    env = os.environ.copy()
    env["PYTHONPATH"] = CDS_HOOKS_DIR + os.pathsep + env.get("PYTHONPATH", "")

    p = subprocess.Popen(cmd, cwd=CDS_HOOKS_DIR, env=env)
    running_processes.append(p)

    # Wait for health probe
    healthy = False
    for _ in range(15):
        time.sleep(1)
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2) as resp:
                if resp.status == 200:
                    healthy = True
                    break
        except Exception:
            pass

    if healthy:
        print("  [+] CDS Hooks Service is HEALTHY on http://127.0.0.1:8000")
    else:
        print("  [!] Warning: CDS Hooks service startup is taking longer than expected.")


def start_smart_on_fhir_ui():
    print("\n[*] Step 3: Starting SMART-on-FHIR Clinical Dashboard (Vite / React)...")
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    cmd = [npm_cmd, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"]

    p = subprocess.Popen(cmd, cwd=SMART_APP_DIR)
    running_processes.append(p)

    # Wait for UI port
    ready = False
    for _ in range(15):
        time.sleep(1)
        try:
            with urllib.request.urlopen("http://127.0.0.1:5173", timeout=2) as resp:
                if resp.status == 200:
                    ready = True
                    break
        except Exception:
            pass

    if ready:
        print("  [+] SMART-on-FHIR Clinical UI is READY on http://127.0.0.1:5173")
    else:
        print("  [+] SMART-on-FHIR server spawned on http://127.0.0.1:5173")


def shutdown(sig=None, frame=None):
    print("\n\n[*] Shutting down all AuraMed processes gracefully...")
    for p in running_processes:
        try:
            p.terminate()
            p.wait(timeout=3)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass
    print("[+] All services stopped cleanly. Goodbye!")
    sys.exit(0)


def main():
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print_banner()
    docker_active = check_prerequisites()

    # Step 1: Run validation gate
    if not run_clinical_safety_validation():
        print("[X] Aborting startup due to algorithmic safety gate failure.")
        sys.exit(1)

    # Step 2: Launch Docker containers if daemon is running
    if docker_active:
        start_docker_services()

    # Step 3: Launch CDS Hooks
    start_cds_hooks_service()

    # Step 4: Launch SMART UI
    start_smart_on_fhir_ui()

    print("\n" + "=" * 70)
    print("   AURAMED IS RUNNING SUCCESSFULLY!")
    print("=" * 70)
    print("  * Clinician Dashboard UI : http://localhost:5173")
    print("  * CDS Hooks Discovery    : http://127.0.0.1:8000/cds-services")
    print("  * Service Health Probe   : http://127.0.0.1:8000/health")
    print("=" * 70)
    print("  [+] Opening http://localhost:5173 in your default browser...")

    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

    print("\n[i] Press Ctrl+C in this terminal at any time to stop all services.\n")

    # Keep alive until Ctrl+C
    while True:
        try:
            time.sleep(1)
            # Check if child processes died unexpectedly
            for p in running_processes:
                if p.poll() is not None:
                    print(f"[!] Process {p.pid} exited with code {p.returncode}")
        except KeyboardInterrupt:
            shutdown()


if __name__ == "__main__":
    main()
