-- Rollback: 001_create_http2_multiplexer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_http2_multiplexer_updated ON http2_multiplexer_records;
DROP FUNCTION IF EXISTS update_http2_multiplexer_timestamp();
DROP FUNCTION IF EXISTS cleanup_http2_multiplexer_idempotency();
DROP POLICY IF EXISTS http2_multiplexer_tenant_isolation ON http2_multiplexer_records;
DROP TABLE IF EXISTS http2_multiplexer_idempotency;
DROP TABLE IF EXISTS http2_multiplexer_audit;
DROP TABLE IF EXISTS http2_multiplexer_records;
COMMIT;
