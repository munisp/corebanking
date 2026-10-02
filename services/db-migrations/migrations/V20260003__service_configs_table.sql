-- =============================================================================
-- V20260003: canonical service_configs table (B5 remediation, P1-C)
-- =============================================================================
-- OWNED by services/db-migrations (see V20260001 header for the ownership /
-- boot-DDL compatibility story — identical here).
--
-- COLUMN PROVENANCE (harvest: work/w12/schema-harvest.json, 5 boot variants
-- across 270 creator files; usage greps). Two boot FAMILIES share this one
-- table name and today corrupt each other depending on boot order:
--   * config family (199 files, e.g. inventory-py/main.py): config_key /
--     config_value NOT NULL + UNIQUE(config_key, environment, tenant_id).
--   * status family (68 files, e.g. area-yield-index-insurance-py):
--     id / tenant_id / status only — its INSERTs (107 sites write only
--     (tenant_id,status), 30 only (id,status)) VIOLATE the config family's
--     NOT NULL config_key. Canonical superset makes both families' writes
--     legal: config_key / config_value NULLABLE.
--   id            UUID PK DEFAULT gen_random_uuid() — ALL variants; the 88
--                 id-supplying INSERTs all cast ::uuid (inventory-py/main.py
--                 et al.).
--   config_key    VARCHAR(128) NULLABLE (was NOT NULL in config family).
--   config_value  JSONB NULLABLE (was NOT NULL in config family).
--   environment   VARCHAR(20) NOT NULL DEFAULT 'production' — config family;
--                 SELECT evidence: config_key-family readers filter on it.
--   status        VARCHAR(32) NOT NULL DEFAULT 'active' — superset of the
--                 VARCHAR(32)/VARCHAR(20) boot variants.
--   version       INT NOT NULL DEFAULT 1 — config family.
--   description   TEXT — config family.
--   is_active     BOOLEAN NOT NULL DEFAULT TRUE — config family; readers
--                 select is_active (2 SELECT sites).
--   updated_by    UUID — config family.
--   tenant_id     UUID NULLABLE — all variants; NOT NULL only in the 1-file
--                 statement-generator variant, whose constraint breaks the
--                 30 (id,status)-only INSERTs — dropped by the DO block.
--   created_at / updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW().
-- =============================================================================

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

-- Converge a pre-existing boot-created table to the canonical shape:
-- relax constraints that the OTHER family's writes violate.
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
-- the 199-file boot variant). Rows written by the status family have NULL
-- config_key and never collide (PG treats NULLs as distinct).
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_configs_key_env_tenant
    ON service_configs (config_key, environment, tenant_id);

-- Status-family hot path: SELECT ... WHERE tenant_id = ... / status filters
-- (94 SELECT sites read (id,status,tenant_id,created_at)).
CREATE INDEX IF NOT EXISTS idx_service_configs_tenant
    ON service_configs (tenant_id);
