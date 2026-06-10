-- Rollback: 001_create_stream_response_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_stream_response_updated ON stream_response_records;
DROP FUNCTION IF EXISTS update_stream_response_timestamp();
DROP FUNCTION IF EXISTS cleanup_stream_response_idempotency();
DROP POLICY IF EXISTS stream_response_tenant_isolation ON stream_response_records;
DROP TABLE IF EXISTS stream_response_idempotency;
DROP TABLE IF EXISTS stream_response_audit;
DROP TABLE IF EXISTS stream_response_records;
COMMIT;
