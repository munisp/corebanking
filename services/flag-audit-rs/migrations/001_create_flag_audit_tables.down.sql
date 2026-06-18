-- Rollback: 001_create_flag_audit_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_flag_audit_updated ON flag_audit_records;
DROP FUNCTION IF EXISTS update_flag_audit_timestamp();
DROP FUNCTION IF EXISTS cleanup_flag_audit_idempotency();
DROP POLICY IF EXISTS flag_audit_tenant_isolation ON flag_audit_records;
DROP TABLE IF EXISTS flag_audit_idempotency;
DROP TABLE IF EXISTS flag_audit_audit;
DROP TABLE IF EXISTS flag_audit_records;
COMMIT;
