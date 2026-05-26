#!/bin/bash
# 54Bank Consolidated Entrypoint — compliance-fraud
# Fraud — detection, scoring, anomaly, GNN, fusion
# Services: 8 | Ports: 9180-9187
set -e

echo "[compliance-fraud] Starting 8 services..."

PIDS=()

cleanup() {
  echo "[compliance-fraud] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[compliance-fraud] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9180 python3 /app/services/agent-fraud-detection-py/main.py &
PIDS+=($!)
PORT=9181 /app/services/ai-fraud-scoring-rs/ai_fraud_scoring_rs &
PIDS+=($!)
PORT=9182 python3 /app/services/anomaly-detector-py/main.py &
PIDS+=($!)
PORT=9183 /app/services/fraud-detection-rs/fraud_detection_rs &
PIDS+=($!)
PORT=9184 /app/services/fraudfusion-ensemble-rs/fraudfusion_ensemble_rs &
PIDS+=($!)
PORT=9185 python3 /app/services/gnn-fraud-detection-py/main.py &
PIDS+=($!)
PORT=9186 python3 /app/services/mcmc-bayesian-risk-py/main.py &
PIDS+=($!)
PORT=9187 python3 /app/services/txn-pattern-analyzer-py/main.py &
PIDS+=($!)

echo "[compliance-fraud] All 8 services started (ports 9180-9187)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[compliance-fraud] A service exited with code $EXIT_CODE"
cleanup
