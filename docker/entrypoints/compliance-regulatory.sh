#!/bin/bash
# 54Bank Consolidated Entrypoint — compliance-regulatory
# Regulatory — CBN returns, NFIU, NDIC, EFASS, Basel, IFRS9
# Services: 21 | Ports: 9223-9243
set -e

echo "[compliance-regulatory] Starting 21 services..."

PIDS=()

cleanup() {
  echo "[compliance-regulatory] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[compliance-regulatory] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9223 python3 /app/services/agent-regulatory-returns-py/main.py &
PIDS+=($!)
PORT=9224 /app/services/basel-engine-rs/basel_engine_rs &
PIDS+=($!)
PORT=9225 python3 /app/services/cbn-agri-returns-py/main.py &
PIDS+=($!)
PORT=9226 /app/services/cbn-agsmeis-go/cbn-agsmeis-go &
PIDS+=($!)
PORT=9227 /app/services/cbn-anchor-borrowers-go/cbn-anchor-borrowers-go &
PIDS+=($!)
PORT=9228 python3 /app/services/cbn-compliance-checker-py/main.py &
PIDS+=($!)
PORT=9229 python3 /app/services/cbn-returns-py/main.py &
PIDS+=($!)
PORT=9230 /app/services/ctr-auto-filer-go/ctr-auto-filer-go &
PIDS+=($!)
PORT=9231 /app/services/efass-generator-rs/efass_generator_rs &
PIDS+=($!)
PORT=9232 /app/services/fatca-crs-rs/fatca_crs_rs &
PIDS+=($!)
PORT=9233 python3 /app/services/gl-regulatory-pipeline-py/main.py &
PIDS+=($!)
PORT=9234 /app/services/ifrs9-ecl-engine-rs/ifrs9_ecl_engine_rs &
PIDS+=($!)
PORT=9235 /app/services/ifrs9-engine-rs/ifrs9_engine_rs &
PIDS+=($!)
PORT=9236 /app/services/lcr-nsfr-rs/lcr_nsfr_rs &
PIDS+=($!)
PORT=9237 python3 /app/services/nfiu-ctr-str-filing-py/main.py &
PIDS+=($!)
PORT=9238 python3 /app/services/regulatory-automation-py/main.py &
PIDS+=($!)
PORT=9239 /app/services/regulatory-reporting-go/regulatory-reporting-go &
PIDS+=($!)
PORT=9240 python3 /app/services/regulatory-reporting-py/main.py &
PIDS+=($!)
PORT=9241 /app/services/regulatory-sandbox-go/regulatory-sandbox-go &
PIDS+=($!)
PORT=9242 /app/services/sar-filing-engine-go/sar-filing-engine-go &
PIDS+=($!)
PORT=9243 python3 /app/services/soc2-evidence-collector-py/main.py &
PIDS+=($!)

echo "[compliance-regulatory] All 21 services started (ports 9223-9243)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[compliance-regulatory] A service exited with code $EXIT_CODE"
cleanup
