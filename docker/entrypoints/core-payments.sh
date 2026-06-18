#!/bin/bash
# 54Bank Consolidated Entrypoint — core-payments
# Payments — transfers, bills, bulk, NIBSS, NIP, cheques, standing orders
# Services: 12 | Ports: 9290-9301
set -e

echo "[core-payments] Starting 12 services..."

PIDS=()

cleanup() {
  echo "[core-payments] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[core-payments] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9290 /app/services/beneficiary-management-go/beneficiary-management-go &
PIDS+=($!)
PORT=9291 /app/services/bulk-payments-rs/bulk_payments_rs &
PIDS+=($!)
PORT=9292 /app/services/cheque-clearing-go/cheque-clearing-go &
PIDS+=($!)
PORT=9293 /app/services/mandate-management-go/mandate-management-go &
PIDS+=($!)
PORT=9294 /app/services/nibss-direct-debit-go/nibss-direct-debit-go &
PIDS+=($!)
PORT=9295 /app/services/nibss-nip-engine-go/nibss-nip-engine-go &
PIDS+=($!)
PORT=9296 /app/services/payment-investigation-go/payment-investigation-go &
PIDS+=($!)
PORT=9297 /app/services/payments-hub-go/payments-hub-go &
PIDS+=($!)
PORT=9298 /app/services/qr-payments-go/qr-payments-go &
PIDS+=($!)
PORT=9299 /app/services/standing-orders-go/standing-orders-go &
PIDS+=($!)
PORT=9300 /app/services/utility-payments-go/utility-payments-go &
PIDS+=($!)
PORT=9301 /app/services/whatsapp-payment-integration-go/whatsapp-payment-integration-go &
PIDS+=($!)

echo "[core-payments] All 12 services started (ports 9290-9301)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[core-payments] A service exited with code $EXIT_CODE"
cleanup
