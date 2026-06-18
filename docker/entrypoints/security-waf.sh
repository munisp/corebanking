#!/bin/bash
# 54Bank Consolidated Entrypoint — security-waf
# Security — WAF, PCI, HSM, KMS, encryption, DDoS, CSRF
# Services: 19 | Ports: 9470-9488
set -e

echo "[security-waf] Starting 19 services..."

PIDS=()

cleanup() {
  echo "[security-waf] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[security-waf] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9470 /app/services/body-limit-enforcer-go/body-limit-enforcer-go &
PIDS+=($!)
PORT=9471 /app/services/clickjack-defender-rs/clickjack_defender_rs &
PIDS+=($!)
PORT=9472 /app/services/cloud-kms-bridge-rs/cloud_kms_bridge_rs &
PIDS+=($!)
PORT=9473 /app/services/csp-nonce-engine-go/csp-nonce-engine-go &
PIDS+=($!)
PORT=9474 /app/services/ddos-protection-go/ddos-protection-go &
PIDS+=($!)
PORT=9475 /app/services/ddos-shield-go/ddos-shield-go &
PIDS+=($!)
PORT=9476 python3 /app/services/distroless-builder-py/main.py &
PIDS+=($!)
PORT=9477 python3 /app/services/docker-hardener-py/main.py &
PIDS+=($!)
PORT=9478 /app/services/field-level-encryption-rs/field_level_encryption_rs &
PIDS+=($!)
PORT=9479 /app/services/helm-validator-go/helm-validator-go &
PIDS+=($!)
PORT=9480 /app/services/hsm-key-manager-rs/hsm_key_manager_rs &
PIDS+=($!)
PORT=9481 /app/services/image-scanner-go/image-scanner-go &
PIDS+=($!)
PORT=9482 /app/services/ip-allowlist-rs/ip_allowlist_rs &
PIDS+=($!)
PORT=9483 /app/services/key-rotation-engine-go/key-rotation-engine-go &
PIDS+=($!)
PORT=9484 /app/services/openappsec-waf-rs/openappsec_waf_rs &
PIDS+=($!)
PORT=9485 /app/services/output-encoder-rs/output_encoder_rs &
PIDS+=($!)
PORT=9486 /app/services/pci-scanner-rs/pci_scanner_rs &
PIDS+=($!)
PORT=9487 /app/services/sri-validator-rs/sri_validator_rs &
PIDS+=($!)
PORT=9488 /app/services/waf-rules-engine-rs/waf_rules_engine_rs &
PIDS+=($!)

echo "[security-waf] All 19 services started (ports 9470-9488)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[security-waf] A service exited with code $EXIT_CODE"
cleanup
