#!/usr/bin/env bash
# build-push-deploy.sh
# Builds, pushes, and Helm-deploys every local service that is not yet in the cluster.
#
# Usage:
#   bash scripts/build-push-deploy.sh              # build + push + deploy all undeployed
#   bash scripts/build-push-deploy.sh --dry-run    # print commands only, no execution
#   bash scripts/build-push-deploy.sh <svc-name>   # single service
#
# Prerequisites:
#   - doctl registry login  (or docker login registry.digitalocean.com)
#   - helm, kubectl configured against 54link-dev cluster

set -euo pipefail

REGISTRY="registry.digitalocean.com/talentgraph-auth"
NAMESPACE="54link-dev"
TAG="${TAG:-0.0.1}"
BASE="$(cd "$(dirname "$0")/.." && pwd)"
CHARTS_DIR="$BASE/infrastructure/charts"
SERVICES_DIR="$BASE/services"
DRY_RUN=false
SINGLE=""

for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
  [[ "$arg" != "--dry-run" ]] && SINGLE="$arg"
done

run() {
  if $DRY_RUN; then
    echo "  [dry-run] $*"
  else
    "$@"
  fi
}

# ── Services to build and deploy ──────────────────────────────────────────────
SERVICES=(
  biometric-service
  cac-realtime-api-go
  cash-pooling-go
  cbn-service
  communication-hub
  contingent-liabilities-rs
  developer-platform-service
  docling-service
  eod-processor-go
  exchange-rate-service
  finance-service
  graphql-gateway-go
  hsm-key-manager-rs
  identity-verification-service
  ifrs9-engine-rs
  interbank-lending-rs
  iso20022-hub-rs
  kpi-engine-go
  kyb-service
  lcr-nsfr-rs
  ledger-reconciliation-rs
  maker-checker-go
  merchant-service
  microfinance-engine-go
  ml-security-service
  ml-service
  mobile-bff
  money-market-rs
  multi-entity-go
  multicurrency-revaluation-rs
  ndpr-compliance-py
  network-optimization-service
  nfiu-ctr-str-filing-py
  nibss-direct-debit-go
  nibss-nip-engine-go
  notification-service
  open-banking-go
  ops-dashboard
  otc-derivatives-rs
  payment-rails-connectors
  permify-authz-go
  pin-block-engine-rs
  product-factory-rs
  realtime-notification-service
  realtime-pricing-rs
  reconciliation-service
  regulatory-reporting-go
  relationship-manager-service
  reporting-service
  request-validator-py
  risk-manager-service
  sanctions-screening-service
  sar-filing-engine-go
  search-service
  securities-trading-rs
  security-service
  sms-service
  standing-charges-go
  stk-service
  supply-chain-service
  syndicated-loans-go
  synthetic-monitoring
  telegram-service
  tigerbeetle-ledger-rs
  tigerbeetle-postgres-sync
  trade-finance-service
  txn-monitoring-rules-rs
  ussd-gateway-service
  ussd-service
  verification-ui
  video-kyc-py
  virtual-account-service
  voice-banking-gateway-go
  warehouse-management-go
  whatsapp-service
  wire-transfer-monitor-rs
  clickjack-defender-rs
  kgqa-reasoning-engine-py
  langchain-agent-rs
  neo4j-coa-graph-rs
  neo4j-knowledge-graph-go
  qdrant-financial-search-rs
  qdrant-vector-store-rs
  tax-reporting-py
  mortgage-service
  agricultural-service
  insurance-service
  safe-deposit-go
  savings-service
  etherisc-service
  trade-finance-service
)

# If a single service name was passed, only process that one
if [[ -n "$SINGLE" ]]; then
  SERVICES=("$SINGLE")
fi

BUILT=0; PUSHED=0; DEPLOYED=0; FAILED=0

for SVC in "${SERVICES[@]}"; do
  SVC_DIR="$SERVICES_DIR/$SVC"
  CHART_DIR="$CHARTS_DIR/$SVC"
  IMAGE="$REGISTRY/54link-dev-$SVC:$TAG"

  echo ""
  echo "══════════════════════════════════════════"
  echo "  $SVC"
  echo "══════════════════════════════════════════"

  # ── 1. Check Dockerfile exists ────────────────
  if [[ ! -f "$SVC_DIR/Dockerfile" ]]; then
    echo "  ✗ SKIP — no Dockerfile in $SVC_DIR"
    ((FAILED++))
    continue
  fi

  # ── 2. Build ──────────────────────────────────
  echo "  → build  $IMAGE"
  if run docker build -t "$IMAGE" "$SVC_DIR"; then
    echo "  ✓ build OK"
    ((BUILT++))
  else
    echo "  ✗ build FAILED — skipping push/deploy"
    ((FAILED++))
    continue
  fi

  # ── 3. Push ───────────────────────────────────
  echo "  → push   $IMAGE"
  if run docker push "$IMAGE"; then
    echo "  ✓ push OK"
    ((PUSHED++))
  else
    echo "  ✗ push FAILED — skipping deploy"
    ((FAILED++))
    continue
  fi

  # ── 4. Deploy via Helm ────────────────────────
  if [[ ! -d "$CHART_DIR" ]]; then
    echo "  ✗ SKIP deploy — no Helm chart at $CHART_DIR"
    ((FAILED++))
    continue
  fi

  echo "  → deploy $SVC  (helm upgrade --install)"
  if run helm upgrade --install "$SVC" "$CHART_DIR" \
      --namespace "$NAMESPACE" \
      --create-namespace \
      --set image.tag="$TAG" \
      --wait --timeout 120s; then
    echo "  ✓ deploy OK"
    ((DEPLOYED++))
  else
    echo "  ✗ deploy FAILED"
    ((FAILED++))
  fi
done

echo ""
echo "══════════════════════════════════════════"
echo "  Summary"
echo "══════════════════════════════════════════"
echo "  Built:    $BUILT"
echo "  Pushed:   $PUSHED"
echo "  Deployed: $DEPLOYED"
echo "  Failed:   $FAILED"
$DRY_RUN && echo "  (dry-run — no changes made)"
