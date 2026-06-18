#!/bin/bash
# 54Bank Consolidated Entrypoint — core-accounts
# Account lifecycle — opening, closure, statements, dormancy, reactivation
# Services: 7 | Ports: 9251-9257
set -e

echo "[core-accounts] Starting 7 services..."

PIDS=()

cleanup() {
  echo "[core-accounts] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[core-accounts] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9251 /app/services/account-closure-go/account-closure-go &
PIDS+=($!)
PORT=9252 /app/services/account-opening-go/account-opening-go &
PIDS+=($!)
PORT=9253 /app/services/account-statement-go/account-statement-go &
PIDS+=($!)
PORT=9254 python3 /app/services/agent-account-opening-py/main.py &
PIDS+=($!)
PORT=9255 /app/services/cif-management-go/cif-management-go &
PIDS+=($!)
PORT=9256 /app/services/dormancy-management-rs/dormancy_management_rs &
PIDS+=($!)
PORT=9257 /app/services/virtual-accounts-go/virtual-accounts-go &
PIDS+=($!)

echo "[core-accounts] All 7 services started (ports 9251-9257)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[core-accounts] A service exited with code $EXIT_CODE"
cleanup
