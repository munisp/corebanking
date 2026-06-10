-- Rollback: 001_create_loan_origination_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_loan_origination_updated ON loan_origination_records;
DROP FUNCTION IF EXISTS update_loan_origination_timestamp();
DROP FUNCTION IF EXISTS cleanup_loan_origination_idempotency();
DROP POLICY IF EXISTS loan_origination_tenant_isolation ON loan_origination_records;
DROP TABLE IF EXISTS loan_origination_idempotency;
DROP TABLE IF EXISTS loan_origination_audit;
DROP TABLE IF EXISTS loan_origination_records;
COMMIT;
