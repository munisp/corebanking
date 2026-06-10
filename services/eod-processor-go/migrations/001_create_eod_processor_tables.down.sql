-- Rollback: 001_create_eod_processor_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_eod_processor_updated ON eod_processor_records;
DROP FUNCTION IF EXISTS update_eod_processor_timestamp();
DROP FUNCTION IF EXISTS cleanup_eod_processor_idempotency();
DROP POLICY IF EXISTS eod_processor_tenant_isolation ON eod_processor_records;
DROP TABLE IF EXISTS eod_processor_idempotency;
DROP TABLE IF EXISTS eod_processor_audit;
DROP TABLE IF EXISTS eod_processor_records;
COMMIT;
