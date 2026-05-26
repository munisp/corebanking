#!/bin/bash
# 54Bank Consolidated Entrypoint — platform-api
# API platform — gateway, marketplace, developer portal, sandbox, webhooks
# Services: 13 | Ports: 9428-9440
set -e

echo "[platform-api] Starting 13 services..."

PIDS=()

cleanup() {
  echo "[platform-api] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[platform-api] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9428 /app/services/api-key-enforcer-go/api-key-enforcer-go &
PIDS+=($!)
PORT=9429 /app/services/api-key-vault-go/api-key-vault-go &
PIDS+=($!)
PORT=9430 /app/services/api-marketplace-go/api-marketplace-go &
PIDS+=($!)
PORT=9431 /app/services/api-versioning-go/api-versioning-go &
PIDS+=($!)
PORT=9432 /app/services/apisix-gateway-go/apisix-gateway-go &
PIDS+=($!)
PORT=9433 /app/services/apisix-plugin-optimizer-go/apisix-plugin-optimizer-go &
PIDS+=($!)
PORT=9434 python3 /app/services/bundle-splitter-py/main.py &
PIDS+=($!)
PORT=9435 /app/services/cors-gateway-go/cors-gateway-go &
PIDS+=($!)
PORT=9436 /app/services/dapr-sidecar-go/dapr-sidecar-go &
PIDS+=($!)
PORT=9437 /app/services/graphql-gateway-go/graphql-gateway-go &
PIDS+=($!)
PORT=9438 python3 /app/services/plugin-marketplace-py/main.py &
PIDS+=($!)
PORT=9439 /app/services/security-gateway-go/security-gateway-go &
PIDS+=($!)
PORT=9440 /app/services/webhook-engine-go/webhook-engine-go &
PIDS+=($!)

echo "[platform-api] All 13 services started (ports 9428-9440)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[platform-api] A service exited with code $EXIT_CODE"
cleanup
