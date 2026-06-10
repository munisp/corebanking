-- Rollback: 001_create_identity_verification_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_identity_verification_updated ON identity_verification_records;
DROP FUNCTION IF EXISTS update_identity_verification_timestamp();
DROP FUNCTION IF EXISTS cleanup_identity_verification_idempotency();
DROP POLICY IF EXISTS identity_verification_tenant_isolation ON identity_verification_records;
DROP TABLE IF EXISTS identity_verification_idempotency;
DROP TABLE IF EXISTS identity_verification_audit;
DROP TABLE IF EXISTS identity_verification_records;
COMMIT;
