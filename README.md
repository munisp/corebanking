# 54Bank — Africa-First Core Banking Platform

> **565 pages · 46 domains · 426 microservices · 267 Postgres tables · 14 middleware**

## Overview

54Bank is a comprehensive core banking platform purpose-built for the African and Nigerian market. It provides full-stack banking capabilities from account opening to AML compliance, with support for commercial banks, microfinance banks, mortgage banks, and agriculture banking.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   PWA (React + TypeScript)               │
│              565 pages · 46 sidebar categories           │
├─────────────────────────────────────────────────────────┤
│                  APISIX API Gateway                      │
│           Rate limiting · Auth · WAF · Routing           │
├─────────────────────────────────────────────────────────┤
│              Express.js Server (TypeScript)               │
│  259 CRUD routes · JWT Auth · RBAC · Input Validation    │
├──────────┬──────────┬──────────┬────────────────────────┤
│ Go (180) │ Rust(139)│ Python   │  Middleware Layer       │
│ Services │ Services │ (106)    │  Kafka · Redis ·        │
│          │          │ Services │  Temporal · Keycloak    │
├──────────┴──────────┴──────────┴────────────────────────┤
│               PostgreSQL + TigerBeetle                   │
│        267 tables · Double-entry ledger · ACID           │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 22+ (via Volta)
- PostgreSQL 15+
- pnpm 9+

### Setup

```bash
# Clone and install
git clone https://github.com/munisp/NGApp.git
cd NGApp
pnpm install

# Database setup
createdb bank54_db
export DATABASE_URL="postgresql://bank54_user:bank54_secure_2026@localhost:5432/bank54_db"

# Push schema and seed
npx drizzle-kit push
pnpm run seed

# Start development server
pnpm run dev
```

The platform will be available at `http://localhost:3000`.

### Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@54bank.ng | admin |
| Operations | ops@54bank.ng | ops123 |
| Compliance | compliance@54bank.ng | comp123 |
| Treasury | treasury@54bank.ng | treas123 |
| Branch | branch@54bank.ng | branch123 |

## Banking Domains (46 Categories)

| Category | Pages | Description |
|----------|-------|-------------|
| Core Banking | 24 | Accounts, customers, transactions, branches |
| Payments & Transfers | 17 | NIBSS NIP, RTGS, NEFT, bill payments |
| Cards & Digital | 11 | Card issuance, POS, ATM, digital wallets |
| Lending & Credit | 19 | Loans, credit scoring, collections, restructuring |
| Treasury & Markets | 16 | FX trading, money market, fixed income |
| Trade & Structured Finance | 7 | Letters of credit, bank guarantees |
| Wealth & Investment | 7 | Portfolio management, mutual funds |
| Accounting & GL | 17 | General ledger, chart of accounts, reconciliation |
| Risk & Compliance | 26 | AML, CTR, SAR, sanctions screening |
| KYC / KYB / Identity | 33 | BVN, NIN, biometric, corporate verification |
| Agent & Specialty Banking | 12 | Agent banking, Islamic banking, eNaira |
| Agriculture Banking | 9 | Farmer loans, crop insurance, cooperatives |
| Channel Banking | 25 | Voice, Telegram, WhatsApp, USSD, SMS |
| Agriculture Enhancement | 40 | NIRSAL, cooperative management, livestock |
| + 32 more categories | ... | Infrastructure, security, observability |

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React, TypeScript, Vite, TailwindCSS |
| Backend | Express.js, TypeScript |
| Microservices | Go, Rust, Python (426 total) |
| Database | PostgreSQL 15, Drizzle ORM |
| Ledger | TigerBeetle |
| Event Streaming | Apache Kafka, Fluvio |
| Caching | Redis |
| Auth | Keycloak, JWT, RBAC (6 roles) |
| Authorization | Permify |
| Workflows | Temporal |
| API Gateway | Apache APISIX |
| Search | OpenSearch |
| WAF | OpenAppSec |
| Interoperability | Mojaloop (ILP) |
| Data Lake | Apache Iceberg (Lakehouse) |

## 14-Middleware Stack

All services integrate with the full middleware stack:

1. **Kafka** — Event streaming for transactions, AML alerts, audit logs
2. **Dapr** — Microservice runtime with pub/sub, state management
3. **Fluvio** — Real-time stream processing for fraud detection
4. **Temporal** — Workflow orchestration for KYC, loan approval, SAR filing
5. **PostgreSQL** — Primary OLTP database (267 tables)
6. **Keycloak** — Identity provider with SSO, MFA
7. **Permify** — Fine-grained authorization (PBAC)
8. **Redis** — Session cache, rate limiting, OTP storage
9. **Mojaloop** — Interoperability hub for instant payments
10. **OpenSearch** — Full-text search, analytics dashboards
11. **APISIX** — API gateway with rate limiting, auth plugins
12. **OpenAppSec** — Web application firewall
13. **TigerBeetle** — Double-entry financial ledger
14. **Lakehouse** — Apache Iceberg data lake for analytics

## Nigerian Regulatory Compliance

- **CBN** — Central Bank of Nigeria prudential requirements
- **NFIU** — Nigerian Financial Intelligence Unit reporting
- **NDPR** — Nigeria Data Protection Regulation
- **NIBSS** — Nigeria Inter-Bank Settlement System integration
- **BVN** — Bank Verification Number validation
- **NIN** — National Identification Number verification
- **NIRSAL** — Nigeria Incentive-Based Risk Sharing System
- **FATF** — Financial Action Task Force recommendations
- **PCI-DSS** — Payment Card Industry Data Security Standard
- **IFRS 9** — International Financial Reporting Standard

## API Documentation

- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI Spec: `http://localhost:3000/api/docs/spec`
- Health Check: `http://localhost:3000/api/health`
- Prometheus Metrics: `http://localhost:3000/api/metrics/prometheus`

## CI/CD Pipeline

7 automated checks on every push:
1. **Lint & Typecheck** — ESLint + TypeScript strict mode
2. **Build** — Vite production build
3. **Unit Tests** — Vitest test suite
4. **Go Services** — `go build` for all 180 Go services
5. **Rust Services** — `cargo check` for all 139 Rust services
6. **Python Services** — Python syntax verification for 106 services
7. **Docker Build** — Multi-stage Docker image build

## Deployment

### Docker
```bash
docker build -t 54bank:latest .
docker run -p 3000:3000 --env-file config/production.env 54bank:latest
```

### Kubernetes (Helm)
```bash
helm install 54bank ./helm/54bank \
  --namespace 54bank \
  --create-namespace \
  --set postgresql.existingSecret=54bank-db-credentials \
  --set redis.existingSecret=54bank-redis-credentials
```

### Database Backup
```bash
# Automated daily backup
./scripts/db-backup.sh

# Restore from backup
./scripts/db-restore.sh /var/backups/54bank/bank54_db_20260514.sql.gz
```

## Project Structure

```
NGApp/
├── client/src/           # React PWA (554 pages)
│   ├── pages/            # Page components
│   ├── components/       # Shared components (CrudWorkspace, etc.)
│   └── hooks/            # Custom React hooks
├── server/               # Express.js backend
│   ├── index.ts          # Main server entry point
│   └── lib/              # Server modules
│       ├── auth.ts       # JWT + RBAC authentication
│       ├── drizzleRoutes.ts  # 259 CRUD route configs
│       ├── inputValidation.ts  # Zod validation schemas
│       ├── security.ts   # OWASP headers, WAF
│       └── middlewareIntegration.ts  # 14 middleware
├── drizzle/
│   └── schema.ts         # 267 Drizzle table definitions
├── services/             # 426 microservices
│   ├── *-go/             # 180 Go services
│   ├── *-rs/             # 139 Rust services
│   └── *-py/             # 106 Python services
├── helm/                 # Kubernetes Helm charts
├── scripts/              # Operational scripts
├── config/               # Environment configs
└── apisix/               # API gateway config
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with proper tests
4. Run lint: `pnpm run lint`
5. Run typecheck: `pnpm run typecheck`
6. Run tests: `pnpm test`
7. Submit a pull request

## License

Proprietary — 54Bank Technologies Ltd. All rights reserved.
