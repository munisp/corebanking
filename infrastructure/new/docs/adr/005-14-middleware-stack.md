# ADR-005: 14-Middleware Integration Stack

**Status:** Accepted  
**Date:** 2026-05-09  
**Decision Makers:** Engineering Team

## Context

Core banking requires event-driven processing, caching, authorization, workflow orchestration,
and financial ledger capabilities beyond what a monolithic Express server provides.

## Decision

Integrate 14 middleware services with TCP-based health probing and graceful fallback.

## Middleware Stack

| Middleware | Purpose | Fallback Mode |
|-----------|---------|---------------|
| **PostgreSQL** | Primary data store (267 tables) | In-memory seed data |
| **Redis** | Caching, session store, rate limiting | In-memory LRU cache |
| **Kafka** | Event streaming (20 banking topics) | In-memory event bus |
| **Keycloak** | OAuth2/OIDC identity provider | Local JWT auth |
| **Permify** | Fine-grained authorization | RBAC role checks |
| **Temporal** | Workflow orchestration (loan, onboarding) | Direct function calls |
| **Dapr** | Service mesh, pub/sub, state store | Direct HTTP calls |
| **Fluvio** | Stream processing (real-time analytics) | Batch processing |
| **TigerBeetle** | Double-entry financial ledger | Postgres GL tables |
| **Mojaloop** | Interbank payment switch (NIP) | NIBSS direct API |
| **OpenSearch** | Log aggregation, full-text search | Postgres text search |
| **APISIX** | API gateway, rate limiting, routing | Express middleware |
| **OpenAppSec** | ML-based WAF, DDoS protection | OWASP header rules |
| **Lakehouse** | Analytics data warehouse | Postgres views |

## Rationale

- Each middleware initializes via TCP socket probe (no external npm dependencies)
- Health status reported via `/healthz` endpoint (aggregated)
- Individual status via `/api/platform/{middleware}/status`
- Docker Compose includes all services for local development
- In-memory fallbacks ensure the platform runs without any middleware

## Consequences

- `docker-compose up` starts all middleware in development
- Production requires Kubernetes with Helm charts (`helm/54bank/`)
- Event publishing wired into Express write operations (audit events)
- Redis caching auto-applied to `/api/db/*` GET requests (30s TTL)
