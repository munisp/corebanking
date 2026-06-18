#!/bin/bash
# 54Bank Consolidated Entrypoint — core-lending
# Lending — loans, credit, BNPL, mortgage, overdraft, microfinance
# Services: 14 | Ports: 9275-9288
set -e

echo "[core-lending] Starting 14 services..."

PIDS=()

cleanup() {
  echo "[core-lending] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[core-lending] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9275 python3 /app/services/agent-loan-origination-py/main.py &
PIDS+=($!)
PORT=9276 /app/services/collateral-valuation-rs/collateral_valuation_rs &
PIDS+=($!)
PORT=9277 python3 /app/services/cooperative-credit-scoring-py/main.py &
PIDS+=($!)
PORT=9278 python3 /app/services/credit-scoring-py/main.py &
PIDS+=($!)
PORT=9279 /app/services/debt-collection-go/debt-collection-go &
PIDS+=($!)
PORT=9280 python3 /app/services/education-loans-py/main.py &
PIDS+=($!)
PORT=9281 /app/services/group-lending-go/group-lending-go &
PIDS+=($!)
PORT=9282 /app/services/interbank-lending-rs/interbank_lending_rs &
PIDS+=($!)
PORT=9283 /app/services/loan-calculator-go/loan-calculator-go &
PIDS+=($!)
PORT=9284 /app/services/loan-origination-go/loan-origination-go &
PIDS+=($!)
PORT=9285 /app/services/microfinance-engine-go/microfinance-engine-go &
PIDS+=($!)
PORT=9286 python3 /app/services/microfinance-py/main.py &
PIDS+=($!)
PORT=9287 /app/services/mortgage-servicing-rs/mortgage_servicing_rs &
PIDS+=($!)
PORT=9288 /app/services/syndicated-loans-go/syndicated-loans-go &
PIDS+=($!)

echo "[core-lending] All 14 services started (ports 9275-9288)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[core-lending] A service exited with code $EXIT_CODE"
cleanup
