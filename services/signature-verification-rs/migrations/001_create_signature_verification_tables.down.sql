-- Rollback: 001_create_signature_verification_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_signature_verification_updated ON signature_verification_records;
DROP FUNCTION IF EXISTS update_signature_verification_timestamp();
DROP FUNCTION IF EXISTS cleanup_signature_verification_idempotency();
DROP POLICY IF EXISTS signature_verification_tenant_isolation ON signature_verification_records;
DROP TABLE IF EXISTS signature_verification_idempotency;
DROP TABLE IF EXISTS signature_verification_audit;
DROP TABLE IF EXISTS signature_verification_records;
COMMIT;
