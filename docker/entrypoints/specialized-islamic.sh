#!/bin/bash
# 54Bank Consolidated Entrypoint — specialized-islamic
# Islamic & specialized — murabaha, sukuk, takaful, pension, insurance, diaspora
# Services: 6 | Ports: 9523-9528
set -e

echo "[specialized-islamic] Starting 6 services..."

PIDS=()

cleanup() {
  echo "[specialized-islamic] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[specialized-islamic] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9523 python3 /app/services/area-yield-index-insurance-py/main.py &
PIDS+=($!)
PORT=9524 python3 /app/services/exam-management-py/main.py &
PIDS+=($!)
PORT=9525 python3 /app/services/insurance-py/main.py &
PIDS+=($!)
PORT=9526 python3 /app/services/islamic-banking-py/main.py &
PIDS+=($!)
PORT=9527 /app/services/parametric-insurance-iot-rs/parametric_insurance_iot_rs &
PIDS+=($!)
PORT=9528 python3 /app/services/pension-py/main.py &
PIDS+=($!)

echo "[specialized-islamic] All 6 services started (ports 9523-9528)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[specialized-islamic] A service exited with code $EXIT_CODE"
cleanup
