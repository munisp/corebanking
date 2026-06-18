#!/bin/bash
# 54Bank Consolidated Entrypoint — trade-fx
# Trade & FX — trade finance, forex, remittance, SWIFT, cross-border
# Services: 9 | Ports: 9530-9538
set -e

echo "[trade-fx] Starting 9 services..."

PIDS=()

cleanup() {
  echo "[trade-fx] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[trade-fx] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9530 python3 /app/services/diaspora-banking-py/main.py &
PIDS+=($!)
PORT=9531 python3 /app/services/enaira-cbdc-py/main.py &
PIDS+=($!)
PORT=9532 /app/services/fx-rates-engine-rs/fx_rates_engine_rs &
PIDS+=($!)
PORT=9533 /app/services/iso20022-hub-rs/iso20022_hub_rs &
PIDS+=($!)
PORT=9534 /app/services/remittance-go/remittance-go &
PIDS+=($!)
PORT=9535 /app/services/swift-iso20022-rs/swift_iso20022_rs &
PIDS+=($!)
PORT=9536 /app/services/swift-messaging-go/swift-messaging-go &
PIDS+=($!)
PORT=9537 /app/services/trade-finance-gl-go/trade-finance-gl-go &
PIDS+=($!)
PORT=9538 /app/services/trade-finance-go/trade-finance-go &
PIDS+=($!)

echo "[trade-fx] All 9 services started (ports 9530-9538)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[trade-fx] A service exited with code $EXIT_CODE"
cleanup
