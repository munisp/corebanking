-- Rollback: 001_create_request_coalescer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_request_coalescer_updated ON request_coalescer_records;
DROP FUNCTION IF EXISTS update_request_coalescer_timestamp();
DROP FUNCTION IF EXISTS cleanup_request_coalescer_idempotency();
DROP POLICY IF EXISTS request_coalescer_tenant_isolation ON request_coalescer_records;
DROP TABLE IF EXISTS request_coalescer_idempotency;
DROP TABLE IF EXISTS request_coalescer_audit;
DROP TABLE IF EXISTS request_coalescer_records;
COMMIT;
