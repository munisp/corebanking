#!/bin/bash
# 54Bank Consolidated Entrypoint — workflow-operations
# Operations — teller, branch, maker-checker, document management
# Services: 48 | Ports: 9576-9623
set -e

echo "[workflow-operations] Starting 48 services..."

PIDS=()

cleanup() {
  echo "[workflow-operations] Graceful shutdown..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  wait
  echo "[workflow-operations] All services stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT

PORT=9576 python3 /app/services/accessibility-auditor-py/main.py &
PIDS+=($!)
PORT=9577 /app/services/animal-id-traceability-rs/animal_id_traceability_rs &
PIDS+=($!)
PORT=9578 /app/services/banking-domain-integration-go/banking-domain-integration-go &
PIDS+=($!)
PORT=9579 python3 /app/services/banking-operations-pipeline-py/main.py &
PIDS+=($!)
PORT=9580 /app/services/branch-operations-go/branch-operations-go &
PIDS+=($!)
PORT=9581 /app/services/cac-realtime-api-go/cac-realtime-api-go &
PIDS+=($!)
PORT=9582 /app/services/contract-test-rs/contract_test_rs &
PIDS+=($!)
PORT=9583 /app/services/core-banking-go/core-banking-go &
PIDS+=($!)
PORT=9584 /app/services/credit-bureau-rs/credit_bureau_rs &
PIDS+=($!)
PORT=9585 /app/services/credit-facility-go/credit-facility-go &
PIDS+=($!)
PORT=9586 python3 /app/services/dispute-management-py/main.py &
PIDS+=($!)
PORT=9587 /app/services/eod-processor-go/eod-processor-go &
PIDS+=($!)
PORT=9588 /app/services/erpnext-bridge-go/erpnext-bridge-go &
PIDS+=($!)
PORT=9589 python3 /app/services/erpnext-sync-py/main.py &
PIDS+=($!)
PORT=9590 /app/services/fast-json-serializer-rs/fast_json_serializer_rs &
PIDS+=($!)
PORT=9591 /app/services/fixed-assets-go/fixed-assets-go &
PIDS+=($!)
PORT=9592 /app/services/idempotency-go/idempotency-go &
PIDS+=($!)
PORT=9593 /app/services/immutable-audit-rs/immutable_audit_rs &
PIDS+=($!)
PORT=9594 python3 /app/services/inventory-py/main.py &
PIDS+=($!)
PORT=9595 python3 /app/services/load-test-runner-py/main.py &
PIDS+=($!)
PORT=9596 /app/services/middleware-go/middleware-go &
PIDS+=($!)
PORT=9597 python3 /app/services/middleware-py/main.py &
PIDS+=($!)
PORT=9598 /app/services/middleware-rs/middleware_rs &
PIDS+=($!)
PORT=9599 python3 /app/services/ndpr-compliance-py/main.py &
PIDS+=($!)
PORT=9600 /app/services/offline-resilience-rs/offline_resilience_rs &
PIDS+=($!)
PORT=9601 python3 /app/services/opensearch-indexer-py/main.py &
PIDS+=($!)
PORT=9602 python3 /app/services/opensearch-optimizer-py/main.py &
PIDS+=($!)
PORT=9603 /app/services/pentest-orchestrator-go/pentest-orchestrator-go &
PIDS+=($!)
PORT=9604 /app/services/platform-hardening-rs/platform_hardening_rs &
PIDS+=($!)
PORT=9605 python3 /app/services/platform-operations-engine-py/main.py &
PIDS+=($!)
PORT=9606 /app/services/platform-security-infra-go/platform-security-infra-go &
PIDS+=($!)
PORT=9607 /app/services/request-coalescer-go/request-coalescer-go &
PIDS+=($!)
PORT=9608 /app/services/resilience-service-rs/resilience_service_rs &
PIDS+=($!)
PORT=9609 /app/services/response-compressor-rs/response_compressor_rs &
PIDS+=($!)
PORT=9610 /app/services/secrets-rotation-rs/secrets_rotation_rs &
PIDS+=($!)
PORT=9611 /app/services/secrets-vault-go/secrets-vault-go &
PIDS+=($!)
PORT=9612 python3 /app/services/security-audit-logger-py/main.py &
PIDS+=($!)
PORT=9613 /app/services/security-hardening-go/security-hardening-go &
PIDS+=($!)
PORT=9614 /app/services/session-security-rs/session_security_rs &
PIDS+=($!)
PORT=9615 /app/services/sql-parameterizer-rs/sql_parameterizer_rs &
PIDS+=($!)
PORT=9616 /app/services/standing-charges-go/standing-charges-go &
PIDS+=($!)
PORT=9617 /app/services/stress-testing-rs/stress_testing_rs &
PIDS+=($!)
PORT=9618 python3 /app/services/tax-reporting-py/main.py &
PIDS+=($!)
PORT=9619 /app/services/teller-operations-go/teller-operations-go &
PIDS+=($!)
PORT=9620 /app/services/typology-detector-rs/typology_detector_rs &
PIDS+=($!)
PORT=9621 /app/services/ubo-ownership-graph-rs/ubo_ownership_graph_rs &
PIDS+=($!)
PORT=9622 python3 /app/services/unit-test-runner-py/main.py &
PIDS+=($!)
PORT=9623 /app/services/vault-integration-rs/vault_integration_rs &
PIDS+=($!)

echo "[workflow-operations] All 48 services started (ports 9576-9623)"

# Wait for any child to exit
wait -n 2>/dev/null || wait
EXIT_CODE=$?
echo "[workflow-operations] A service exited with code $EXIT_CODE"
cleanup
