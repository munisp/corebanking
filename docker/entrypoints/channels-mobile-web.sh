#!/bin/bash
# 54Bank Consolidated Entrypoint — channels-mobile-web
# Mobile/Web — open banking, BaaS, developer portal, webhooks
# Services: 4 | Ports: 9160-9163
set -e

echo "[channels-mobile-web] Starting 4 services..."

PIDS=()

cleanup() {
  echo "[channels-mobile-web] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[channels-mobile-web] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9160 /app/services/custom-domain-go/custom-domain-go &
PIDS+=($!)
PORT=9161 /app/services/developer-portal-go/developer-portal-go &
PIDS+=($!)
PORT=9162 /app/services/open-banking-baas-go/open-banking-baas-go &
PIDS+=($!)
PORT=9163 /app/services/open-banking-go/open-banking-go &
PIDS+=($!)

echo "[channels-mobile-web] All 4 services started (ports 9160-9163)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[channels-mobile-web] A service exited with code $EXIT_CODE"
cleanup
