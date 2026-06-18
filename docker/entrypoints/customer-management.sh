#!/bin/bash
# 54Bank Consolidated Entrypoint — customer-management
# Customer — CRM, 360 view, segmentation, lifecycle, engagement
# Services: 5 | Ports: 9303-9307
set -e

echo "[customer-management] Starting 5 services..."

PIDS=()

cleanup() {
  echo "[customer-management] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[customer-management] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9303 python3 /app/services/customer-360-py/main.py &
PIDS+=($!)
PORT=9304 python3 /app/services/customer-engagement-py/main.py &
PIDS+=($!)
PORT=9305 python3 /app/services/customer-feedback-py/main.py &
PIDS+=($!)
PORT=9306 /app/services/expense-mgmt-go/expense-mgmt-go &
PIDS+=($!)
PORT=9307 /app/services/i18n-service-go/i18n-service-go &
PIDS+=($!)

echo "[customer-management] All 5 services started (ports 9303-9307)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[customer-management] A service exited with code $EXIT_CODE"
cleanup
