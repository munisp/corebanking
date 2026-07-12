#!/bin/bash
# Builds and pushes all 41 consolidated group images to the DO registry.
#
# Usage:
#   ./docker/build-and-push.sh                      # build + push all groups (top → bottom)
#   ./docker/build-and-push.sh <group>              # build + push one group
#   BUILD_ONLY=1 ./docker/build-and-push.sh         # build without pushing
#   REVERSE=1 ./docker/build-and-push.sh            # build + push all groups (bottom → top)
#   REVERSE=1 BUILD_ONLY=1 ./docker/build-and-push.sh
#
set -e

export DOCKER_BUILDKIT=1

REGISTRY="registry.digitalocean.com/talentgraph-auth"
TAG="${TAG:-0.0.1}"
DOCKERFILE="docker/Dockerfile.consolidated"
CONTEXT="."
BUILD_ONLY="${BUILD_ONLY:-0}"
REVERSE="${REVERSE:-0}"
TARGET="${1:-}"

cd "$(dirname "$0")/.."

# ── Group data: name|services|port_base|lang ─────────────────────────────────
GROUPS_DATA="
ai-data-pipeline|data-intelligence,document-intelligence-py,lakehouse-etl-py,lakehouse-rs,materialized-view-engine-go|9100|python
ai-graph-search|cocoindex-pipeline-py,epr-kgqa-engine-py,epr-kgqa-go,epr-kgqa-py,epr-kgqa-rs,falkordb-coa-go,falkordb-coa-py,falkordb-coa-rs,falkordb-graph-engine-rs,falkordb-graph-rs,kgqa-reasoning-engine-py,langchain-agent-go,neo4j-coa-graph-go,neo4j-coa-graph-rs,neo4j-knowledge-graph-go,ollama-inference-go,qdrant-financial-search-go,qdrant-vector-store-rs,search-service|9107|rust
ai-ml-inference|art-adversarial-robustness-py,crop-yield-prediction-py,customer-insights-py,ml-service,soil-analysis-py|9128|python
channels-agents|agent-cash-management-py,agent-customer-360-py,agent-dormancy-prevention-py,agent-farmer-onboarding-go,agent-nl-reporting-py,agent-reconciliation-py,agent-transaction-investigation-py|9135|go
agent-banking-go|agent-banking-go|8080|go
channels-messaging|branded-comms-py,communication-hub,notification-router-go,notification-service,omini-service,realtime-notification-service,sms-alert-notification-py,sms-banking-gateway-go,sms-email-gateway-go,sms-otp-service-rs,sms-service,telegram-banking-commands-rs,telegram-bot-gateway-go,telegram-mini-app-go,telegram-notification-py,telegram-service,whatsapp-banking-flows-rs,whatsapp-business-gateway-go,whatsapp-cloud-api-go,whatsapp-document-service-rs,whatsapp-notification-py,whatsapp-service|9145|go
channels-mobile-web|custom-domain-go,developer-platform-service,developer-portal-go,mobile-bff,open-banking-baas-go,open-banking-go,stk-service|9169|go
channels-voice|chatbot-py,chatbot-service,interactive-ussd-agri-py,ussd-banking-gateway-go,ussd-gateway-service,ussd-multilingual-py,ussd-service,ussd-sim-toolkit-go,ussd-transaction-engine-rs,utility-payments-go,voice-agent-escalation-go,voice-asr-nigerian-py,voice-banking-gateway-go,voice-biometric-auth-rs,voice-call-analytics-py,voice-ivr-menu-go,voice-nlu-banking-py,voice-tts-nigerian-rs|9178|go
compliance-fraud|agent-fraud-detection-py,ai-fraud-scoring-rs,anomaly-detector-py,fraud-detection-rs,fraud-service,fraudfusion,fraudfusion-ensemble-rs,gnn-fraud-detection-py,mcmc-bayesian-risk-py,txn-pattern-analyzer-py|9197|rust
compliance-kyc-aml|address-verification-py,adverse-media-scanner-py,adverse-media-screening-py,agent-kyc-capture-go,aml-case-manager-go,aml-compliance-dashboard-py,aml-engine-rs,aml-risk-scoring-rs,aml-training-tracker-go,bvn-nin-verification-go,cbn-tiered-kyc-rs,corporate-doc-verification-py,efass-kyc-returns-py,goaml-integration-go,kyb-service,kyc-aml-screening-py,kyc-analytics-dashboard-py,kyc-data-quality-py,kyc-event-consumer-py,kyc-self-service-py,kyc-workflow-orchestration-py,multi-bureau-verification-go,pep-enhanced-dd-py,sanctions-batch-rescreener-rs,sanctions-engine-rs,sanctions-screening-rs,signature-verification-rs,telegram-kyc-bot-rs,ubo-service,video-kyc-py,watchlist-manager-rs|9209|python
beneficial-ownership-go|beneficial-ownership-go|9096|go
sanctions-screening-service|sanctions-screening-service|8283|rust
compliance-regulatory|agent-regulatory-returns-py,audit-service,basel-engine-rs,cbn-agri-returns-py,cbn-agsmeis-go,cbn-anchor-borrowers-go,cbn-compliance-checker-py,cbn-returns-py,cbn-service,ctr-auto-filer-go,efass-generator-rs,fatca-crs-rs,gl-regulatory-pipeline-py,ifrs9-ecl-engine-rs,ifrs9-engine-rs,internal-auditor-service,lcr-nsfr-rs,nfiu-ctr-str-filing-py,ndpr-compliance-py,regulatory-automation-py,regulatory-reporting-go,regulatory-sandbox-go,sar-filing-engine-go,soc2-evidence-collector-py|9244|python
compliance-service|compliance-service|8024|python
compliance-risk|contingent-liabilities-rs,risk-based-approach-py,risk-manager-service,risk-scoring-rs,tenant-provisioning-go,tenant-provisioning-py|9270|rust
core-accounts|account-closure-go,account-opening-go,account-service,account-statement-go,agent-account-opening-py,cif-management-go,customer-onboarding,dormancy-management-rs,virtual-account-service,virtual-accounts-go|9278|go
core-cards|atm-management,card-management-go,card-service,grid-token-card-go,pin-block-engine-rs,pin-hasher-rs,pos-terminal-go,scratch-card-pin-go,stk-service|9290|go
core-deposits|agri-savings-cycles-go,interest-accrual-engine-go,interest-computation-rs,savings-products-go|9301|go
savings-service|savings-service|80|python
dispute-service|dispute-service|8019|python
safe-deposit-go|safe-deposit-go|9423|go
interest-rate-engine-go|interest-rate-engine-go|9373|go
core-lending|agent-loan-origination-py,bnpl-service,collateral-valuation-rs,cooperative-credit-scoring-py,credit-scoring-py,credit-service,debt-collection-go,education-loan-service,education-loans-py,group-lending-go,loan-calculator-go,loan-origination-go,loan-service,microfinance-engine-go,microfinance-py,syndicated-loans-go,core-lending-go|9310|go
mortgage-service|mortgage-service|8080|go
core-payments|beneficiary-management-go,commission-settlement,mandate-management-go,merchant-service,nibss-direct-debit-go,nibss-nip-engine-go,payment-hub,payment-processing-service,payment-rails-connectors,qr-payments-go,standing-orders-go,utility-payments-go,whatsapp-payment-integration-go,payment-service|9330|go
bulk-payments-rs|bulk-payments-rs|8130|rust
cheque-clearing-go|cheque-clearing-go|8080|go
customer-management|customer-360-py,customer-engagement-py,customer-feedback-py,expense-mgmt-go,i18n-service-go,relationship-manager-service|9348|go
customer-pricing|aggregation-center-go,product-factory-rs,rate-cascade-rs,realtime-pricing-rs,relationship-pricing-rs|9356|go
fee-management-go|fee-management-go|8080|go
identity-auth|auth-enforcer-rs,auth-service,biometric-auth-rs,biometric-service,browser-fingerprint-go,continuous-liveness-rs,face-match-rs,identity-channels-go,identity-verification-go,identity-verification-service,jwt-validator-rs,liveness-detection-rs,liveness-inference-py,liveness-orchestrator-go,mfa-orchestrator-go,otp-hardening-rs,pkce-auth-flow-go,token-rotation-rs,user-service|9364|rust
verification-service|verification-service|8383|node
verification-ui|verification-ui|80|node
infra-caching|bloom-filter-cache-rs,cache-invalidation-rs,cdn-edge-cache-go,hot-data-cache-rs,postgres-query-cache-rs,prepared-stmt-cache-go,query-cache-engine-rs,redis-cache-middleware-rs,redis-cache-rs,redis-session-store-go,sw-api-cache-go|9387|rust
infra-database|avro-schema-registry-go,backup-manager-py,data-export-rs,db-migration-manager-go,db-migrations,pgbouncer-manager-go,postgres-adapter-go,postgres-persistence-rs,postgres-query-optimizer-go,postgres-vacuum-py,read-replica-router-rs,route-schema-enforcer-go,table-partitioner-rs|9400|go
infra-messaging|billing-event-processor-py,event-bus-go,event-correlator-py,event-dedup-engine-rs,event-sourcing-go,event-streaming-go,fluvio-streams-rs,fluvio-wasm-transform-rs,kafka-batch-producer-rs,kafka-broker-go,kafka-consumer-optimizer-go,kafka-lakehouse-connector,kafka-schema-registry-go,kafka-streaming-go,stream-response-go|9415|go
infra-network|adaptive-rate-limiter-rs,circuit-breaker-rs,connection-pooler-rs,connectivity-service,egress-controller-rs,express-rate-limiter-rs,grpc-gateway-rs,grpc-hot-path-go,http2-multiplexer-rs,keepalive-tuner-rs,mtls-mesh-rs,network-optimization-service,network-policy-manager-py,path-validator-rs,request-validator-py,route-trie-optimizer-rs,tls-terminator-go|9432|rust
infra-observability|apm-sentry-py,changelog-generator-py,corporate-monitoring-go,error-telemetry-py,incident-responder-go,kpi-threshold-monitor-rs,ops-dashboard,otel-collector-go,siem-exporter-py,synthetic-monitoring,txn-monitoring-rules-rs,wire-transfer-monitor-rs|9451|go
ledger-gl|accounting-rules-rs,chart-of-accounts-service,finance-service,gl-engine-go,gl-engine-rs,operations-control-gl-rs,salary-processing-go,tigerbeetle-adapter-rs,tigerbeetle-batch-engine-rs,tigerbeetle-multicurrency-rs,tigerbeetle-postgres-sync,tigerbeetle-protocol-rs,tigerbeetle-sync-go,transaction-ledger|9465|rust
ledger-reconciliation|banking-clearing-ops-rs,ledger-reconciliation-rs,mojaloop-settlement-mgr-go,recon-engine-rs,reconciliation-engine-rs,reconciliation-service|9481|rust
employee-service|employee-service|8080|go
eod-processor-go|eod-processor-go|8080|go
erp-integration|erpnext-bridge-go,erpnext-integration-service,erpnext-sync-py|9750|go
mojaloop-connector|mojaloop-connector|9489|go
platform-api|admin-service,api-key-enforcer-go,api-key-vault-go,api-marketplace-go,api-metering,api-versioning-go,apisix-plugin-optimizer-go,bundle-splitter-py,cors-gateway-go,dapr-sidecar-go,graphql-gateway-go,orchestrator-service,plugin-marketplace-py,security-gateway-go,webhook-engine-go|9492|go
platform-devops|ab-testing-py,certificate-manager-py,feature-entitlement-go,feature-flag-engine-rs,flag-audit-rs,graduated-rollout-rs,hpa-autoscaler-go,keda-scaler-go|9508|go
platform-tenant|billing-enforcement-rs,billing-ingestor-go,billing-orchestrator-go,billing-rating-rs,billing-rbac-rs,billing-service,multi-entity-go,tenant-billing-go,tenant-export-go,tenant-isolation-go,tenant-management,tenant-metering-go,tenant-ratelimit-rs,white-label-engine-go|9518|go
security-access|approval-workflow-go,maker-checker-go,pbac-engine-rs,permify-authz-go|9534|go
security-waf|body-limit-enforcer-go,clickjack-defender-rs,cloud-kms-bridge-rs,csp-nonce-engine-go,ddos-protection-go,ddos-shield-go,distroless-builder-py,docker-hardener-py,field-level-encryption-rs,helm-validator-go,hsm-key-manager-rs,image-scanner-go,ip-allowlist-rs,key-rotation-engine-go,ml-security-service,openappsec-waf-rs,output-encoder-rs,pci-scanner-rs,security-service,sri-validator-rs,waf-rules-engine-rs|9540|rust
specialized-agri|acgsf-guarantee-go,agri-esg-impact-py,agri-evoucher-go,agri-input-marketplace-go,agri-iot-sensor-rs,agri-logistics-go,agri-reinsurance-go,agriculture-banking-rs,carbon-service,cooperative-financials-py,cooperative-management-go,cooperative-meetings-go,crossborder-agri-trade-rs,esusu-groups-go,farm-boundary-mapping-rs,fisheries-aquaculture-go,livestock-finance-rs,livestock-insurance-rs,livestock-management-rs,multi-peril-crop-insurance-rs,nirsal-agro-geocoop-go,nirsal-credit-guarantee-go,post-harvest-loss-tracker-go,quality-certification-go,satellite-crop-monitor-rs,warehouse-management-go|9563|rust
agricultural-service|agricultural-service|8015|go
esusu-service|esusu-service|9578|go
specialized-engagement|component-memoizer-py,gamification-service,growth-features-go,optimistic-ui-engine-go,skeleton-loading-rs,sorted-set-ranking-go,virtual-scroll-engine-rs|9593|go
specialized-islamic|area-yield-index-insurance-py,diaspora-banking-py,enaira-cbdc-py,exam-management-py,insurance-py,islamic-banking-py,islamic-banking-service,parametric-insurance-iot-rs,pension-py|9602|python
etherisc-service|etherisc-service|9162|go
insurance-service|insurance-service|80|python
trade-fx|commodity-exchange-rs,exchange-rate-service,fx-rates-engine-rs,iso20022-hub-rs,remittance-go,swift-messaging-go,swift-iso20022-rs,trade-finance-gl-go,trade-finance-go|9615|rust
trade-finance-service|trade-finance-service|8080|go
trade-supply-chain|bank-guarantees-go,equipment-leasing-go,escrow-go,escrow-service,factoring-go,leasing-go,locker-go,lpo-service,project-finance-go,supply-chain-finance-go,supply-chain-service,trust-estate-rs|9627|go
treasury-investments|cash-pooling-go,commodity-price-intelligence-py,custody-service-go,insurance-portfolio-analytics-py,lcr-nsfr-rs,money-market-rs,otc-derivatives-rs,portfolio-mgmt-rs,securities-trading-rs,tigerbeetle-postgres-sync,treasury-liquidity-py,treasury-liquidity-rs,treasury-service,wealth-mgmt-py,fixed-assets-go|9641|rust
temporal-access-service|temporal-access-service|8080|go
workflow-batch|batch-aggregator-go,batch-processing-py,e2e-orchestrator-go,saga-coordinator-py,temporal-memoizer-go,temporal-orchestrator-py,temporal-sagas-go,temporal-worker-go,workflow-engine-py|9658|go
workflow-operations|accessibility-auditor-py,animal-id-traceability-rs,banking-domain-integration-go,banking-operations-pipeline-py,branch-manager-service,branch-operations-go,business-service,cac-realtime-api-go,contract-test-rs,core-banking-go,credit-bureau-rs,credit-facility-go,dispute-management-py,docling-service,document-management-py,document-service,fast-json-serializer-rs,fixed-assets-go,idempotency-go,immutable-audit-rs,inventory-py,load-test-runner-py,ndpr-compliance-py,ocr-service,offline-resilience-rs,opensearch-indexer-py,opensearch-optimizer-py,pentest-orchestrator-go,platform-hardening-rs,platform-operations-engine-py,platform-security-infra-go,request-coalescer-go,resilience-service-rs,response-compressor-rs,secrets-rotation-rs,secrets-vault-go,security-audit-logger-py,security-hardening-go,session-security-rs,sql-parameterizer-rs,standing-charges-go,stress-testing-rs,teller-operations-go,teller-service,typology-detector-rs,ubo-ownership-graph-rs,unit-test-runner-py,vault-integration-rs|9671|go
tax-reporting-py|tax-reporting-py|8338|python
workflow-reporting|analytics-engine-py,api-analytics-py,billing-analytics-py,customer-360-dashboard-py,kpi-analytics-py,kpi-engine-go,opensearch-analytics-py,prometheus-dashboard-py,reporting-service,stakeholder-kpi-dashboard-py,statement-generator-py|9727|python
"

# ── Build one group ────────────────────────────────────────────────────────────
build_group() {
    local group="$1"
    local services="$2"
    local port_base="$3"
    local lang="$4"
    local image="${REGISTRY}/54link-dev-${group}:${TAG}"
    local svc_count
    svc_count=$(echo "$services" | tr ',' '\n' | wc -l | xargs)

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Building : $group"
    echo "  Image    : $image"
    echo "  Services : $svc_count"
    echo "  Port base: $port_base"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local output_flag="--load"
    if [ "$BUILD_ONLY" = "0" ]; then
        # Force gzip compression — DO registry rejects zstd (BuildKit default)
        output_flag="--output type=image,name=${image},push=true,compression=gzip,force-compression=true"
    fi

    if ! docker buildx build \
        --platform linux/amd64 \
        --provenance=false \
        --file "$DOCKERFILE" \
        --build-arg "SERVICES=$services" \
        --build-arg "PRIMARY_LANG=$lang" \
        --build-arg "PORT_BASE=$port_base" \
        --tag "$image" \
        $output_flag \
        "$CONTEXT"; then
        echo "[failed] $group ✗"
        return 1
    fi

    echo "[done] $group ✓"
}

# ── Main ──────────────────────────────────────────────────────────────────────
FAILED=""

while IFS='|' read -r group services port lang; do
    # Skip blank lines
    [ -z "$group" ] && continue

    # If a target is specified, skip everything else
    if [ -n "$TARGET" ] && [ "$group" != "$TARGET" ]; then
        continue
    fi

    build_group "$group" "$services" "$port" "$lang" || FAILED="$FAILED $group"

done <<< "$([ "$REVERSE" = "1" ] && echo "$GROUPS_DATA" | tac || echo "$GROUPS_DATA")"

if [ -n "$TARGET" ] && [ -z "$(echo "$GROUPS_DATA" | grep "^${TARGET}|")" ]; then
    echo "ERROR: unknown group '$TARGET'"
    exit 1
fi

echo ""
echo "════════════════════════════════════════"
if [ -z "$FAILED" ]; then
    echo "  All groups built successfully ✓"
else
    echo "  Failed:$FAILED"
    exit 1
fi
echo "════════════════════════════════════════"
