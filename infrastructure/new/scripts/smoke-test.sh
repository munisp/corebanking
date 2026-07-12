#!/usr/bin/env bash
# 54Bank Platform Smoke Test — Validates all services are running and responsive
set -euo pipefail

PASS=0
FAIL=0
TOTAL=0
RESULTS=()

check() {
  local name="$1" url="$2" expected_status="${3:-200}" method="${4:-GET}" body="${5:-}"
  TOTAL=$((TOTAL + 1))
  
  local args=(-s -o /dev/null -w "%{http_code}" -X "$method" "$url")
  if [ -n "$body" ]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi
  
  local status
  status=$(curl "${args[@]}" 2>/dev/null || echo "000")
  
  if [ "$status" = "$expected_status" ]; then
    PASS=$((PASS + 1))
    RESULTS+=("PASS  $name (HTTP $status)")
  else
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL  $name (expected $expected_status, got $status)")
  fi
}

echo "54Bank Platform Smoke Test"
echo "=========================="
echo ""

# Express Gateway
echo "--- Express Gateway (localhost:3000) ---"
check "Gateway health" "http://localhost:3000/healthz"
check "Platform overview" "http://localhost:3000/api/platform/overview"
check "Customer list" "http://localhost:3000/api/customers"

# Agriculture Banking (Rust :8090)
echo "--- Agriculture Banking (:8090) ---"
check "Agriculture health" "http://localhost:8090/healthz"
check "Farmer list" "http://localhost:8090/v1/agriculture/farmers"
check "Loan list" "http://localhost:8090/v1/agriculture/loans"

# Teller Operations (Go :8091)
echo "--- Teller Operations (:8091) ---"
check "Teller health" "http://localhost:8091/healthz"
check "Teller sessions" "http://localhost:8091/v1/teller/sessions"

# Islamic Banking (Python :8092)
echo "--- Islamic Banking (:8092) ---"
check "Islamic health" "http://localhost:8092/healthz"
check "Murabaha contracts" "http://localhost:8092/v1/islamic/murabaha"

# Trade Finance (Go :8093)
echo "--- Trade Finance (:8093) ---"
check "Trade health" "http://localhost:8093/healthz"
check "LCs" "http://localhost:8093/v1/trade/lcs"

# Mortgage Servicing (Rust :8094)
echo "--- Mortgage Servicing (:8094) ---"
check "Mortgage health" "http://localhost:8094/healthz"
check "Mortgage apps" "http://localhost:8094/v1/mortgage/applications"

# Esusu Groups (Go :8095)
echo "--- Esusu Groups (:8095) ---"
check "Esusu health" "http://localhost:8095/healthz"
check "Esusu groups" "http://localhost:8095/v1/esusu/groups"

# Virtual Accounts (Go :8096)
echo "--- Virtual Accounts (:8096) ---"
check "VA health" "http://localhost:8096/healthz"
check "VA accounts" "http://localhost:8096/v1/virtual-accounts/accounts"

# Agent Banking (Go :8097)
echo "--- Agent Banking (:8097) ---"
check "Agent health" "http://localhost:8097/healthz"
check "Agent list" "http://localhost:8097/v1/agent-banking/agents"

# Group Lending (Go :8098)
echo "--- Group Lending (:8098) ---"
check "Group health" "http://localhost:8098/healthz"
check "Lending groups" "http://localhost:8098/v1/group-lending/groups"

# Education Loans (Python :8099)
echo "--- Education Loans (:8099) ---"
check "Education health" "http://localhost:8099/healthz"
check "Education loans" "http://localhost:8099/v1/education-loans/loans"

# Ledger Reconciliation (Rust :8100)
echo "--- Ledger Reconciliation (:8100) ---"
check "Ledger health" "http://localhost:8100/healthz"

# Identity & Channels (Go :8101)
echo "--- Identity & Channels (:8101) ---"
check "Identity health" "http://localhost:8101/healthz"

# Dispute Management (Python :8102)
echo "--- Dispute Management (:8102) ---"
check "Dispute health" "http://localhost:8102/healthz"
check "Dispute cases" "http://localhost:8102/v1/disputes/cases"

# ERPNext Sync (Python :8103)
echo "--- ERPNext Sync (:8103) ---"
check "ERPNext health" "http://localhost:8103/healthz"

# Regulatory Reporting (Python :8104)
echo "--- Regulatory Reporting (:8104) ---"
check "Regulatory health" "http://localhost:8104/healthz"

# Security Gateway (Go :8105)
echo "--- Security Gateway (:8105) ---"
check "Security health" "http://localhost:8105/healthz"
check "Vulnerability scan" "http://localhost:8105/v1/security/vulnerability-scan"

# Resilience Service (Rust :8106)
echo "--- Resilience Service (:8106) ---"
check "Resilience health" "http://localhost:8106/healthz"

echo ""
echo "=========================="
echo "RESULTS"
echo "=========================="
for r in "${RESULTS[@]}"; do
  echo "  $r"
done
echo ""
echo "Total: $TOTAL | Passed: $PASS | Failed: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "SMOKE TEST FAILED — $FAIL services not responding"
  exit 1
else
  echo ""
  echo "ALL SMOKE TESTS PASSED"
  exit 0
fi
