-- Rollback: 001_create_tls_terminator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tls_terminator_updated ON tls_terminator_records;
DROP FUNCTION IF EXISTS update_tls_terminator_timestamp();
DROP FUNCTION IF EXISTS cleanup_tls_terminator_idempotency();
DROP POLICY IF EXISTS tls_terminator_tenant_isolation ON tls_terminator_records;
DROP TABLE IF EXISTS tls_terminator_idempotency;
DROP TABLE IF EXISTS tls_terminator_audit;
DROP TABLE IF EXISTS tls_terminator_records;
COMMIT;
