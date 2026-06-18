# 54Bank Platform Architecture

## System Overview

54Bank is a full-stack core banking platform built for Nigerian and African financial institutions. It supports commercial banks, microfinance banks, mortgage banks, and agriculture banking.

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ React PWA│  │ Flutter  │  │ USSD     │  │ Voice/SMS  │  │
│  │ (Vite)   │  │ Mobile   │  │ Gateway  │  │ Channels   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
└───────┼──────────────┼─────────────┼──────────────┼─────────┘
        │              │             │              │
┌───────┴──────────────┴─────────────┴──────────────┴─────────┐
│                    API Gateway (APISIX)                       │
│  - Rate limiting  - WAF (OpenAppSec)  - JWT validation       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                    Express Server (:3000)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Auth/RBAC│  │ CORS     │  │ Validation│  │ Audit Log  │  │
│  │ JWT+MFA  │  │ Whitelist│  │ Zod+BVN  │  │ Events     │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 260 Drizzle CRUD Routes (/api/db/*)                  │   │
│  │ → SELECT/INSERT/UPDATE/DELETE with pagination        │   │
│  └──────────────────────────┬───────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────┐
│                    Data Layer                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Postgres │  │ Redis    │  │ TigerBtl │  │ OpenSearch │  │
│  │ 267 tbls │  │ Cache    │  │ Ledger   │  │ Analytics  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               Microservices (425 total)                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ Go (180)   │  │ Rust (139) │  │ Python(106)│            │
│  │ stdlib-only│  │ actix-web  │  │ psycopg2   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               Event & Workflow Layer                          │
│  ┌──────┐  ┌────────┐  ┌────────┐  ┌──────┐  ┌──────────┐ │
│  │Kafka │  │Temporal│  │Mojaloop│  │ Dapr │  │ Fluvio   │ │
│  │Events│  │Workflow│  │ILP Xfer│  │Sidecar│  │Streaming │ │
│  └──────┘  └────────┘  └────────┘  └──────┘  └──────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Domain Model (46 categories)

| Domain | Tables | Services | Description |
|--------|--------|----------|-------------|
| Core Banking | 12 | 15 | Accounts, customers, transactions, branches |
| Payments | 8 | 12 | Transfers (NIP/NEFT/RTGS), bills, cards |
| Lending | 10 | 14 | Loans, repayments, collateral, credit scoring |
| Treasury | 6 | 8 | FX, bonds, money market, ALM |
| KYC/AML | 8 | 10 | Verification, sanctions, PEP screening |
| Agriculture | 15 | 40 | Farmers, cooperatives, NIRSAL, livestock |
| Channel Banking | 12 | 25 | Voice, Telegram, WhatsApp, USSD, SMS |
| Risk & Compliance | 10 | 15 | Regulatory reporting, capital adequacy |

## Authentication Flow

```
Client → POST /api/auth/login (email, password)
  → PBKDF2-SHA512 verify → JWT token (8h)
  → MFA required? → POST /api/auth/mfa/validate (TOTP)
  → Set HttpOnly cookie + return Bearer token
  → All /api/* routes validate JWT via middleware
  → Role checked: admin|operations|compliance|treasury|branch|teller|user|auditor
```

## Data Flow

```
PWA page → GET /api/db/{table}?page=1&limit=20
  → Express dbFirstMiddleware
  → Drizzle ORM query → PostgreSQL
  → Return { items: [...], total: N, page: 1, source: "database" }
```

## Deployment Architecture

- **CI:** GitHub Actions (7 checks: lint, build, test, Go, Rust, Python, Docker)
- **CD:** Auto-deploy to staging on merge to main
- **Container:** Docker (multi-stage builds)
- **Orchestration:** Kubernetes (Helm charts, HPA 2-10 replicas)
- **Database:** PostgreSQL 16 (RDS in AWS, local in dev)
- **Cache:** Redis 7 (ElastiCache in AWS)
- **IaC:** Terraform (VPC, EKS, RDS, ElastiCache)

## Security Architecture

- PBKDF2-SHA512 (100K iterations) password hashing
- JWT HS256 tokens (8h access, 7d refresh)
- MFA/TOTP (RFC 6238) with backup codes
- API key management for service-to-service auth
- 7 OWASP security headers
- CORS origin whitelist (environment-specific)
- Brute force protection (5 attempts → 15-min lockout)
- Token blacklisting on logout
- Input validation (Zod + Nigerian validators)
- Rate limiting on all routes
