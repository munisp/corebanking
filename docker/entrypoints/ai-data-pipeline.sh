#!/bin/bash
# 54Bank Consolidated Entrypoint — ai-data-pipeline
# Data pipeline — lakehouse, ETL, CDC, analytics, insights
# Services: 4 | Ports: 9100-9103
set -e

echo "[ai-data-pipeline] Starting 4 services..."

PIDS=()

cleanup() {
  echo "[ai-data-pipeline] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[ai-data-pipeline] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9100 python3 /app/services/document-intelligence-py/main.py &
PIDS+=($!)
PORT=9101 python3 /app/services/lakehouse-etl-py/main.py &
PIDS+=($!)
PORT=9102 /app/services/lakehouse-rs/lakehouse_rs &
PIDS+=($!)
PORT=9103 /app/services/materialized-view-engine-go/materialized-view-engine-go &
PIDS+=($!)

echo "[ai-data-pipeline] All 4 services started (ports 9100-9103)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[ai-data-pipeline] A service exited with code $EXIT_CODE"
cleanup
