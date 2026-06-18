#!/bin/bash
# 54Bank Consolidated Entrypoint — specialized-engagement
# Engagement — gamification, loyalty, rewards, referrals, cashback
# Services: 6 | Ports: 9516-9521
set -e

echo "[specialized-engagement] Starting 6 services..."

PIDS=()

cleanup() {
  echo "[specialized-engagement] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[specialized-engagement] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9516 python3 /app/services/component-memoizer-py/main.py &
PIDS+=($!)
PORT=9517 /app/services/growth-features-go/growth-features-go &
PIDS+=($!)
PORT=9518 /app/services/optimistic-ui-engine-go/optimistic-ui-engine-go &
PIDS+=($!)
PORT=9519 /app/services/skeleton-loading-rs/skeleton_loading_rs &
PIDS+=($!)
PORT=9520 /app/services/sorted-set-ranking-go/sorted-set-ranking-go &
PIDS+=($!)
PORT=9521 /app/services/virtual-scroll-engine-rs/virtual_scroll_engine_rs &
PIDS+=($!)

echo "[specialized-engagement] All 6 services started (ports 9516-9521)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[specialized-engagement] A service exited with code $EXIT_CODE"
cleanup
