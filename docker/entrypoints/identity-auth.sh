#!/bin/bash
# 54Bank Consolidated Entrypoint — identity-auth
# Identity — Keycloak, MFA, OTP, biometric, face match, liveness
# Services: 18 | Ports: 9316-9333
set -e

echo "[identity-auth] Starting 18 services..."

PIDS=()

cleanup() {
  echo "[identity-auth] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[identity-auth] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9316 /app/services/auth-enforcer-rs/auth_enforcer_rs &
PIDS+=($!)
PORT=9317 /app/services/biometric-auth-rs/biometric_auth_rs &
PIDS+=($!)
PORT=9318 /app/services/browser-fingerprint-go/browser-fingerprint-go &
PIDS+=($!)
PORT=9319 /app/services/continuous-liveness-rs/continuous_liveness_rs &
PIDS+=($!)
PORT=9320 /app/services/face-match-rs/face_match_rs &
PIDS+=($!)
PORT=9321 /app/services/identity-channels-go/identity-channels-go &
PIDS+=($!)
PORT=9322 /app/services/identity-verification-go/identity-verification-go &
PIDS+=($!)
PORT=9323 /app/services/jwt-validator-rs/jwt_validator_rs &
PIDS+=($!)
PORT=9324 /app/services/keycloak-admin-go/keycloak-admin-go &
PIDS+=($!)
PORT=9325 /app/services/keycloak-enforcer-go/keycloak-enforcer-go &
PIDS+=($!)
PORT=9326 python3 /app/services/keycloak-identity-py/main.py &
PIDS+=($!)
PORT=9327 /app/services/liveness-detection-rs/liveness_detection_rs &
PIDS+=($!)
PORT=9328 python3 /app/services/liveness-inference-py/main.py &
PIDS+=($!)
PORT=9329 /app/services/liveness-orchestrator-go/liveness-orchestrator-go &
PIDS+=($!)
PORT=9330 /app/services/mfa-orchestrator-go/mfa-orchestrator-go &
PIDS+=($!)
PORT=9331 /app/services/otp-hardening-rs/otp_hardening_rs &
PIDS+=($!)
PORT=9332 /app/services/pkce-auth-flow-go/pkce-auth-flow-go &
PIDS+=($!)
PORT=9333 /app/services/token-rotation-rs/token_rotation_rs &
PIDS+=($!)

echo "[identity-auth] All 18 services started (ports 9316-9333)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[identity-auth] A service exited with code $EXIT_CODE"
cleanup
