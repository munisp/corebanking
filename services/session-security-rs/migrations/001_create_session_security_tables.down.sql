-- Rollback: 001_create_session_security_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_session_security_updated ON session_security_records;
DROP FUNCTION IF EXISTS update_session_security_timestamp();
DROP FUNCTION IF EXISTS cleanup_session_security_idempotency();
DROP POLICY IF EXISTS session_security_tenant_isolation ON session_security_records;
DROP TABLE IF EXISTS session_security_idempotency;
DROP TABLE IF EXISTS session_security_audit;
DROP TABLE IF EXISTS session_security_records;
COMMIT;
