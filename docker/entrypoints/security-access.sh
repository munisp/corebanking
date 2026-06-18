#!/bin/bash
# 54Bank Consolidated Entrypoint — security-access
# Access control — Permify, RBAC, PBAC, maker-checker, approval
# Services: 5 | Ports: 9464-9468
set -e

echo "[security-access] Starting 5 services..."

PIDS=()

cleanup() {
  echo "[security-access] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[security-access] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9464 /app/services/approval-workflow-go/approval-workflow-go &
PIDS+=($!)
PORT=9465 /app/services/billing-rbac-rs/billing_rbac_rs &
PIDS+=($!)
PORT=9466 /app/services/maker-checker-go/maker-checker-go &
PIDS+=($!)
PORT=9467 /app/services/pbac-engine-rs/pbac_engine_rs &
PIDS+=($!)
PORT=9468 /app/services/permify-authz-go/permify-authz-go &
PIDS+=($!)

echo "[security-access] All 5 services started (ports 9464-9468)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[security-access] A service exited with code $EXIT_CODE"
cleanup
