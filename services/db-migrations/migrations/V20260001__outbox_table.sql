-- =============================================================================
-- V20260001: canonical transactional-outbox table (B5 remediation, P1-C)
-- =============================================================================
-- OWNED by services/db-migrations. This is the single authoritative DDL for
-- the shared `outbox` table. Until the boot-DDL-removal codemod lands (later
-- wave), 275 services still run CREATE TABLE IF NOT EXISTS outbox at boot;
-- those statements are idempotent-compatible with this file (IF NOT EXISTS is
-- a no-op once this table exists, and the DO-block below converges any table
-- a racing boot created first).
--
-- COLUMN PROVENANCE (harvest: work/w12/schema-harvest.json; usage greps):
--   id              TEXT PK — dominant boot variant uses UUID DEFAULT
--                   gen_random_uuid() (275 creator files, e.g.
--                   inventory-py/main.py, cooperative-meetings-go/main.go);
--                   gl-engine-go inserts NON-UUID ids 'OBX-...'
--                   (gl-engine-go/main.go:442,459). TEXT accepts both;
--                   DEFAULT gen_random_uuid()::text preserves old behaviour.
--   event_type      dominant variant VARCHAR(64) NOT NULL; gl-engine-rs
--                   variant TEXT (src/main.rs:930). NULLABLE because
--                   gl-engine-go inserts without it (main.go:459-462).
--   topic / "key"   gl-engine-go relay columns (main.go:459, :1143).
--   aggregate_id    dominant variant VARCHAR(128) NOT NULL; NULLABLE for
--                   gl-engine-go inserts.
--   payload         JSONB NOT NULL DEFAULT '{}' — every INSERT site supplies
--                   it (973 INSERTs of (event_type,aggregate_id,payload)).
--   published       dominant variant (275 files); relay
--                   SELECT ... WHERE published = FALSE ORDER BY created_at
--                   (e.g. cooperative-meetings-go/main.go:901);
--                   UPDATE outbox SET published = TRUE (157 sites).
--   published_at    core-banking-go/middleware_events.go:370
--                   (UPDATE ... SET published = TRUE, published_at = NOW()).
--   status          gl-engine-go lifecycle 'pending' -> 'published'
--                   (main.go:461, :1143, :1169).
--   idempotency_key gl-engine-go ON CONFLICT (idempotency_key) DO NOTHING
--                   (main.go:459-462) — requires a NON-partial unique index
--                   for arbiter inference; PG allows multiple NULLs.
--   created_at      all variants, NOT NULL DEFAULT NOW().
--
-- Runs inside the runner's per-migration transaction (no CONCURRENTLY, no
-- CREATE INDEX CONCURRENTLY — these are new/small tables).
-- =============================================================================

-- gen_random_uuid() is core since PG 13; the fleet runs postgres:16
-- (docker-compose.yml:15) and DigitalOcean managed PG, so no pgcrypto
-- CREATE EXTENSION is needed (it would also fail on minimal/containers
-- without contrib modules — verified in the wave-12 functional proof).

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

-- Converge a pre-existing boot-created table to the canonical shape.
DO $$
BEGIN
    -- id: uuid / bigint boot variants -> TEXT (gl-engine-go uses 'OBX-' ids).
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'outbox' AND column_name = 'id'
                 AND udt_name IN ('uuid', 'int8', 'int4')) THEN
        ALTER TABLE outbox ALTER COLUMN id TYPE TEXT USING id::text;
        ALTER TABLE outbox ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    END IF;
    -- event_type / aggregate_id were NOT NULL in the dominant boot variant;
    -- gl-engine-go INSERTs do not supply them (main.go:459-462).
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

-- Additive superset columns for tables created by an older boot variant.
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

-- Relay hot path: dominant-family poller (published = FALSE ORDER BY
-- created_at). Matches the boot-time index already created by the python
-- family (inventory-py/main.py:152, same name/columns/predicate).
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
    ON outbox (published, created_at) WHERE NOT published;

-- gl-engine-go relay hot path (main.go:1143: WHERE status = 'pending'
-- ORDER BY created_at).
CREATE INDEX IF NOT EXISTS idx_outbox_status_pending
    ON outbox (status, created_at) WHERE status = 'pending';

-- gl-engine-go idempotency claim (main.go:459-462). Must be non-partial:
-- plain ON CONFLICT (idempotency_key) only infers non-partial unique
-- indexes. Multiple NULLs are permitted (all non-gl-engine rows).
CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_idempotency_key
    ON outbox (idempotency_key);
