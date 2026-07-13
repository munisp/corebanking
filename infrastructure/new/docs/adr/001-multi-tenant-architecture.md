# ADR-001: Multi-Tenant Architecture

**Status:** Accepted  
**Date:** 2026-05-09  
**Decision Makers:** Engineering Team

## Context

54Bank serves multiple financial institutions (MFBs, fintechs, commercial banks) on a single platform.
We need to isolate customer data while sharing infrastructure.

## Decision

Use **row-level multi-tenancy** with `tenantId` column on all operational tables.

## Rationale

- **Shared schema** reduces operational complexity vs. database-per-tenant
- **Row-level filtering** via `tenantId` WHERE clause on every query
- Drizzle ORM enforces `tenantId` in all generated queries
- PostgreSQL Row Level Security (RLS) as defense-in-depth
- Single deployment, multiple tenants = lower infrastructure cost

## Consequences

- Every table must include `tenantId` (enforced in Drizzle schema)
- All queries must filter by `tenantId` — missing filter = data leak
- Index strategy: composite indexes must include `tenantId`
- Cross-tenant reporting requires explicit tenant aggregation
