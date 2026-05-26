#!/bin/bash
# 54Bank Consolidated Entrypoint — ai-ml-inference
# ML inference — fraud, credit, AML, churn, anomaly, GNN models
# Services: 4 | Ports: 9129-9132
set -e

echo "[ai-ml-inference] Starting 4 services..."

PIDS=()

cleanup() {
  echo "[ai-ml-inference] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[ai-ml-inference] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9129 python3 /app/services/art-adversarial-robustness-py/main.py &
PIDS+=($!)
PORT=9130 python3 /app/services/crop-yield-prediction-py/main.py &
PIDS+=($!)
PORT=9131 python3 /app/services/customer-insights-py/main.py &
PIDS+=($!)
PORT=9132 python3 /app/services/soil-analysis-py/main.py &
PIDS+=($!)

echo "[ai-ml-inference] All 4 services started (ports 9129-9132)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[ai-ml-inference] A service exited with code $EXIT_CODE"
cleanup
