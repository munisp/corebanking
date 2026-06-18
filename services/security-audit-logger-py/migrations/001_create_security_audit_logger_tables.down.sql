-- Rollback: 001_create_security_audit_logger_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_security_audit_logger_updated ON security_audit_logger_records;
DROP FUNCTION IF EXISTS update_security_audit_logger_timestamp();
DROP FUNCTION IF EXISTS cleanup_security_audit_logger_idempotency();
DROP POLICY IF EXISTS security_audit_logger_tenant_isolation ON security_audit_logger_records;
DROP TABLE IF EXISTS security_audit_logger_idempotency;
DROP TABLE IF EXISTS security_audit_logger_audit;
DROP TABLE IF EXISTS security_audit_logger_records;
COMMIT;
