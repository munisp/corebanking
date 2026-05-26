#!/bin/bash
# 54Bank Consolidated Entrypoint — infra-caching
# Caching — Redis, bloom filter, hot data, cache invalidation
# Services: 11 | Ports: 9335-9345
set -e

echo "[infra-caching] Starting 11 services..."

PIDS=()

cleanup() {
  echo "[infra-caching] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[infra-caching] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9335 /app/services/bloom-filter-cache-rs/bloom_filter_cache_rs &
PIDS+=($!)
PORT=9336 /app/services/cache-invalidation-rs/cache_invalidation_rs &
PIDS+=($!)
PORT=9337 /app/services/cdn-edge-cache-go/cdn-edge-cache-go &
PIDS+=($!)
PORT=9338 /app/services/hot-data-cache-rs/hot_data_cache_rs &
PIDS+=($!)
PORT=9339 /app/services/postgres-query-cache-rs/postgres_query_cache_rs &
PIDS+=($!)
PORT=9340 /app/services/prepared-stmt-cache-go/prepared-stmt-cache-go &
PIDS+=($!)
PORT=9341 /app/services/query-cache-engine-rs/query_cache_engine_rs &
PIDS+=($!)
PORT=9342 /app/services/redis-cache-middleware-rs/redis_cache_middleware_rs &
PIDS+=($!)
PORT=9343 /app/services/redis-cache-rs/redis_cache_rs &
PIDS+=($!)
PORT=9344 /app/services/redis-session-store-go/redis-session-store-go &
PIDS+=($!)
PORT=9345 /app/services/sw-api-cache-go/sw-api-cache-go &
PIDS+=($!)

echo "[infra-caching] All 11 services started (ports 9335-9345)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[infra-caching] A service exited with code $EXIT_CODE"
cleanup
