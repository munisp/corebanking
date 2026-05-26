#!/bin/bash
# 54Bank Consolidated Entrypoint — customer-pricing
# Pricing — fees, charges, tariffs, interest rates, rate cascades
# Services: 6 | Ports: 9309-9314
set -e

echo "[customer-pricing] Starting 6 services..."

PIDS=()

cleanup() {
  echo "[customer-pricing] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[customer-pricing] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9309 /app/services/aggregation-center-go/aggregation-center-go &
PIDS+=($!)
PORT=9310 /app/services/fee-management-go/fee-management-go &
PIDS+=($!)
PORT=9311 /app/services/product-factory-rs/product_factory_rs &
PIDS+=($!)
PORT=9312 /app/services/rate-cascade-rs/rate_cascade_rs &
PIDS+=($!)
PORT=9313 /app/services/realtime-pricing-rs/realtime_pricing_rs &
PIDS+=($!)
PORT=9314 /app/services/relationship-pricing-rs/relationship_pricing_rs &
PIDS+=($!)

echo "[customer-pricing] All 6 services started (ports 9309-9314)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[customer-pricing] A service exited with code $EXIT_CODE"
cleanup
