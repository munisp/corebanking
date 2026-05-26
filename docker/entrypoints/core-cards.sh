#!/bin/bash
# 54Bank Consolidated Entrypoint — core-cards
# Cards — issuance, PIN, POS, ATM, tokenization, contactless
# Services: 7 | Ports: 9259-9265
set -e

echo "[core-cards] Starting 7 services..."

PIDS=()

cleanup() {
  echo "[core-cards] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[core-cards] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9259 /app/services/atm-management-go/atm-management-go &
PIDS+=($!)
PORT=9260 /app/services/card-management-go/card-management-go &
PIDS+=($!)
PORT=9261 /app/services/grid-token-card-go/grid-token-card-go &
PIDS+=($!)
PORT=9262 /app/services/pin-block-engine-rs/pin_block_engine_rs &
PIDS+=($!)
PORT=9263 /app/services/pin-hasher-rs/pin_hasher_rs &
PIDS+=($!)
PORT=9264 /app/services/pos-terminal-go/pos-terminal-go &
PIDS+=($!)
PORT=9265 /app/services/scratch-card-pin-go/scratch-card-pin-go &
PIDS+=($!)

echo "[core-cards] All 7 services started (ports 9259-9265)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[core-cards] A service exited with code $EXIT_CODE"
cleanup
