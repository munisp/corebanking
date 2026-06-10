-- Rollback: 001_create_biometric_auth_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_biometric_auth_updated ON biometric_auth_records;
DROP FUNCTION IF EXISTS update_biometric_auth_timestamp();
DROP FUNCTION IF EXISTS cleanup_biometric_auth_idempotency();
DROP POLICY IF EXISTS biometric_auth_tenant_isolation ON biometric_auth_records;
DROP TABLE IF EXISTS biometric_auth_idempotency;
DROP TABLE IF EXISTS biometric_auth_audit;
DROP TABLE IF EXISTS biometric_auth_records;
COMMIT;
