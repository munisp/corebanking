-- Rollback: 001_create_beneficiary_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_beneficiary_management_updated ON beneficiary_management_records;
DROP FUNCTION IF EXISTS update_beneficiary_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_beneficiary_management_idempotency();
DROP POLICY IF EXISTS beneficiary_management_tenant_isolation ON beneficiary_management_records;
DROP TABLE IF EXISTS beneficiary_management_idempotency;
DROP TABLE IF EXISTS beneficiary_management_audit;
DROP TABLE IF EXISTS beneficiary_management_records;
COMMIT;
