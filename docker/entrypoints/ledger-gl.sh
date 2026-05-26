#!/bin/bash
# 54Bank Consolidated Entrypoint — ledger-gl
# General Ledger — GL, CoA, journal entries, trial balance, TigerBeetle
# Services: 10 | Ports: 9403-9412
set -e

echo "[ledger-gl] Starting 10 services..."

PIDS=()

cleanup() {
  echo "[ledger-gl] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[ledger-gl] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9403 /app/services/accounting-rules-rs/accounting_rules_rs &
PIDS+=($!)
PORT=9404 /app/services/gl-engine-go/gl-engine-go &
PIDS+=($!)
PORT=9405 /app/services/gl-engine-rs/gl_engine_rs &
PIDS+=($!)
PORT=9406 /app/services/operations-control-gl-rs/operations_control_gl_rs &
PIDS+=($!)
PORT=9407 /app/services/salary-processing-go/salary-processing-go &
PIDS+=($!)
PORT=9408 /app/services/tigerbeetle-adapter-rs/tigerbeetle_adapter_rs &
PIDS+=($!)
PORT=9409 /app/services/tigerbeetle-batch-engine-rs/tigerbeetle_batch_engine_rs &
PIDS+=($!)
PORT=9410 /app/services/tigerbeetle-ledger-rs/tigerbeetle_ledger_rs &
PIDS+=($!)
PORT=9411 /app/services/tigerbeetle-protocol-rs/tigerbeetle_protocol_rs &
PIDS+=($!)
PORT=9412 /app/services/tigerbeetle-sync-go/tigerbeetle-sync-go &
PIDS+=($!)

echo "[ledger-gl] All 10 services started (ports 9403-9412)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[ledger-gl] A service exited with code $EXIT_CODE"
cleanup
