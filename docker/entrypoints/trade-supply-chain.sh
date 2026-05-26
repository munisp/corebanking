#!/bin/bash
# 54Bank Consolidated Entrypoint — trade-supply-chain
# Supply chain — factoring, leasing, escrow, project finance
# Services: 9 | Ports: 9540-9548
set -e

echo "[trade-supply-chain] Starting 9 services..."

PIDS=()

cleanup() {
  echo "[trade-supply-chain] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[trade-supply-chain] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9540 /app/services/bank-guarantees-go/bank-guarantees-go &
PIDS+=($!)
PORT=9541 /app/services/equipment-leasing-go/equipment-leasing-go &
PIDS+=($!)
PORT=9542 /app/services/escrow-go/escrow-go &
PIDS+=($!)
PORT=9543 /app/services/factoring-go/factoring-go &
PIDS+=($!)
PORT=9544 /app/services/leasing-go/leasing-go &
PIDS+=($!)
PORT=9545 /app/services/locker-go/locker-go &
PIDS+=($!)
PORT=9546 /app/services/project-finance-go/project-finance-go &
PIDS+=($!)
PORT=9547 /app/services/supply-chain-finance-go/supply-chain-finance-go &
PIDS+=($!)
PORT=9548 /app/services/trust-estate-rs/trust_estate_rs &
PIDS+=($!)

echo "[trade-supply-chain] All 9 services started (ports 9540-9548)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[trade-supply-chain] A service exited with code $EXIT_CODE"
cleanup
