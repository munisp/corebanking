#!/usr/bin/env bash
# =============================================================================
# Daily Test Runner — 54Bank Platform
#
# Scheduled at: 0 2 * * * (2:00 AM daily)
#
# Runs ALL test suites in sequence:
#   1. Service discovery & test generation
#   2. Unit tests (financial precision, domain logic)
#   3. Integration tests (maker-checker, RLS, audit, idempotency)
#   4. E2E workflow tests
#   5. Event tests (Kafka)
#   6. Security tests
#   7. Contract tests
#   8. Load tests (k6)
#   9. UI tests (Playwright)
#  10. Production completeness checker
#  11. Coverage enforcement (BLOCKS if below threshold)
#  12. Publish results
#
# Environment variables:
#   API_GATEWAY_URL    API gateway base URL
#   TEST_JWT_TOKEN     Valid JWT for test user
#   TENANT_A_TOKEN     Tenant A JWT
#   TENANT_B_TOKEN     Tenant B JWT
#   ADMIN_TOKEN        Platform admin JWT
#   KAFKA_BOOTSTRAP_SERVERS  Kafka bootstrap server
#   BASE_URL           Frontend base URL (for Playwright)
#   SLACK_WEBHOOK_URL  Slack webhook for notifications
#   COVERAGE_THRESHOLD Minimum coverage % (default: 80)
#
# Exit codes:
#   0  All tests passed and coverage meets threshold
#   1  Test failures or coverage below threshold
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS_DIR="${REPO_ROOT}/test-results"
LOG_DIR="${RESULTS_DIR}/logs"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
RUN_LOG="${LOG_DIR}/run_${TIMESTAMP}.log"

API_GATEWAY_URL="${API_GATEWAY_URL:-http://localhost:8080}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
KAFKA_BOOTSTRAP_SERVERS="${KAFKA_BOOTSTRAP_SERVERS:-localhost:9092}"
COVERAGE_THRESHOLD="${COVERAGE_THRESHOLD:-80}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
SKIP_LOAD_TESTS="${SKIP_LOAD_TESTS:-false}"
SKIP_UI_TESTS="${SKIP_UI_TESTS:-false}"
SKIP_KAFKA_TESTS="${SKIP_KAFKA_TESTS:-false}"

PASS_COLOR="\033[0;32m"
FAIL_COLOR="\033[0;31m"
WARN_COLOR="\033[0;33m"
RESET_COLOR="\033[0m"

# ── Setup ─────────────────────────────────────────────────────────────────────

mkdir -p "${RESULTS_DIR}" "${LOG_DIR}"

exec > >(tee -a "${RUN_LOG}") 2>&1

echo "============================================================"
echo "  54BANK DAILY TEST RUN — ${TIMESTAMP}"
echo "  API_GATEWAY_URL: ${API_GATEWAY_URL}"
echo "  COVERAGE_THRESHOLD: ${COVERAGE_THRESHOLD}%"
echo "============================================================"
echo ""

FAILED_SUITES=()
PASSED_SUITES=()
TOTAL_START=$(date +%s)

# ── Helper functions ──────────────────────────────────────────────────────────

run_suite() {
    local suite_name="$1"
    local command="$2"
    local result_file="${RESULTS_DIR}/${suite_name}_${TIMESTAMP}.xml"
    local start_time=$(date +%s)

    echo ""
    echo "────────────────────────────────────────────────────────────"
    echo "  RUNNING: ${suite_name}"
    echo "  COMMAND: ${command}"
    echo "────────────────────────────────────────────────────────────"

    if eval "${command}" ; then
        local elapsed=$(( $(date +%s) - start_time ))
        echo -e "${PASS_COLOR}  ✓ PASSED: ${suite_name} (${elapsed}s)${RESET_COLOR}"
        PASSED_SUITES+=("${suite_name}")
        return 0
    else
        local elapsed=$(( $(date +%s) - start_time ))
        echo -e "${FAIL_COLOR}  ✗ FAILED: ${suite_name} (${elapsed}s)${RESET_COLOR}"
        FAILED_SUITES+=("${suite_name}")
        return 1
    fi
}

check_service_health() {
    echo "Checking gateway health..."
    local max_retries=5
    local retry=0
    while [ $retry -lt $max_retries ]; do
        if curl -sf "${API_GATEWAY_URL}/healthz" > /dev/null 2>&1; then
            echo -e "${PASS_COLOR}  ✓ Gateway is healthy${RESET_COLOR}"
            return 0
        fi
        retry=$(( retry + 1 ))
        echo "  Gateway not ready (attempt ${retry}/${max_retries})..."
        sleep 10
    done
    echo -e "${WARN_COLOR}  ⚠ Gateway not reachable — integration/e2e tests may be skipped${RESET_COLOR}"
    return 0  # Non-fatal — tests will self-skip
}

notify_slack() {
    local status="$1"
    local message="$2"
    if [ -z "${SLACK_WEBHOOK_URL}" ]; then
        return 0
    fi
    local color="good"
    if [ "${status}" = "FAIL" ]; then
        color="danger"
    elif [ "${status}" = "WARN" ]; then
        color="warning"
    fi
    curl -s -X POST "${SLACK_WEBHOOK_URL}" \
        -H "Content-Type: application/json" \
        -d "{
            \"attachments\": [{
                \"color\": \"${color}\",
                \"title\": \"54Bank Daily Tests — ${status}\",
                \"text\": \"${message}\",
                \"footer\": \"Run: ${TIMESTAMP}\"
            }]
        }" || true
}

# ── Phase 1: Service Discovery ────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 1: SERVICE DISCOVERY                              ║"
echo "╚══════════════════════════════════════════════════════════╝"

run_suite "service_discovery" \
    "cd '${REPO_ROOT}' && python tests/scripts/discover_services.py \
     --output test-results/service_inventory.json --quiet" || true

# ── Phase 2: Test Generation ──────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 2: TEST GENERATION                                ║"
echo "╚══════════════════════════════════════════════════════════╝"

run_suite "test_generation" \
    "cd '${REPO_ROOT}/tests/scripts' && python generate_tests.py --dry-run" || true

# ── Phase 3: Unit Tests ───────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 3: UNIT TESTS                                     ║"
echo "╚══════════════════════════════════════════════════════════╝"

run_suite "unit_financial_precision" \
    "cd '${REPO_ROOT}' && python -m pytest tests/unit/test_financial_precision.py \
     -v --tb=short \
     --junitxml=test-results/unit_financial_${TIMESTAMP}.xml \
     2>&1"

run_suite "unit_aml_engine" \
    "cd '${REPO_ROOT}' && python -m pytest tests/unit/test_aml_engine.py \
     -v --tb=short \
     --junitxml=test-results/unit_aml_${TIMESTAMP}.xml \
     2>&1" || true

run_suite "unit_credit_scoring" \
    "cd '${REPO_ROOT}' && python -m pytest tests/unit/test_credit_scoring.py \
     -v --tb=short \
     --junitxml=test-results/unit_credit_${TIMESTAMP}.xml \
     2>&1" || true

run_suite "unit_kyc" \
    "cd '${REPO_ROOT}' && python -m pytest tests/unit/test_kyc_verification.py \
     -v --tb=short \
     --junitxml=test-results/unit_kyc_${TIMESTAMP}.xml \
     2>&1" || true

# ── Go unit tests for every Go service ───────────────────────────────────────

echo ""
echo "Running Go unit tests for all Go services..."
GO_FAIL=0
GO_PASS=0
for svc_dir in "${REPO_ROOT}"/services/*-go; do
    svc_name=$(basename "${svc_dir}")
    if [ -f "${svc_dir}/main_test.go" ] || ls "${svc_dir}"/*_test.go 2>/dev/null | head -1; then
        if cd "${svc_dir}" && go test ./... -count=1 -timeout=60s \
            -v 2>"${LOG_DIR}/go_${svc_name}_${TIMESTAMP}.log"; then
            GO_PASS=$(( GO_PASS + 1 ))
        else
            GO_FAIL=$(( GO_FAIL + 1 ))
            FAILED_SUITES+=("go_test:${svc_name}")
        fi
        cd "${REPO_ROOT}"
    fi
done
echo -e "${PASS_COLOR}  Go tests: ${GO_PASS} passed${RESET_COLOR}, ${FAIL_COLOR}${GO_FAIL} failed${RESET_COLOR}"

# ── Phase 4: Integration Tests ────────────────────────────────────────────────

check_service_health

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 4: INTEGRATION TESTS                              ║"
echo "╚══════════════════════════════════════════════════════════╝"

export API_GATEWAY_URL

run_suite "integration_maker_checker" \
    "cd '${REPO_ROOT}' && python -m pytest tests/integration/test_maker_checker.py \
     -v --tb=short \
     --junitxml=test-results/integration_maker_checker_${TIMESTAMP}.xml \
     2>&1" || true

run_suite "integration_rls_isolation" \
    "cd '${REPO_ROOT}' && python -m pytest tests/integration/test_rls_tenant_isolation.py \
     -v --tb=short \
     --junitxml=test-results/integration_rls_${TIMESTAMP}.xml \
     2>&1" || true

run_suite "integration_audit_trail" \
    "cd '${REPO_ROOT}' && python -m pytest tests/integration/test_audit_trail.py \
     -v --tb=short \
     --junitxml=test-results/integration_audit_${TIMESTAMP}.xml \
     2>&1" || true

run_suite "integration_middleware" \
    "cd '${REPO_ROOT}' && python -m pytest tests/integration/test_middleware_integration.py \
     -v --tb=short \
     --junitxml=test-results/integration_middleware_${TIMESTAMP}.xml \
     2>&1" || true

# ── Phase 5: E2E Workflow Tests ───────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 5: E2E WORKFLOW TESTS                             ║"
echo "╚══════════════════════════════════════════════════════════╝"

run_suite "e2e_banking_workflows" \
    "cd '${REPO_ROOT}' && python -m pytest tests/e2e/test_banking_workflows.py \
     -v --tb=short \
     --junitxml=test-results/e2e_workflows_${TIMESTAMP}.xml \
     2>&1" || true

run_suite "e2e_customer_journey" \
    "cd '${REPO_ROOT}' && python -m pytest tests/e2e/test_customer_journey.py \
     -v --tb=short \
     --junitxml=test-results/e2e_customer_journey_${TIMESTAMP}.xml \
     2>&1" || true

# ── Phase 6: Event Tests ──────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 6: KAFKA EVENT TESTS                              ║"
echo "╚══════════════════════════════════════════════════════════╝"

if [ "${SKIP_KAFKA_TESTS}" = "false" ]; then
    run_suite "events_kafka" \
        "cd '${REPO_ROOT}' && \
         KAFKA_BOOTSTRAP_SERVERS=${KAFKA_BOOTSTRAP_SERVERS} \
         python -m pytest tests/events/test_kafka_events.py \
         -v --tb=short \
         --junitxml=test-results/events_kafka_${TIMESTAMP}.xml \
         2>&1" || true
else
    echo "  [SKIP] Kafka tests skipped (SKIP_KAFKA_TESTS=true)"
fi

# ── Phase 7: Security Tests ───────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 7: SECURITY TESTS                                 ║"
echo "╚══════════════════════════════════════════════════════════╝"

run_suite "security" \
    "cd '${REPO_ROOT}' && python -m pytest tests/security/test_security.py \
     -v --tb=short \
     --junitxml=test-results/security_${TIMESTAMP}.xml \
     2>&1" || true

# ── Phase 8: Contract Tests ───────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 8: CONTRACT TESTS                                 ║"
echo "╚══════════════════════════════════════════════════════════╝"

run_suite "contract_api" \
    "cd '${REPO_ROOT}' && python -m pytest tests/contract/test_api_contracts.py \
     -v --tb=short \
     --junitxml=test-results/contract_${TIMESTAMP}.xml \
     2>&1" || true

# ── Phase 9: Production Completeness ─────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 9: PRODUCTION COMPLETENESS                        ║"
echo "╚══════════════════════════════════════════════════════════╝"

run_suite "production_completeness" \
    "cd '${REPO_ROOT}' && python -m pytest tests/test_production_completeness.py \
     -v --tb=short \
     --junitxml=test-results/completeness_${TIMESTAMP}.xml \
     2>&1"

# ── Phase 10: UI Tests (Playwright) ──────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 10: UI TESTS (PLAYWRIGHT)                         ║"
echo "╚══════════════════════════════════════════════════════════╝"

if [ "${SKIP_UI_TESTS}" = "false" ] && command -v npx &>/dev/null; then
    run_suite "ui_playwright" \
        "cd '${REPO_ROOT}' && \
         BASE_URL=${BASE_URL} \
         npx playwright test tests/ui/test_banking_ui.spec.ts \
         --reporter=junit,list \
         --output=test-results/playwright/ \
         2>&1" || true
else
    echo "  [SKIP] UI tests skipped (SKIP_UI_TESTS=true or npx not found)"
fi

# ── Phase 11: Load Tests (k6) ─────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 11: LOAD TESTS (K6)                               ║"
echo "╚══════════════════════════════════════════════════════════╝"

if [ "${SKIP_LOAD_TESTS}" = "false" ] && command -v k6 &>/dev/null; then
    run_suite "load_comprehensive" \
        "K6_BASE_URL=${API_GATEWAY_URL} k6 run \
         --vus 10 --duration 60s \
         --out json=test-results/k6_results_${TIMESTAMP}.json \
         '${REPO_ROOT}/tests/load/k6_comprehensive.js' \
         2>&1" || true

    run_suite "load_banking_flows" \
        "K6_BASE_URL=${API_GATEWAY_URL} k6 run \
         --vus 5 --duration 30s \
         --out json=test-results/k6_banking_${TIMESTAMP}.json \
         '${REPO_ROOT}/tests/load/banking-flows-load-test.js' \
         2>&1" || true
else
    echo "  [SKIP] Load tests skipped (SKIP_LOAD_TESTS=true or k6 not found)"
fi

# ── Phase 12: Coverage Enforcement ───────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 12: COVERAGE ENFORCEMENT                          ║"
echo "╚══════════════════════════════════════════════════════════╝"

COVERAGE_EXIT=0
cd "${REPO_ROOT}" && python tests/scripts/coverage_enforcer.py \
    --inventory test-results/service_inventory.json \
    --threshold "${COVERAGE_THRESHOLD}" \
    --output test-results/coverage-report.json \
    2>&1 || COVERAGE_EXIT=$?

if [ $COVERAGE_EXIT -ne 0 ]; then
    FAILED_SUITES+=("coverage_enforcement")
    echo -e "${FAIL_COLOR}  ✗ COVERAGE BELOW THRESHOLD — BUILD BLOCKED${RESET_COLOR}"
else
    PASSED_SUITES+=("coverage_enforcement")
fi

# ── Phase 13: Schema Diff ─────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  PHASE 13: ENDPOINT INVENTORY REPORT                     ║"
echo "╚══════════════════════════════════════════════════════════╝"

if [ -f "${REPO_ROOT}/test-results/service_inventory.json" ]; then
    python3 - <<'EOF'
import json, sys
with open("test-results/service_inventory.json") as f:
    inv = json.load(f)

total_routes = sum(s.get("route_count", 0) for s in inv["services"])
services_no_routes = [s["name"] for s in inv["services"] if s.get("route_count", 0) == 0]

print(f"Total services    : {inv['total_services']}")
print(f"Total routes      : {total_routes}")
print(f"Services w/o routes: {len(services_no_routes)}")
if services_no_routes[:5]:
    print(f"  (first 5): {services_no_routes[:5]}")
EOF
fi

# ── Final Summary ─────────────────────────────────────────────────────────────

TOTAL_ELAPSED=$(( $(date +%s) - TOTAL_START ))
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  TEST RUN COMPLETE                                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Total elapsed   : ${TOTAL_ELAPSED}s"
echo "  Passed suites   : ${#PASSED_SUITES[@]}"
echo "  Failed suites   : ${#FAILED_SUITES[@]}"
echo ""

if [ ${#PASSED_SUITES[@]} -gt 0 ]; then
    echo -e "${PASS_COLOR}PASSED:${RESET_COLOR}"
    for suite in "${PASSED_SUITES[@]}"; do
        echo "  ✓ ${suite}"
    done
fi

if [ ${#FAILED_SUITES[@]} -gt 0 ]; then
    echo ""
    echo -e "${FAIL_COLOR}FAILED:${RESET_COLOR}"
    for suite in "${FAILED_SUITES[@]}"; do
        echo "  ✗ ${suite}"
    done
fi

# Notify Slack
if [ ${#FAILED_SUITES[@]} -eq 0 ]; then
    STATUS="PASS"
    MSG="All test suites passed. Duration: ${TOTAL_ELAPSED}s. Passed: ${#PASSED_SUITES[@]}"
    echo ""
    echo -e "${PASS_COLOR}✓ ALL TESTS PASSED${RESET_COLOR}"
else
    STATUS="FAIL"
    MSG="Test failures detected! Failed: ${FAILED_SUITES[*]}. Duration: ${TOTAL_ELAPSED}s"
    echo ""
    echo -e "${FAIL_COLOR}✗ SOME TESTS FAILED — SEE ABOVE${RESET_COLOR}"
fi

notify_slack "${STATUS}" "${MSG}"

# Write summary JSON
cat > "${RESULTS_DIR}/daily_summary_${TIMESTAMP}.json" <<JSON
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "${STATUS}",
  "elapsed_seconds": ${TOTAL_ELAPSED},
  "passed_suites": ${#PASSED_SUITES[@]},
  "failed_suites": ${#FAILED_SUITES[@]},
  "failed": $(python3 -c "import json, sys; print(json.dumps(sys.argv[1:]))" "${FAILED_SUITES[@]:-}"),
  "log_file": "${RUN_LOG}"
}
JSON

echo ""
echo "Results directory  : ${RESULTS_DIR}"
echo "Run log           : ${RUN_LOG}"
echo ""

# Exit with failure if any critical suite failed
CRITICAL_FAILURES=("unit_financial_precision" "production_completeness" "coverage_enforcement")
for suite in "${CRITICAL_FAILURES[@]}"; do
    if [[ " ${FAILED_SUITES[*]:-} " =~ " ${suite} " ]]; then
        echo -e "${FAIL_COLOR}CRITICAL FAILURE: ${suite} — blocking${RESET_COLOR}"
        exit 1
    fi
done

# Exit with 1 if any suite failed
[ ${#FAILED_SUITES[@]} -eq 0 ] && exit 0 || exit 1
