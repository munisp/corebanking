#!/bin/bash
# 54Bank Consolidated Entrypoint — platform-devops
# DevOps — feature flags, canary, rollout, A/B testing, config
# Services: 8 | Ports: 9442-9449
set -e

echo "[platform-devops] Starting 8 services..."

PIDS=()

cleanup() {
  echo "[platform-devops] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[platform-devops] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9442 python3 /app/services/ab-testing-py/main.py &
PIDS+=($!)
PORT=9443 python3 /app/services/certificate-manager-py/main.py &
PIDS+=($!)
PORT=9444 /app/services/feature-entitlement-go/feature-entitlement-go &
PIDS+=($!)
PORT=9445 /app/services/feature-flag-engine-rs/feature_flag_engine_rs &
PIDS+=($!)
PORT=9446 /app/services/flag-audit-rs/flag_audit_rs &
PIDS+=($!)
PORT=9447 /app/services/graduated-rollout-rs/graduated_rollout_rs &
PIDS+=($!)
PORT=9448 /app/services/hpa-autoscaler-go/hpa-autoscaler-go &
PIDS+=($!)
PORT=9449 /app/services/keda-scaler-go/keda-scaler-go &
PIDS+=($!)

echo "[platform-devops] All 8 services started (ports 9442-9449)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[platform-devops] A service exited with code $EXIT_CODE"
cleanup
