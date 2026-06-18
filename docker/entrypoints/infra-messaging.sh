#!/bin/bash
# 54Bank Consolidated Entrypoint — infra-messaging
# Messaging infra — Kafka, Fluvio, event sourcing, CDC, pub/sub
# Services: 14 | Ports: 9361-9374
set -e

echo "[infra-messaging] Starting 14 services..."

PIDS=()

cleanup() {
  echo "[infra-messaging] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[infra-messaging] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9361 python3 /app/services/billing-event-processor-py/main.py &
PIDS+=($!)
PORT=9362 /app/services/event-bus-go/event-bus-go &
PIDS+=($!)
PORT=9363 python3 /app/services/event-correlator-py/main.py &
PIDS+=($!)
PORT=9364 /app/services/event-dedup-engine-rs/event_dedup_engine_rs &
PIDS+=($!)
PORT=9365 /app/services/event-sourcing-go/event-sourcing-go &
PIDS+=($!)
PORT=9366 /app/services/event-streaming-go/event-streaming-go &
PIDS+=($!)
PORT=9367 /app/services/fluvio-streams-rs/fluvio_streams_rs &
PIDS+=($!)
PORT=9368 /app/services/fluvio-wasm-transform-rs/fluvio_wasm_transform_rs &
PIDS+=($!)
PORT=9369 /app/services/kafka-batch-producer-rs/kafka_batch_producer_rs &
PIDS+=($!)
PORT=9370 /app/services/kafka-broker-go/kafka-broker-go &
PIDS+=($!)
PORT=9371 /app/services/kafka-consumer-optimizer-go/kafka-consumer-optimizer-go &
PIDS+=($!)
PORT=9372 /app/services/kafka-schema-registry-go/kafka-schema-registry-go &
PIDS+=($!)
PORT=9373 /app/services/kafka-streaming-go/kafka-streaming-go &
PIDS+=($!)
PORT=9374 /app/services/stream-response-go/stream-response-go &
PIDS+=($!)

echo "[infra-messaging] All 14 services started (ports 9361-9374)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[infra-messaging] A service exited with code $EXIT_CODE"
cleanup
