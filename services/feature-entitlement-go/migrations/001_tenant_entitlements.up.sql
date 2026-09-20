-- PL-08: durable entitlement store for feature-entitlement-go.
-- Entitlements were previously held in an in-memory map seeded with fabricated
-- banks and lost on every restart. Postgres is now authoritative; main.go
-- initDB() creates this table idempotently as a fallback for dev, but real
-- deployments should apply this migration.
CREATE TABLE IF NOT EXISTS tenant_entitlements (
    tenant_id  TEXT PRIMARY KEY,
    data       JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
