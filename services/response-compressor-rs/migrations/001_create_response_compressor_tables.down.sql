-- Rollback: 001_create_response_compressor_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_response_compressor_updated ON response_compressor_records;
DROP FUNCTION IF EXISTS update_response_compressor_timestamp();
DROP FUNCTION IF EXISTS cleanup_response_compressor_idempotency();
DROP POLICY IF EXISTS response_compressor_tenant_isolation ON response_compressor_records;
DROP TABLE IF EXISTS response_compressor_idempotency;
DROP TABLE IF EXISTS response_compressor_audit;
DROP TABLE IF EXISTS response_compressor_records;
COMMIT;
