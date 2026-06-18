#!/bin/bash
# 54Bank Consolidated Entrypoint — workflow-batch
# Workflow — batch processing, schedulers, Temporal, sagas, job queues
# Services: 9 | Ports: 9566-9574
set -e

echo "[workflow-batch] Starting 9 services..."

PIDS=()

cleanup() {
  echo "[workflow-batch] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[workflow-batch] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9566 /app/services/batch-aggregator-go/batch-aggregator-go &
PIDS+=($!)
PORT=9567 python3 /app/services/batch-processing-py/main.py &
PIDS+=($!)
PORT=9568 /app/services/e2e-orchestrator-go/e2e-orchestrator-go &
PIDS+=($!)
PORT=9569 python3 /app/services/saga-coordinator-py/main.py &
PIDS+=($!)
PORT=9570 /app/services/temporal-memoizer-go/temporal-memoizer-go &
PIDS+=($!)
PORT=9571 python3 /app/services/temporal-orchestrator-py/main.py &
PIDS+=($!)
PORT=9572 /app/services/temporal-sagas-go/temporal-sagas-go &
PIDS+=($!)
PORT=9573 /app/services/temporal-worker-go/temporal-worker-go &
PIDS+=($!)
PORT=9574 python3 /app/services/workflow-engine-py/main.py &
PIDS+=($!)

echo "[workflow-batch] All 9 services started (ports 9566-9574)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[workflow-batch] A service exited with code $EXIT_CODE"
cleanup
