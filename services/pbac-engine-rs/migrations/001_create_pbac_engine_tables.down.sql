-- Rollback: 001_create_pbac_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_pbac_engine_updated ON pbac_engine_records;
DROP FUNCTION IF EXISTS update_pbac_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_pbac_engine_idempotency();
DROP POLICY IF EXISTS pbac_engine_tenant_isolation ON pbac_engine_records;
DROP TABLE IF EXISTS pbac_engine_idempotency;
DROP TABLE IF EXISTS pbac_engine_audit;
DROP TABLE IF EXISTS pbac_engine_records;
COMMIT;
