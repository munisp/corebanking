#!/bin/bash
# 54Bank Consolidated Entrypoint — core-deposits
# Deposits — savings, fixed deposits, current accounts, interest
# Services: 7 | Ports: 9267-9273
set -e

echo "[core-deposits] Starting 7 services..."

PIDS=()

cleanup() {
  echo "[core-deposits] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[core-deposits] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9267 /app/services/agri-savings-cycles-go/agri-savings-cycles-go &
PIDS+=($!)
PORT=9268 /app/services/interest-accrual-engine-go/interest-accrual-engine-go &
PIDS+=($!)
PORT=9269 /app/services/interest-computation-rs/interest_computation_rs &
PIDS+=($!)
PORT=9270 /app/services/interest-rate-engine-go/interest-rate-engine-go &
PIDS+=($!)
PORT=9271 /app/services/safe-deposit-go/safe-deposit-go &
PIDS+=($!)
PORT=9272 /app/services/savings-products-go/savings-products-go &
PIDS+=($!)
PORT=9273 python3 /app/services/savings-products-py/main.py &
PIDS+=($!)

echo "[core-deposits] All 7 services started (ports 9267-9273)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[core-deposits] A service exited with code $EXIT_CODE"
cleanup
