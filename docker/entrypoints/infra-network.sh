#!/bin/bash
# 54Bank Consolidated Entrypoint — infra-network
# Network — rate limiting, circuit breaker, gRPC, HTTP/2, TLS, load balancing
# Services: 15 | Ports: 9376-9390
set -e

echo "[infra-network] Starting 15 services..."

PIDS=()

cleanup() {
  echo "[infra-network] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[infra-network] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9376 /app/services/adaptive-rate-limiter-rs/adaptive_rate_limiter_rs &
PIDS+=($!)
PORT=9377 /app/services/circuit-breaker-rs/circuit_breaker_rs &
PIDS+=($!)
PORT=9378 /app/services/connection-pooler-rs/connection_pooler_rs &
PIDS+=($!)
PORT=9379 /app/services/egress-controller-rs/egress_controller_rs &
PIDS+=($!)
PORT=9380 /app/services/express-rate-limiter-rs/express_rate_limiter_rs &
PIDS+=($!)
PORT=9381 /app/services/grpc-gateway-rs/grpc_gateway_rs &
PIDS+=($!)
PORT=9382 /app/services/grpc-hot-path-go/grpc-hot-path-go &
PIDS+=($!)
PORT=9383 /app/services/http2-multiplexer-rs/http2_multiplexer_rs &
PIDS+=($!)
PORT=9384 /app/services/keepalive-tuner-rs/keepalive_tuner_rs &
PIDS+=($!)
PORT=9385 /app/services/mtls-mesh-rs/mtls_mesh_rs &
PIDS+=($!)
PORT=9386 python3 /app/services/network-policy-manager-py/main.py &
PIDS+=($!)
PORT=9387 /app/services/path-validator-rs/path_validator_rs &
PIDS+=($!)
PORT=9388 python3 /app/services/request-validator-py/main.py &
PIDS+=($!)
PORT=9389 /app/services/route-trie-optimizer-rs/route_trie_optimizer_rs &
PIDS+=($!)
PORT=9390 /app/services/tls-terminator-go/tls-terminator-go &
PIDS+=($!)

echo "[infra-network] All 15 services started (ports 9376-9390)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[infra-network] A service exited with code $EXIT_CODE"
cleanup
