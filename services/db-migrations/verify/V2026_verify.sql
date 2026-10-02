-- =============================================================================
-- Verification for V20260001..V20260003 (B5 P1-C canonical template tables).
-- Run AFTER the runner:  psql "$DATABASE_URL" -f verify/V2026_verify.sql
-- Every query must return TRUE / zero rows. Read-only.
-- =============================================================================

-- 1. Column-set equality: canonical superset columns exist with the canonical
--    nullability (NOT NULL only where every harvested boot family writes the
--    column). Compare against the per-variant harvest in
--    work/w12/schema-harvest.json.
WITH expected(tbl, col, nullable, udt) AS (
  VALUES
  -- outbox (V20260001)
  ('outbox','id',            FALSE,'text'),
  ('outbox','event_type',    TRUE, 'text'),
  ('outbox','topic',         TRUE, 'text'),
  ('outbox','key',           TRUE, 'text'),
  ('outbox','aggregate_id',  TRUE, 'text'),
  ('outbox','payload',       FALSE,'jsonb'),
  ('outbox','published',     FALSE,'bool'),
  ('outbox','published_at',  TRUE, 'timestamptz'),
  ('outbox','status',        FALSE,'text'),
  ('outbox','idempotency_key',TRUE,'text'),
  ('outbox','created_at',    FALSE,'timestamptz'),
  -- service_records (V20260002)
  ('service_records','id',        FALSE,'text'),
  ('service_records','service',   FALSE,'text'),
  ('service_records','type',      TRUE, 'text'),
  ('service_records','status',    TRUE, 'text'),
  ('service_records','data',      TRUE, 'jsonb'),
  ('service_records','created_by',TRUE, 'text'),
  ('service_records','tenant_id', TRUE, 'text'),
  ('service_records','created_at',TRUE, 'timestamptz'),
  ('service_records','updated_at',TRUE, 'timestamptz'),
  -- service_configs (V20260003)
  ('service_configs','id',          FALSE,'uuid'),
  ('service_configs','config_key',  TRUE, 'varchar'),
  ('service_configs','config_value',TRUE, 'jsonb'),
  ('service_configs','environment', FALSE,'varchar'),
  ('service_configs','status',      FALSE,'varchar'),
  ('service_configs','version',     FALSE,'int4'),
  ('service_configs','description', TRUE, 'text'),
  ('service_configs','is_active',   FALSE,'bool'),
  ('service_configs','updated_by',  TRUE, 'uuid'),
  ('service_configs','tenant_id',   TRUE, 'uuid'),
  ('service_configs','created_at',  FALSE,'timestamptz'),
  ('service_configs','updated_at',  FALSE,'timestamptz')
)
SELECT 'missing_or_drifting_column' AS check_name, e.tbl, e.col
FROM expected e
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_name = e.tbl AND c.column_name = e.col
    AND (c.is_nullable = 'YES') = e.nullable
    AND c.udt_name = e.udt
);
-- (expect: 0 rows)

-- 2. Required indexes exist.
SELECT 'missing_index' AS check_name, i.indexname
FROM (VALUES
  ('idx_outbox_unpublished'),
  ('idx_outbox_status_pending'),
  ('idx_outbox_idempotency_key'),
  ('idx_service_records_service_created'),
  ('idx_service_configs_key_env_tenant'),
  ('idx_service_configs_tenant')
) AS i(indexname)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes p WHERE p.indexname = i.indexname
);
-- (expect: 0 rows)

-- 3. Ledger state: three platform rows, none dirty.
SELECT 'ledger' AS check_name,
       COUNT(*) FILTER (WHERE runner = 'db-migrations' AND NOT dirty) AS applied,
       COUNT(*) FILTER (WHERE runner = 'db-migrations' AND dirty)     AS dirty
FROM schema_migrations;
-- (expect: applied >= 3, dirty = 0)

-- 4. Smoke round-trip per table, replaying the exact statement shapes the
--    services execute (evidence cited in the migration headers). Rolled back.
BEGIN;
  -- dominant family (973 sites): inventory-py/main.py:316 shape
  INSERT INTO outbox (event_type, aggregate_id, payload)
    VALUES ('verify.ping', 'verify-1', '{}'::jsonb);
  -- gl-engine-go family: main.go:459 shape (idempotency claim)
  INSERT INTO outbox (id, topic, key, payload, idempotency_key, created_at, status)
    VALUES ('OBX-VERIFY-1', 'verify.topic', 'v1', '{}'::jsonb, 'VERIFY-IDEM-1', NOW(), 'pending')
    ON CONFLICT (idempotency_key) DO NOTHING;
  -- dominant relay shape (cooperative-meetings-go/main.go:901)
  SELECT id, event_type, aggregate_id, payload FROM outbox
    WHERE published = FALSE ORDER BY created_at LIMIT 1;
  -- service_records dominant INSERT shape (361 sites)
  INSERT INTO service_records (id, service, type, status, data)
    VALUES ('verify-1', 'verify', 'default', 'active', '{}'::jsonb);
  -- service_configs status-family shapes (195 sites)
  INSERT INTO service_configs (tenant_id, status) VALUES (NULL, 'active');
  INSERT INTO service_configs (id, status)
    VALUES (gen_random_uuid(), 'active');
  -- service_configs config-family shape (gl-engine family)
  INSERT INTO service_configs (config_key, config_value, environment, status)
    VALUES ('verify.key', '{}'::jsonb, 'production', 'active');
ROLLBACK;
-- (expect: no errors)
