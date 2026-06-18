#!/bin/bash
# 54Bank Consolidated Entrypoint — infra-observability
# Observability — monitoring, alerting, metrics, tracing, logging, APM
# Services: 10 | Ports: 9392-9401
set -e

echo "[infra-observability] Starting 10 services..."

PIDS=()

cleanup() {
  echo "[infra-observability] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[infra-observability] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9392 python3 /app/services/apm-sentry-py/main.py &
PIDS+=($!)
PORT=9393 python3 /app/services/changelog-generator-py/main.py &
PIDS+=($!)
PORT=9394 /app/services/corporate-monitoring-go/corporate-monitoring-go &
PIDS+=($!)
PORT=9395 python3 /app/services/error-telemetry-py/main.py &
PIDS+=($!)
PORT=9396 /app/services/incident-responder-go/incident-responder-go &
PIDS+=($!)
PORT=9397 /app/services/kpi-threshold-monitor-rs/kpi_threshold_monitor_rs &
PIDS+=($!)
PORT=9398 /app/services/otel-collector-go/otel-collector-go &
PIDS+=($!)
PORT=9399 python3 /app/services/siem-exporter-py/main.py &
PIDS+=($!)
PORT=9400 /app/services/txn-monitoring-rules-rs/txn_monitoring_rules_rs &
PIDS+=($!)
PORT=9401 /app/services/wire-transfer-monitor-rs/wire_transfer_monitor_rs &
PIDS+=($!)

echo "[infra-observability] All 10 services started (ports 9392-9401)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[infra-observability] A service exited with code $EXIT_CODE"
cleanup
