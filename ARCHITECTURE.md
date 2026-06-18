# 54Bank Platform Architecture

## System Overview

54Bank is a multi-tenant core banking platform built for Nigerian financial institutions. The platform provides 425+ microservices across 46 functional categories, serving 565 PWA pages and 562 Flutter screens.

```
┌──────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  PWA (React/Vite) │ Flutter Mobile │ USSD │ WhatsApp    │
└──────────┬───────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────┐
│                   API Gateway (APISIX)                   │
│  Rate Limiting │ JWT Validation │ WAF (OpenAppSec)       │
└──────────┬───────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────┐
│              Express.js BFF (TypeScript)                  │
│  Auth │ RBAC │ Input Validation │ DB-First Middleware     │
│  Port: 3000 │ 1,682 route registrations                  │
└──────────┬───────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────┐
│               Microservices Layer                        │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Go(180) │  │Rust(139)│  │Python(77)│  │  TS(30)  │  │
│  │:8100-   │  │:8200-   │  │:8300-    │  │  (BFF)   │  │
│  │:8628    │  │:8399    │  │:8499     │  │          │  │
│  └────┬────┘  └────┬────┘  └────┬─────┘  └────┬─────┘  │
└───────┼────────────┼────────────┼──────────────┼────────┘
        │            │            │              │
┌───────▼────────────▼────────────▼──────────────▼────────┐
│                  Data & Middleware                        │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │PostgreSQL│  │  Redis   │  │  Kafka   │  │Keycloak │ │
│  │267 tables│  │  Cache   │  │  Events  │  │  SSO    │ │
│  │3,443 rows│  │  Session │  │  Streams │  │  RBAC   │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │TigerBeet.│  │ Temporal │  │OpenSearch│  │  Dapr   │ │
│  │  Ledger  │  │Workflows │  │  Search  │  │Sidecar  │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Fluvio  │  │ Permify  │  │Mojaloop  │  │Lakehouse│ │
│  │ Streams  │  │AuthZ     │  │  P2P     │  │Analytics│ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite + TypeScript | PWA with 565 pages |
| **Mobile** | Flutter/Dart | 562 screens |
| **BFF** | Express.js + TypeScript | API orchestration, auth, validation |
| **Services (Go)** | Go 1.22 + stdlib | Core banking, payments, treasury (180 services) |
| **Services (Rust)** | Rust + Actix-Web | Fraud detection, FX, risk scoring (139 services) |
| **Services (Python)** | Python 3.12 + FastAPI | Analytics, ML, regulatory reporting (77 services) |
| **Database** | PostgreSQL 16 + Drizzle ORM | 267 tables, 3,443+ seeded rows |
| **Cache** | Redis 7 | Session, rate limiting, query cache |
| **Events** | Apache Kafka | Event-driven transaction processing |
| **Workflows** | Temporal | Long-running loan approval, KYC workflows |
| **Search** | OpenSearch | Full-text search, audit log indexing |
| **IAM** | Keycloak | SSO, OAuth2, RBAC enforcement |
| **AuthZ** | Permify | Fine-grained attribute-based access control |
| **Ledger** | TigerBeetle | Double-entry accounting, high-throughput transfers |
| **Interop** | Mojaloop | P2P interbank transfers (NIP, NIBSS) |
| **Streaming** | Fluvio | Real-time data streaming |
| **Sidecar** | Dapr | Service mesh, state management |
| **Gateway** | APISIX | API gateway, load balancing, rate limiting |
| **WAF** | OpenAppSec | ML-based web application firewall |
| **Analytics** | Lakehouse (Iceberg) | Data warehousing, regulatory reporting |
| **IaC** | Terraform + Helm | AWS EKS, RDS, ElastiCache |
| **CI/CD** | GitHub Actions | 7 checks (lint, build, test, Go, Rust, Python, Docker) |

## Service Categories (46)

| # | Category | Services | Pages |
|---|----------|----------|-------|
| 1 | Overview | 10 | 10 |
| 2 | Core Banking | 24 | 24 |
| 3 | Payments & Transfers | 17 | 17 |
| 4 | Cards & Digital | 11 | 11 |
| 5 | Lending & Credit | 19 | 19 |
| 6 | Treasury & Markets | 16 | 16 |
| 7 | Trade & Structured Finance | 7 | 7 |
| 8 | Wealth & Investment | 7 | 7 |
| 9 | Accounting & GL | 17 | 17 |
| 10 | Risk & Compliance | 26 | 26 |
| 11 | KYC / KYB / Identity | 33 | 33 |
| 12 | Agent & Specialty Banking | 12 | 12 |
| 13 | Agriculture Banking | 9 | 9 |
| 14-46 | + 33 more categories | ... | ... |
| **Total** | | **425** | **565** |

## Authentication & Authorization

```
Client → APISIX (rate limit) → Express BFF
  ├── POST /api/auth/login → JWT (access + refresh tokens)
  ├── POST /api/auth/refresh → new access token
  ├── POST /api/auth/logout → token blacklist
  ├── POST /api/auth/mfa/enroll → TOTP secret + QR + backup codes
  ├── POST /api/auth/mfa/verify → validate TOTP code
  └── GET /api/auth/api-keys → manage API keys

Auth Middleware Pipeline:
  1. authMiddleware() → JWT validation, token blacklist check
  2. jwtAuthMiddleware → tenant extraction, role verification
  3. multiTenancyMiddleware → tenant isolation
  4. RBAC check → role ∈ {admin, operations, compliance, teller, auditor, customer}
```

### Password Security
- PBKDF2-SHA512 with 100,000 iterations
- Brute force protection: 5 attempts → 15-minute lockout
- MFA: RFC 6238 TOTP with 8 backup codes

## Data Flow

```
                  Request Flow
┌────────┐  ┌─────────┐  ┌──────────────┐  ┌──────────┐
│ Client │→│  APISIX  │→│  Express BFF │→│ Postgres │
│        │  │(gateway) │  │  (port 3000) │  │ (267 tbl)│
└────────┘  └─────────┘  └──────┬───────┘  └──────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              ┌──────────┐ ┌────────┐ ┌─────────┐
              │Go Service│ │  Rust  │ │ Python  │
              │(business │ │Service │ │ Service │
              │  logic)  │ │(perf)  │ │  (ML)   │
              └──────────┘ └────────┘ └─────────┘
```

### DB-First Middleware
All API routes use the DB-First middleware pattern:
1. Check Postgres for data → return with `source: "database"`
2. If Postgres is empty → return in-memory seed data with `source: "seed"`
3. If microservice is running → proxy to it with `source: "service"`

## Deployment Architecture

### Development
```bash
pnpm run dev  # Starts Express BFF + Vite HMR on port 3000
```

### Production (Kubernetes)
```
AWS EKS Cluster
├── Namespace: 54bank-prod
│   ├── Deployment: bff (Express, 3 replicas)
│   ├── Deployment: core-banking-go (Go services)
│   ├── Deployment: fraud-detection-rust (Rust services)
│   ├── Deployment: analytics-python (Python services)
│   ├── StatefulSet: postgres (RDS)
│   ├── StatefulSet: redis (ElastiCache)
│   ├── StatefulSet: kafka (MSK)
│   └── CronJob: db-backup (daily)
├── Namespace: 54bank-staging
└── Namespace: 54bank-monitoring
    ├── Prometheus
    ├── Grafana
    └── OpenSearch
```

### Infrastructure as Code
- **Terraform**: `terraform/main.tf` — AWS EKS, RDS, ElastiCache, MSK
- **Helm**: `helm/` — Kubernetes deployment charts
- **Docker**: 426 individual Dockerfiles + `docker-compose.yml`

## Monitoring & Observability

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Full health check (Postgres, Redis, Kafka) |
| `GET /healthz` | Simple liveness probe |
| `GET /ready` | Readiness probe |
| `GET /live` | K8s liveness probe |
| `GET /metrics` | Prometheus metrics |
| `GET /api/docs` | Swagger UI |

## Security Measures

- **OWASP Headers**: X-Frame-Options DENY, HSTS, CSP, X-Content-Type-Options, X-XSS-Protection
- **Rate Limiting**: 100 reads/15min, 20 writes/15min per IP
- **Input Validation**: Zod schemas on all API endpoints
- **Secrets**: AES-256-GCM encryption, no plaintext in code
- **CSRF**: Token-based protection on state-changing operations
- **Audit**: All auth events logged with correlation IDs

## Nigerian Regulatory Compliance

| Regulation | Implementation |
|-----------|----------------|
| CBN Guidelines | IFRS9 classification, CRR reporting, AMCON provisioning |
| NFIU AML/CFT | Transaction monitoring, CTR/STR filing, PEP screening |
| NDPR | Data encryption, consent management, breach notification |
| BVN/NIN | KYC verification via NIBSS, NIMC integration |
| NIP/NIBSS | Real-time interbank transfers, instant payments |
