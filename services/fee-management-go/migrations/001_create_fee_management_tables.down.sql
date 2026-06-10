-- Rollback: 001_create_fee_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_fee_management_updated ON fee_management_records;
DROP FUNCTION IF EXISTS update_fee_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_fee_management_idempotency();
DROP POLICY IF EXISTS fee_management_tenant_isolation ON fee_management_records;
DROP TABLE IF EXISTS fee_management_idempotency;
DROP TABLE IF EXISTS fee_management_audit;
DROP TABLE IF EXISTS fee_management_records;
COMMIT;
