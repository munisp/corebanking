#!/bin/bash
# 54Bank Consolidated Entrypoint — channels-voice
# Voice — IVR, voice banking, USSD, chatbot
# Services: 14 | Ports: 9165-9178
set -e

echo "[channels-voice] Starting 14 services..."

PIDS=()

cleanup() {
  echo "[channels-voice] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[channels-voice] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9165 python3 /app/services/chatbot-py/main.py &
PIDS+=($!)
PORT=9166 python3 /app/services/interactive-ussd-agri-py/main.py &
PIDS+=($!)
PORT=9167 /app/services/ussd-banking-gateway-go/ussd-banking-gateway-go &
PIDS+=($!)
PORT=9168 python3 /app/services/ussd-multilingual-py/main.py &
PIDS+=($!)
PORT=9169 /app/services/ussd-sim-toolkit-go/ussd-sim-toolkit-go &
PIDS+=($!)
PORT=9170 /app/services/ussd-transaction-engine-rs/ussd_transaction_engine_rs &
PIDS+=($!)
PORT=9171 /app/services/voice-agent-escalation-go/voice-agent-escalation-go &
PIDS+=($!)
PORT=9172 python3 /app/services/voice-asr-nigerian-py/main.py &
PIDS+=($!)
PORT=9173 /app/services/voice-banking-gateway-go/voice-banking-gateway-go &
PIDS+=($!)
PORT=9174 /app/services/voice-biometric-auth-rs/voice_biometric_auth_rs &
PIDS+=($!)
PORT=9175 python3 /app/services/voice-call-analytics-py/main.py &
PIDS+=($!)
PORT=9176 /app/services/voice-ivr-menu-go/voice-ivr-menu-go &
PIDS+=($!)
PORT=9177 python3 /app/services/voice-nlu-banking-py/main.py &
PIDS+=($!)
PORT=9178 /app/services/voice-tts-nigerian-rs/voice_tts_nigerian_rs &
PIDS+=($!)

echo "[channels-voice] All 14 services started (ports 9165-9178)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[channels-voice] A service exited with code $EXIT_CODE"
cleanup
