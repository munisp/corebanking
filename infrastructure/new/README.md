# 54Bank Core Banking Platform

A production-grade, cloud-native core banking platform built for Nigerian financial institutions, supporting 636 microservices across retail, corporate, Islamic, agricultural, and investment banking.

## Architecture
- **API Gateway**: Apache APISIX 3.11 with OpenAppSec WAF
- **Auth**: Keycloak 24.0.9 + Permify RBAC
- **Ledger**: TigerBeetle (double-entry, immutable)
- **Database**: PostgreSQL 16 + Drizzle ORM (294 tables)
- **Streaming**: Fluvio + Kafka
- **Workflow**: Temporal 1.30.3
- **Cache**: Redis 7.4.6
- **Observability**: OpenTelemetry + Prometheus + Grafana

## Quick Start
```bash
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

## Documentation
- [Architecture](docs/ARCHITECTURE.md)
- [Data Dictionary](docs/DATA_DICTIONARY.md)
- [Runbook](docs/RUNBOOK.md)
- [API Versioning](docs/API-VERSIONING.md)
