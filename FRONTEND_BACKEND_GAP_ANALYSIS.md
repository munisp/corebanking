# 54Bank Frontend → Backend → Middleware Gap Analysis

## Executive Summary

**Frontend features: 28 distinct domains**  
**With full backend CRUD: 9 (32%)**  
**With only overview/stub endpoint: 12 (43%)**  
**With no backend at all: 7 (25%)**  
**Middleware packages actually installed: 0 of 13**

---

## Feature Coverage Matrix

### COVERED — Has Backend CRUD

| # | Frontend Feature | Backend Endpoints | DB Tables | Status |
|---|-----------------|-------------------|-----------|--------|
| 1 | Customer Operations | 10+ CRUD endpoints | customers, workflowCases, operatorActions | Full |
| 2 | Customer Cards | card profiles, controls, events | customerCards, customerCardEvents | Full |
| 3 | Customer Transfers | create, OTP, confirm, approvals | customerTransfers, customerApprovals | Full |
| 4 | Customer Bills | billers, bill pay, scheduling | customerSavedBillers, customerBillPayments | Full |
| 5 | Customer Statements | ledger, exports (CSV/XLSX) | customerStatements, customerStatementExports | Full |
| 6 | Billing Engine | 20+ billing API endpoints | 8+ billing tables | Full |
| 7 | Partner Onboarding | CRUD + approval workflows | In-memory + persistence hooks | Full |
| 8 | Agriculture Banking | 12 endpoints (Rust :8090) | farmers, agriLoans, cropInsurance, valueChain | Microservice |
| 9 | Teller Operations | 6 endpoints (Go :8091) | tellerSessions, tellerTransactions, vaultOperations | Microservice |
| 10 | Islamic Banking | 9 endpoints (Python :8092) | murabaha, ijara, mudarabah | Microservice |
| 11 | Trade Finance | 11 endpoints (Go :8093) | lettersOfCredit, warehouseReceipts, bankGuarantees | Microservice |

### MISSING — Frontend Exists, No Backend CRUD

| # | Frontend Feature | Frontend File | Backend Status | Needed |
|---|-----------------|---------------|----------------|--------|
| 12 | Mortgage Servicing | MortgageWorkspace.tsx | /overview only | Full CRUD + amortization |
| 13 | Education Loans | EducationLoansWorkspace.tsx | /overview only | Full CRUD + grace periods |
| 14 | Esusu Groups | EsusuWorkspace.tsx | /overview only | Full CRUD + rotation logic |
| 15 | Virtual Accounts | VirtualAccountsWorkspace.tsx | /overview only | Full CRUD + VAN operations |
| 16 | Dispute Management | DisputeManagementWorkspace.tsx | /overview only | Full CRUD + resolution workflows |
| 17 | Agricultural Insurance | AgriculturalInsuranceWorkspace.tsx | /overview only | Full CRUD + claims processing |
| 18 | Ledger Reconciliation | LedgerSyncWorkspace.tsx (25KB) | /overview only | Full reconciliation engine |
| 19 | ERPNext Sync | ERPNextWorkspace.tsx | /overview only | Full sync engine |
| 20 | Identity & Channels | IdentityChannelsWorkspace.tsx | No endpoint | Full identity management |
| 21 | Group Lending | ArchiveAdminRoutes (AdminGroupLendingPage) | No endpoint | Full CRUD + group management |
| 22 | Agent Banking | ArchiveAdminRoutes (AdminAgentBankingPage) | No endpoint | Full CRUD + agent management |
| 23 | Regulatory Reporting | ArchiveAdminRoutes (AdminRegulatoryReportingPage) | No endpoint | CBN report generation |

### MIDDLEWARE — All 13 Are Config-Only Stubs

| Middleware | Config Reference | Client Package | Actual Connection | Status |
|-----------|-----------------|---------------|-------------------|--------|
| Kafka | kafka.brokers, kafka.defaultTopicPrefix | NOT INSTALLED | None | STUB |
| Redis | redis.url | NOT INSTALLED | None | STUB |
| Postgres | postgres.connectionString | drizzle-orm (installed) | Drizzle ORM works | PARTIAL |
| TigerBeetle | tigerbeetle.addresses, clusterId | NOT INSTALLED | None | STUB |
| Temporal | temporal.hostPort, namespace | NOT INSTALLED | None | STUB |
| Keycloak | keycloak.issuer, clientId, clientSecret | NOT INSTALLED | None | STUB |
| Permify | permify.endpoint, tenantId | NOT INSTALLED | None | STUB |
| APISIX | apisix.adminUrl, publicGatewayUrl | NOT INSTALLED | None | STUB |
| Mojaloop | mojaloop.endpoint, scheme | NOT INSTALLED | None | STUB |
| Dapr | dapr.httpPort, placementAddress | NOT INSTALLED | None | STUB |
| Fluvio | fluvio.endpoint | NOT INSTALLED | None | STUB |
| OpenSearch | (not configured) | NOT INSTALLED | None | STUB |
| Lakehouse | lakehouse.endpoint, dataset | NOT INSTALLED | None | STUB |

**Note:** Postgres is the only middleware with a real client (drizzle-orm), but even it is only used for existing customer/billing tables, not for the domain verticals.

---

## Implementation Plan

### Phase 1: Missing Backend Services (12 domains)

**Rust Services:**
- Mortgage Servicing (complex amortization, LTV calculations) → :8094
- Agricultural Insurance (weather risk, claims processing, crop models) → extend :8090
- Ledger Reconciliation (high-perf matching, TigerBeetle parity checks) → :8100

**Go Services:**
- Esusu/Rotating Savings Groups (concurrent rotation, payout scheduling) → :8095
- Virtual Accounts (VAN generation, sub-account management) → :8096
- Agent Banking (POS transactions, float management) → :8097
- Group Lending (group lifecycle, joint liability) → :8098
- Identity & Channels (MFA, device management, channel routing) → :8101

**Python Services:**
- Education Loans (student loans, grace periods, income-driven repayment) → :8099
- Dispute Management (rules engine, chargeback workflows) → :8102
- ERPNext Sync (ERP integration, GL posting, journal sync) → :8103
- Regulatory Reporting (CBN compliance, NDIC reports, AML) → :8104

### Phase 2: Middleware Integration Layer

Shared middleware client library for all services:

**Go middleware-sdk:**
- Kafka producer/consumer (Segmentio kafka-go)
- Redis client (go-redis)
- Temporal workflow client
- Keycloak token validation
- Permify authorization checks
- APISIX route registration
- Mojaloop transfer initiation
- Dapr state/pubsub/service invocation

**Rust middleware-sdk:**
- TigerBeetle client (double-entry ledger operations)
- Fluvio producer/consumer (stream processing)
- Kafka producer (rdkafka)
- Redis client (redis-rs)

**Python middleware-sdk:**
- OpenSearch client (search/analytics)
- Lakehouse client (analytics queries)
- Kafka producer (confluent-kafka)
- Redis client (redis-py)
