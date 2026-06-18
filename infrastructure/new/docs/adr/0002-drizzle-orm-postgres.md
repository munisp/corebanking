# ADR 0002: Drizzle ORM with PostgreSQL

## Status
Accepted

## Context
Platform needs 267 tables with TypeScript type safety, migrations, and seed data management.

## Decision
Use Drizzle ORM with PostgreSQL for the data layer. All tables defined in `drizzle/schema.ts` with `pgTable()`. Seed data managed via `seedDatabase.ts` and fallback files.

## Consequences
- **Positive:** Full TypeScript type inference from schema to query
- **Positive:** Push-based migrations (`drizzle-kit push`) for rapid iteration
- **Negative:** No versioned migration files (push-only, not suitable for zero-downtime deploys yet)
- **Mitigated:** Can switch to `drizzle-kit generate` for production migration files
