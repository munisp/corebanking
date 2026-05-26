#!/bin/bash
# 54Bank Consolidated Entrypoint — compliance-risk
# Risk — scoring, assessment, credit risk, operational risk
# Services: 5 | Ports: 9245-9249
set -e

echo "[compliance-risk] Starting 5 services..."

PIDS=()

cleanup() {
  echo "[compliance-risk] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[compliance-risk] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9245 /app/services/contingent-liabilities-rs/contingent_liabilities_rs &
PIDS+=($!)
PORT=9246 python3 /app/services/risk-based-approach-py/main.py &
PIDS+=($!)
PORT=9247 /app/services/risk-scoring-rs/risk_scoring_rs &
PIDS+=($!)
PORT=9248 /app/services/tenant-provisioning-go/tenant-provisioning-go &
PIDS+=($!)
PORT=9249 python3 /app/services/tenant-provisioning-py/main.py &
PIDS+=($!)

echo "[compliance-risk] All 5 services started (ports 9245-9249)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[compliance-risk] A service exited with code $EXIT_CODE"
cleanup
