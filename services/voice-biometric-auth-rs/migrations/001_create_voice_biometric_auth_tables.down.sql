-- Rollback: 001_create_voice_biometric_auth_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_voice_biometric_auth_updated ON voice_biometric_auth_records;
DROP FUNCTION IF EXISTS update_voice_biometric_auth_timestamp();
DROP FUNCTION IF EXISTS cleanup_voice_biometric_auth_idempotency();
DROP POLICY IF EXISTS voice_biometric_auth_tenant_isolation ON voice_biometric_auth_records;
DROP TABLE IF EXISTS voice_biometric_auth_idempotency;
DROP TABLE IF EXISTS voice_biometric_auth_audit;
DROP TABLE IF EXISTS voice_biometric_auth_records;
COMMIT;
