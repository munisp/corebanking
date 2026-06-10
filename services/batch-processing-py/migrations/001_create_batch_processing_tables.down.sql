-- Rollback: 001_create_batch_processing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_batch_processing_updated ON batch_processing_records;
DROP FUNCTION IF EXISTS update_batch_processing_timestamp();
DROP FUNCTION IF EXISTS cleanup_batch_processing_idempotency();
DROP POLICY IF EXISTS batch_processing_tenant_isolation ON batch_processing_records;
DROP TABLE IF EXISTS batch_processing_idempotency;
DROP TABLE IF EXISTS batch_processing_audit;
DROP TABLE IF EXISTS batch_processing_records;
COMMIT;
