# ADR-003: Database-First API Middleware Pattern

**Status:** Accepted  
**Date:** 2026-05-09  
**Decision Makers:** Engineering Team

## Context

PWA pages need data immediately, but backend microservices may not always be running (dev mode, cold start, service failure).

## Decision

Express BFF uses a **database-first middleware** pattern: query Postgres directly, fall back to in-memory seed data if DB is unavailable, then proxy to microservice as last resort.

## Rationale

- `/api/db/*` routes query Drizzle ORM tables directly from Express
- Eliminates dependency on microservice availability for read operations
- In-memory seed data provides realistic Nigerian banking data for demos
- Microservice proxy (`/api/platform/*`) used for write operations and complex business logic

## Data Flow

```
PWA Page → /api/db/customers → Postgres (SELECT * FROM customers)
                              ↓ (if DB unavailable)
                              → In-memory seed data (seedDataFallback.ts)
                              ↓ (if seed unavailable)  
                              → Microservice proxy (localhost:PORT/data)
```

## Consequences

- All 259 `/api/db/*` routes return `source: "database"` or `source: "seed"`
- Write operations still require microservice to be running
- Seed data must be kept realistic and up-to-date
- CrudWorkspace component reads from any source transparently
