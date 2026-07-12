#!/bin/bash
# Smoke Test Script - Tests core platform functionality
# Usage: ./scripts/smoke-test.sh [base_url] [max_attempts] [wait_ms]

set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3000}"
MAX_ATTEMPTS="${2:-20}"
WAIT_MS="${3:-1500}"

echo "=== 54Link Core Banking Smoke Tests ==="
echo "Base URL: $BASE_URL"
echo "Max Attempts: $MAX_ATTEMPTS"
echo "Wait Time: ${WAIT_MS}ms"
echo ""

ATTEMPT=0
SUCCESS=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "[$ATTEMPT/$MAX_ATTEMPTS] Testing platform health..."

  # Test health endpoint
  if curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
    echo "  ✓ Health check passed"
    SUCCESS=true
    break
  else
    echo "  ✗ Health check failed (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
      sleep $(echo "scale=3; $WAIT_MS / 1000" | bc)
    fi
  fi
done

if [ "$SUCCESS" = true ]; then
  echo ""
  echo "✓ Platform is healthy and ready"
  exit 0
else
  echo ""
  echo "✗ Platform health checks failed after $MAX_ATTEMPTS attempts"
  exit 1
fi
