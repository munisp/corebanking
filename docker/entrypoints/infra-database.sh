#!/bin/bash
# 54Bank Consolidated Entrypoint — infra-database
# Database infra — Postgres, pgbouncer, migrations, backups, read replicas
# Services: 13 | Ports: 9347-9359
set -e

echo "[infra-database] Starting 13 services..."

PIDS=()

cleanup() {
  echo "[infra-database] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[infra-database] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9347 /app/services/avro-schema-registry-go/avro-schema-registry-go &
PIDS+=($!)
PORT=9348 python3 /app/services/backup-manager-py/main.py &
PIDS+=($!)
PORT=9349 /app/services/data-export-rs/data_export_rs &
PIDS+=($!)
PORT=9350 /app/services/db-migration-manager-go/db-migration-manager-go &
PIDS+=($!)
PORT=9352 /app/services/pgbouncer-manager-go/pgbouncer-manager-go &
PIDS+=($!)
PORT=9353 /app/services/postgres-adapter-go/postgres-adapter-go &
PIDS+=($!)
PORT=9354 /app/services/postgres-persistence-rs/postgres_persistence_rs &
PIDS+=($!)
PORT=9355 /app/services/postgres-query-optimizer-go/postgres-query-optimizer-go &
PIDS+=($!)
PORT=9356 python3 /app/services/postgres-vacuum-py/main.py &
PIDS+=($!)
PORT=9357 /app/services/read-replica-router-rs/read_replica_router_rs &
PIDS+=($!)
PORT=9358 /app/services/route-schema-enforcer-go/route-schema-enforcer-go &
PIDS+=($!)
PORT=9359 /app/services/table-partitioner-rs/table_partitioner_rs &
PIDS+=($!)

echo "[infra-database] All 13 services started (ports 9347-9359)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[infra-database] A service exited with code $EXIT_CODE"
cleanup
