-- Rollback: 001_create_kyb_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kyb_engine_updated ON kyb_engine_records;
DROP FUNCTION IF EXISTS update_kyb_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_kyb_engine_idempotency();
DROP POLICY IF EXISTS kyb_engine_tenant_isolation ON kyb_engine_records;
DROP TABLE IF EXISTS kyb_engine_idempotency;
DROP TABLE IF EXISTS kyb_engine_audit;
DROP TABLE IF EXISTS kyb_engine_records;
COMMIT;
