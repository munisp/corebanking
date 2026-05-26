#!/bin/bash
# 54Bank Consolidated Entrypoint — treasury-investments
# Treasury — liquidity, money market, bonds, securities, commodities
# Services: 15 | Ports: 9550-9564
set -e

echo "[treasury-investments] Starting 15 services..."

PIDS=()

cleanup() {
  echo "[treasury-investments] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[treasury-investments] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9550 /app/services/cash-pooling-go/cash-pooling-go &
PIDS+=($!)
PORT=9551 /app/services/commodity-exchange-rs/commodity_exchange_rs &
PIDS+=($!)
PORT=9552 python3 /app/services/commodity-price-intelligence-py/main.py &
PIDS+=($!)
PORT=9553 /app/services/custody-service-go/custody-service-go &
PIDS+=($!)
PORT=9554 /app/services/etd-trading-rs/etd_trading_rs &
PIDS+=($!)
PORT=9555 python3 /app/services/insurance-portfolio-analytics-py/main.py &
PIDS+=($!)
PORT=9556 /app/services/money-market-rs/money_market_rs &
PIDS+=($!)
PORT=9557 /app/services/multicurrency-revaluation-rs/multicurrency_revaluation_rs &
PIDS+=($!)
PORT=9558 /app/services/otc-derivatives-rs/otc_derivatives_rs &
PIDS+=($!)
PORT=9559 /app/services/portfolio-mgmt-rs/portfolio_mgmt_rs &
PIDS+=($!)
PORT=9560 /app/services/securities-trading-rs/securities_trading_rs &
PIDS+=($!)
PORT=9561 /app/services/tigerbeetle-multicurrency-rs/tigerbeetle_multicurrency_rs &
PIDS+=($!)
PORT=9562 python3 /app/services/treasury-liquidity-py/main.py &
PIDS+=($!)
PORT=9563 /app/services/treasury-liquidity-rs/treasury_liquidity_rs &
PIDS+=($!)
PORT=9564 python3 /app/services/wealth-mgmt-py/main.py &
PIDS+=($!)

echo "[treasury-investments] All 15 services started (ports 9550-9564)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[treasury-investments] A service exited with code $EXIT_CODE"
cleanup
