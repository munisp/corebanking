#!/bin/bash
# 54Bank Consolidated Entrypoint — channels-agents
# AI Agents — conversational banking agents
# Services: 8 | Ports: 9134-9141
set -e

echo "[channels-agents] Starting 8 services..."

PIDS=()

cleanup() {
  echo "[channels-agents] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[channels-agents] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9134 /app/services/agent-banking-go/agent-banking-go &
PIDS+=($!)
PORT=9135 python3 /app/services/agent-cash-management-py/main.py &
PIDS+=($!)
PORT=9136 python3 /app/services/agent-customer-360-py/main.py &
PIDS+=($!)
PORT=9137 python3 /app/services/agent-dormancy-prevention-py/main.py &
PIDS+=($!)
PORT=9138 /app/services/agent-farmer-onboarding-go/agent-farmer-onboarding-go &
PIDS+=($!)
PORT=9139 python3 /app/services/agent-nl-reporting-py/main.py &
PIDS+=($!)
PORT=9140 python3 /app/services/agent-reconciliation-py/main.py &
PIDS+=($!)
PORT=9141 python3 /app/services/agent-transaction-investigation-py/main.py &
PIDS+=($!)

echo "[channels-agents] All 8 services started (ports 9134-9141)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[channels-agents] A service exited with code $EXIT_CODE"
cleanup
