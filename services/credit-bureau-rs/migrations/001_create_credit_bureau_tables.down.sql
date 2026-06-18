-- Rollback: 001_create_credit_bureau_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_credit_bureau_updated ON credit_bureau_records;
DROP FUNCTION IF EXISTS update_credit_bureau_timestamp();
DROP FUNCTION IF EXISTS cleanup_credit_bureau_idempotency();
DROP POLICY IF EXISTS credit_bureau_tenant_isolation ON credit_bureau_records;
DROP TABLE IF EXISTS credit_bureau_idempotency;
DROP TABLE IF EXISTS credit_bureau_audit;
DROP TABLE IF EXISTS credit_bureau_records;
COMMIT;
