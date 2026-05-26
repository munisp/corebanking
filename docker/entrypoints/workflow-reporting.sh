#!/bin/bash
# 54Bank Consolidated Entrypoint — workflow-reporting
# Reporting — dashboards, KPIs, analytics, business intelligence
# Services: 11 | Ports: 9625-9635
set -e

echo "[workflow-reporting] Starting 11 services..."

PIDS=()

cleanup() {
  echo "[workflow-reporting] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[workflow-reporting] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9625 python3 /app/services/analytics-engine-py/main.py &
PIDS+=($!)
PORT=9626 python3 /app/services/api-analytics-py/main.py &
PIDS+=($!)
PORT=9627 python3 /app/services/billing-analytics-py/main.py &
PIDS+=($!)
PORT=9628 python3 /app/services/customer-360-dashboard-py/main.py &
PIDS+=($!)
PORT=9629 python3 /app/services/document-management-py/main.py &
PIDS+=($!)
PORT=9630 python3 /app/services/kpi-analytics-py/main.py &
PIDS+=($!)
PORT=9631 /app/services/kpi-engine-go/kpi-engine-go &
PIDS+=($!)
PORT=9632 python3 /app/services/opensearch-analytics-py/main.py &
PIDS+=($!)
PORT=9633 python3 /app/services/prometheus-dashboard-py/main.py &
PIDS+=($!)
PORT=9634 python3 /app/services/stakeholder-kpi-dashboard-py/main.py &
PIDS+=($!)
PORT=9635 python3 /app/services/statement-generator-py/main.py &
PIDS+=($!)

echo "[workflow-reporting] All 11 services started (ports 9625-9635)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[workflow-reporting] A service exited with code $EXIT_CODE"
cleanup
