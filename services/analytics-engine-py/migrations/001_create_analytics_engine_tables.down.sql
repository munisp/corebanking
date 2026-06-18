-- Rollback: 001_create_analytics_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_analytics_engine_updated ON analytics_engine_records;
DROP FUNCTION IF EXISTS update_analytics_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_analytics_engine_idempotency();
DROP POLICY IF EXISTS analytics_engine_tenant_isolation ON analytics_engine_records;
DROP TABLE IF EXISTS analytics_engine_idempotency;
DROP TABLE IF EXISTS analytics_engine_audit;
DROP TABLE IF EXISTS analytics_engine_records;
COMMIT;
