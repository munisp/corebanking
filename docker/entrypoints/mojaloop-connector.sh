#!/bin/bash
# 54Bank Consolidated Entrypoint — mojaloop-connector
# Mojaloop — DFSP connector, PISP, FSPIOP, settlement, TB bridge
# Services: 7 | Ports: 9420-9426
set -e

echo "[mojaloop-connector] Starting 7 services..."

PIDS=()

cleanup() {
  echo "[mojaloop-connector] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[mojaloop-connector] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9420 /app/services/mojaloop-admin-go/mojaloop-admin-go &
PIDS+=($!)
PORT=9421 /app/services/mojaloop-connector-go/mojaloop-connector-go &
PIDS+=($!)
PORT=9422 python3 /app/services/mojaloop-crossborder-py/main.py &
PIDS+=($!)
PORT=9423 /app/services/mojaloop-fspiop-callbacks-rs/mojaloop_fspiop_callbacks_rs &
PIDS+=($!)
PORT=9424 /app/services/mojaloop-pisp-go/mojaloop-pisp-go &
PIDS+=($!)
PORT=9425 python3 /app/services/mojaloop-protocol-py/main.py &
PIDS+=($!)
PORT=9426 /app/services/mojaloop-tb-bridge-rs/mojaloop_tb_bridge_rs &
PIDS+=($!)

echo "[mojaloop-connector] All 7 services started (ports 9420-9426)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[mojaloop-connector] A service exited with code $EXIT_CODE"
cleanup
