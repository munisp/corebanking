#!/bin/bash
# 54Bank Consolidated Entrypoint — platform-tenant
# Multi-tenant — provisioning, billing, metering, isolation, white-label
# Services: 12 | Ports: 9451-9462
set -e

echo "[platform-tenant] Starting 12 services..."

PIDS=()

cleanup() {
  echo "[platform-tenant] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[platform-tenant] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9451 /app/services/billing-enforcement-rs/billing_enforcement_rs &
PIDS+=($!)
PORT=9452 /app/services/billing-ingestor-go/billing-ingestor-go &
PIDS+=($!)
PORT=9453 /app/services/billing-orchestrator-go/billing-orchestrator-go &
PIDS+=($!)
PORT=9454 /app/services/billing-rating-rs/billing_rating_rs &
PIDS+=($!)
PORT=9455 /app/services/multi-entity-go/multi-entity-go &
PIDS+=($!)
PORT=9456 /app/services/tenant-billing-go/tenant-billing-go &
PIDS+=($!)
PORT=9457 /app/services/tenant-export-go/tenant-export-go &
PIDS+=($!)
PORT=9458 /app/services/tenant-isolation-go/tenant-isolation-go &
PIDS+=($!)
PORT=9459 python3 /app/services/tenant-management-py/main.py &
PIDS+=($!)
PORT=9460 /app/services/tenant-metering-go/tenant-metering-go &
PIDS+=($!)
PORT=9461 /app/services/tenant-ratelimit-rs/tenant_ratelimit_rs &
PIDS+=($!)
PORT=9462 /app/services/white-label-engine-go/white-label-engine-go &
PIDS+=($!)

echo "[platform-tenant] All 12 services started (ports 9451-9462)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[platform-tenant] A service exited with code $EXIT_CODE"
cleanup
