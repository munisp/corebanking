-- =============================================================================
-- Migration 006: platform template tables — outbox, service_records,
-- service_configs (B5 remediation, P1-C)
-- =============================================================================
-- Wave-12 remediation (b5-remediation-spec.md §P1-C): the drizzle 402-table
-- set lacked all three service-owned template tables; 333 REAL/PARTIAL
-- services reference tables they never create (outbox ×134,
-- service_records ×121, service_configs ×34) and 470 services relied on
-- boot-time CREATE TABLE IF NOT EXISTS with 2/4/5 drifting DDL variants
-- (harvest: work/w12/schema-harvest.json).
--
-- AUTHORITATIVE APPLY PATH: services/db-migrations (real Go runner,
-- migrations/V20260001..V20260003 — same canonical DDL, same guards). This
-- file keeps the drizzle platform schema in parity for environments applied
-- via infrastructure/new/scripts/migrate.sh (`psql -f`, autocommit, no
-- wrapping transaction — every statement below is individually idempotent).
--
-- BOOT-DDL COMPATIBILITY: the 470 services' CREATE TABLE IF NOT EXISTS is a
-- no-op once the canonical table exists; the guarded DO blocks below
-- converge any table a racing boot created first (uuid/bigint outbox.id ->
-- TEXT for gl-engine-go's 'OBX-' ids; TEXT service_records.data -> JSONB;
-- NOT NULL relaxation where one boot family's constraint breaks another
-- family's writes). Column provenance is documented per column in the
-- db-migrations migration headers; summary inline below.
--
-- No BEGIN/COMMIT (migrate.sh convention, see 005 header). No CONCURRENTLY
-- needed — statements are idempotent and the tables are small/new.
-- =============================================================================

-- gen_random_uuid() is core since PG 13; fleet is postgres:16
-- (docker-compose.yml:15) / DigitalOcean managed PG — no pgcrypto needed.

-- ─── outbox ─────────────────────────────────────────────────────────────────
-- Columns: dominant boot variant (275 files, e.g. inventory-py/main.py):
-- id UUID PK, event_type, aggregate_id, payload JSONB, published,
-- created_at; gl-engine-rs variant (src/main.rs:928-934): BIGSERIAL id;
-- gl-engine-go (main.go:442,459-462,1143-1169): TEXT 'OBX-' ids, topic,
-- "key", idempotency_key (ON CONFLICT), status pending->published;
-- core-banking-go/middleware_events.go:370: published_at.
CREATE TABLE IF NOT EXISTS outbox (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_type      TEXT,
    topic           TEXT,
    "key"           TEXT,
    aggregate_id    TEXT,
    payload         JSONB NOT NULL DEFAULT '{}',
    published       BOOLEAN NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'pending',
    idempotency_key TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'outbox' AND column_name = 'id'
                 AND udt_name IN ('uuid', 'int8', 'int4')) THEN
        ALTER TABLE outbox ALTER COLUMN id TYPE TEXT USING id::text;
        ALTER TABLE outbox ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'outbox' AND column_name = 'event_type'
                 AND is_nullable = 'NO') THEN
        ALTER TABLE outbox ALTER COLUMN event_type DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'outbox' AND column_name = 'aggregate_id'
                 AND is_nullable = 'NO') THEN
        ALTER TABLE outbox ALTER COLUMN aggregate_id DROP NOT NULL;
    END IF;
END $$;

ALTER TABLE outbox ADD COLUMN IF NOT EXISTS event_type      TEXT;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS topic           TEXT;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS "key"           TEXT;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS aggregate_id    TEXT;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS payload         JSONB NOT NULL DEFAULT '{}';
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS published       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS published_at    TIMESTAMPTZ;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Relay: SELECT ... WHERE published = FALSE ORDER BY created_at (e.g.
-- cooperative-meetings-go/main.go:901); matches the python family's
-- boot-time index (inventory-py/main.py:152, same name/columns/predicate).
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
    ON outbox (published, created_at) WHERE NOT published;
-- gl-engine-go relay (main.go:1143).
CREATE INDEX IF NOT EXISTS idx_outbox_status_pending
    ON outbox (status, created_at) WHERE status = 'pending';
-- gl-engine-go idempotency claim (main.go:459-462); non-partial required
-- for plain ON CONFLICT (idempotency_key) arbiter inference.
CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_idempotency_key
    ON outbox (idempotency_key);

-- ─── service_records ────────────────────────────────────────────────────────
-- 127 creator files, 4 variants: dominant (111 files) id/service/type/
-- status/data JSONB/timestamps; 13-file adds created_by/tenant_id TEXT;
-- 2-file (security-gateway-go/main.go:1032, loan-origination-go) has data
-- TEXT — inserted values are json.Marshal output
-- (loan-origination-go/main.go:343), so the conversion is lossless.
CREATE TABLE IF NOT EXISTS service_records (
    id         TEXT PRIMARY KEY,
    service    TEXT NOT NULL,
    type       TEXT DEFAULT 'default',
    status     TEXT DEFAULT 'active',
    data       JSONB DEFAULT '{}',
    created_by TEXT DEFAULT '',
    tenant_id  TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'service_records' AND column_name = 'data'
                 AND udt_name = 'text') THEN
        ALTER TABLE service_records
            ALTER COLUMN data TYPE JSONB USING NULLIF(data, '')::jsonb;
        ALTER TABLE service_records ALTER COLUMN data SET DEFAULT '{}';
    END IF;
END $$;

ALTER TABLE service_records ADD COLUMN IF NOT EXISTS type       TEXT DEFAULT 'default';
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'active';
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS data       JSONB DEFAULT '{}';
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT '';
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS tenant_id  TEXT DEFAULT '';
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Query evidence: WHERE service = $1 ORDER BY created_at DESC — 136 sites
-- (e.g. security-gateway-go/main.go:614).
CREATE INDEX IF NOT EXISTS idx_service_records_service_created
    ON service_records (service, created_at DESC);

-- ─── service_configs ────────────────────────────────────────────────────────
-- 270 creator files, 5 variants, two mutually-breaking boot families:
-- config family (199 files: config_key/config_value NOT NULL +
-- UNIQUE(config_key, environment, tenant_id)) vs status family (68 files:
-- id/tenant_id/status only; 195 INSERT sites write no config_key). Superset:
-- config columns NULLABLE so both families' writes are legal. id UUID (88
-- id-supplying INSERTs all cast ::uuid).
CREATE TABLE IF NOT EXISTS service_configs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key   VARCHAR(128),
    config_value JSONB,
    environment  VARCHAR(20) NOT NULL DEFAULT 'production',
    status       VARCHAR(32) NOT NULL DEFAULT 'active',
    version      INT NOT NULL DEFAULT 1,
    description  TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by   UUID,
    tenant_id    UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'service_configs' AND column_name = 'config_key'
                 AND is_nullable = 'NO') THEN
        ALTER TABLE service_configs ALTER COLUMN config_key DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'service_configs' AND column_name = 'config_value'
                 AND is_nullable = 'NO') THEN
        ALTER TABLE service_configs ALTER COLUMN config_value DROP NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'service_configs' AND column_name = 'tenant_id'
                 AND is_nullable = 'NO') THEN
        ALTER TABLE service_configs ALTER COLUMN tenant_id DROP NOT NULL;
    END IF;
END $$;

ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS config_key   VARCHAR(128);
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS config_value JSONB;
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS environment  VARCHAR(20) NOT NULL DEFAULT 'production';
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS status       VARCHAR(32) NOT NULL DEFAULT 'active';
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS version      INT NOT NULL DEFAULT 1;
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS updated_by   UUID;
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS tenant_id    UUID;
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Config-family uniqueness (UNIQUE(config_key, environment, tenant_id) in
-- the 199-file boot variant); status-family rows have NULL config_key and
-- never collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_configs_key_env_tenant
    ON service_configs (config_key, environment, tenant_id);
-- Status-family lookups (94 SELECT sites read id,status,tenant_id).
CREATE INDEX IF NOT EXISTS idx_service_configs_tenant
    ON service_configs (tenant_id);
