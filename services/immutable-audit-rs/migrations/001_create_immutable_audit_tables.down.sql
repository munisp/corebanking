-- Rollback: 001_create_immutable_audit_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_immutable_audit_updated ON immutable_audit_records;
DROP FUNCTION IF EXISTS update_immutable_audit_timestamp();
DROP FUNCTION IF EXISTS cleanup_immutable_audit_idempotency();
DROP POLICY IF EXISTS immutable_audit_tenant_isolation ON immutable_audit_records;
DROP TABLE IF EXISTS immutable_audit_idempotency;
DROP TABLE IF EXISTS immutable_audit_audit;
DROP TABLE IF EXISTS immutable_audit_records;
COMMIT;
