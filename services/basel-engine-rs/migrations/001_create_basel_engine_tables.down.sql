-- Rollback: 001_create_basel_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_basel_engine_updated ON basel_engine_records;
DROP FUNCTION IF EXISTS update_basel_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_basel_engine_idempotency();
DROP POLICY IF EXISTS basel_engine_tenant_isolation ON basel_engine_records;
DROP TABLE IF EXISTS basel_engine_idempotency;
DROP TABLE IF EXISTS basel_engine_audit;
DROP TABLE IF EXISTS basel_engine_records;
COMMIT;
