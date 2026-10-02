-- =============================================================================
-- V20260002: canonical service_records table (B5 remediation, P1-C)
-- =============================================================================
-- OWNED by services/db-migrations (see V20260001 header for the ownership /
-- boot-DDL compatibility story — identical here).
--
-- COLUMN PROVENANCE (harvest: work/w12/schema-harvest.json, 4 boot variants
-- across 127 creator files; usage greps):
--   id          TEXT PK — ALL 4 variants agree.
--   service     TEXT NOT NULL — all variants; every INSERT supplies it
--               (361 INSERTs of (id,service,type,status,data)).
--   type        TEXT DEFAULT 'default' — 111-file variant
--               (risk-scoring-rs/src/main.rs family) + 13-file variant.
--   status      TEXT DEFAULT 'active' — same variants.
--   data        JSONB DEFAULT '{}' — 124 of 127 creator files. The 2-file
--               TEXT variant (security-gateway-go/main.go:1032,
--               loan-origination-go) inserts json.Marshal output
--               (loan-origination-go/main.go:343), so the guarded conversion
--               below is lossless for real rows.
--   created_by  TEXT DEFAULT '' — 13-file variant (trade-finance-gl-go
--               family, e.g. dapr-sidecar-go/main.go).
--   tenant_id   TEXT DEFAULT '' — same 13-file variant. TEXT (not UUID):
--               this family stores opaque tenant strings.
--   created_at / updated_at  TIMESTAMPTZ DEFAULT NOW() — dominant variants.
--
-- Query evidence for the index: SELECT id, service, type, status, data,
-- created_at FROM service_records WHERE service = $1 ORDER BY created_at
-- DESC — 136 sites (e.g. security-gateway-go/main.go:614).
-- =============================================================================

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

-- Converge a pre-existing boot-created table: the 2-file TEXT-data variant.
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

CREATE INDEX IF NOT EXISTS idx_service_records_service_created
    ON service_records (service, created_at DESC);
