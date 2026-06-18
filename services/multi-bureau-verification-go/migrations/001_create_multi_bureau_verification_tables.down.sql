-- Rollback: 001_create_multi_bureau_verification_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_multi_bureau_verification_updated ON multi_bureau_verification_records;
DROP FUNCTION IF EXISTS update_multi_bureau_verification_timestamp();
DROP FUNCTION IF EXISTS cleanup_multi_bureau_verification_idempotency();
DROP POLICY IF EXISTS multi_bureau_verification_tenant_isolation ON multi_bureau_verification_records;
DROP TABLE IF EXISTS multi_bureau_verification_idempotency;
DROP TABLE IF EXISTS multi_bureau_verification_audit;
DROP TABLE IF EXISTS multi_bureau_verification_records;
COMMIT;
