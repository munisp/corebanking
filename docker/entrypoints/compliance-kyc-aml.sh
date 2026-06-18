#!/bin/bash
# 54Bank Consolidated Entrypoint — compliance-kyc-aml
# KYC/AML — verification, screening, sanctions, PEP, adverse media
# Services: 33 | Ports: 9189-9221
set -e

echo "[compliance-kyc-aml] Starting 33 services..."

PIDS=()

cleanup() {
  echo "[compliance-kyc-aml] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[compliance-kyc-aml] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9189 python3 /app/services/address-verification-py/main.py &
PIDS+=($!)
PORT=9190 python3 /app/services/adverse-media-scanner-py/main.py &
PIDS+=($!)
PORT=9191 python3 /app/services/adverse-media-screening-py/main.py &
PIDS+=($!)
PORT=9192 /app/services/agent-kyc-capture-go/agent-kyc-capture-go &
PIDS+=($!)
PORT=9193 /app/services/aml-case-manager-go/aml-case-manager-go &
PIDS+=($!)
PORT=9194 python3 /app/services/aml-compliance-dashboard-py/main.py &
PIDS+=($!)
PORT=9195 /app/services/aml-engine-rs/aml_engine_rs &
PIDS+=($!)
PORT=9196 /app/services/aml-risk-scoring-rs/aml_risk_scoring_rs &
PIDS+=($!)
PORT=9197 /app/services/aml-training-tracker-go/aml-training-tracker-go &
PIDS+=($!)
PORT=9198 /app/services/beneficial-ownership-go/beneficial-ownership-go &
PIDS+=($!)
PORT=9199 /app/services/bvn-nin-verification-go/bvn-nin-verification-go &
PIDS+=($!)
PORT=9200 /app/services/cbn-tiered-kyc-rs/cbn_tiered_kyc_rs &
PIDS+=($!)
PORT=9201 python3 /app/services/corporate-doc-verification-py/main.py &
PIDS+=($!)
PORT=9202 python3 /app/services/efass-kyc-returns-py/main.py &
PIDS+=($!)
PORT=9203 /app/services/goaml-integration-go/goaml-integration-go &
PIDS+=($!)
PORT=9204 /app/services/kyb-engine-go/kyb-engine-go &
PIDS+=($!)
PORT=9205 python3 /app/services/kyb-engine-py/main.py &
PIDS+=($!)
PORT=9206 python3 /app/services/kyc-aml-screening-py/main.py &
PIDS+=($!)
PORT=9207 python3 /app/services/kyc-analytics-dashboard-py/main.py &
PIDS+=($!)
PORT=9208 python3 /app/services/kyc-data-quality-py/main.py &
PIDS+=($!)
PORT=9209 python3 /app/services/kyc-engine-py/main.py &
PIDS+=($!)
PORT=9210 python3 /app/services/kyc-event-consumer-py/main.py &
PIDS+=($!)
PORT=9211 python3 /app/services/kyc-self-service-py/main.py &
PIDS+=($!)
PORT=9212 python3 /app/services/kyc-workflow-orchestration-py/main.py &
PIDS+=($!)
PORT=9213 /app/services/multi-bureau-verification-go/multi-bureau-verification-go &
PIDS+=($!)
PORT=9214 python3 /app/services/pep-enhanced-dd-py/main.py &
PIDS+=($!)
PORT=9215 /app/services/sanctions-batch-rescreener-rs/sanctions_batch_rescreener_rs &
PIDS+=($!)
PORT=9216 /app/services/sanctions-engine-rs/sanctions_engine_rs &
PIDS+=($!)
PORT=9217 /app/services/sanctions-screening-rs/sanctions_screening_rs &
PIDS+=($!)
PORT=9218 /app/services/signature-verification-rs/signature_verification_rs &
PIDS+=($!)
PORT=9219 /app/services/telegram-kyc-bot-rs/telegram_kyc_bot_rs &
PIDS+=($!)
PORT=9220 python3 /app/services/video-kyc-py/main.py &
PIDS+=($!)
PORT=9221 /app/services/watchlist-manager-rs/watchlist_manager_rs &
PIDS+=($!)

echo "[compliance-kyc-aml] All 33 services started (ports 9189-9221)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[compliance-kyc-aml] A service exited with code $EXIT_CODE"
cleanup
