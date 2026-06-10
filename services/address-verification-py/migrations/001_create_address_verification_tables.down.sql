-- Rollback: 001_create_address_verification_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_address_verification_updated ON address_verification_records;
DROP FUNCTION IF EXISTS update_address_verification_timestamp();
DROP FUNCTION IF EXISTS cleanup_address_verification_idempotency();
DROP POLICY IF EXISTS address_verification_tenant_isolation ON address_verification_records;
DROP TABLE IF EXISTS address_verification_idempotency;
DROP TABLE IF EXISTS address_verification_audit;
DROP TABLE IF EXISTS address_verification_records;
COMMIT;
