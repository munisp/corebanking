-- Rollback: 001_create_aml_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_aml_engine_updated ON aml_engine_records;
DROP FUNCTION IF EXISTS update_aml_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_aml_engine_idempotency();
DROP POLICY IF EXISTS aml_engine_tenant_isolation ON aml_engine_records;
DROP TABLE IF EXISTS aml_engine_idempotency;
DROP TABLE IF EXISTS aml_engine_audit;
DROP TABLE IF EXISTS aml_engine_records;
COMMIT;
