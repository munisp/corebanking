#!/bin/bash
# 54Bank Consolidated Entrypoint — ledger-reconciliation
# Reconciliation — settlement, clearing, recon engine, suspense
# Services: 5 | Ports: 9414-9418
set -e

echo "[ledger-reconciliation] Starting 5 services..."

PIDS=()

cleanup() {
  echo "[ledger-reconciliation] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[ledger-reconciliation] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9414 /app/services/banking-clearing-ops-rs/banking_clearing_ops_rs &
PIDS+=($!)
PORT=9415 /app/services/ledger-reconciliation-rs/ledger_reconciliation_rs &
PIDS+=($!)
PORT=9416 /app/services/mojaloop-settlement-mgr-go/mojaloop-settlement-mgr-go &
PIDS+=($!)
PORT=9417 /app/services/recon-engine-rs/recon_engine_rs &
PIDS+=($!)
PORT=9418 /app/services/reconciliation-engine-rs/reconciliation_engine_rs &
PIDS+=($!)

echo "[ledger-reconciliation] All 5 services started (ports 9414-9418)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[ledger-reconciliation] A service exited with code $EXIT_CODE"
cleanup
