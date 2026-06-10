-- Rollback: 001_create_security_hardening_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_security_hardening_updated ON security_hardening_records;
DROP FUNCTION IF EXISTS update_security_hardening_timestamp();
DROP FUNCTION IF EXISTS cleanup_security_hardening_idempotency();
DROP POLICY IF EXISTS security_hardening_tenant_isolation ON security_hardening_records;
DROP TABLE IF EXISTS security_hardening_idempotency;
DROP TABLE IF EXISTS security_hardening_audit;
DROP TABLE IF EXISTS security_hardening_records;
COMMIT;
