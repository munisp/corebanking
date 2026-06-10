-- Rollback: 001_create_loan_calculator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_loan_calculator_updated ON loan_calculator_records;
DROP FUNCTION IF EXISTS update_loan_calculator_timestamp();
DROP FUNCTION IF EXISTS cleanup_loan_calculator_idempotency();
DROP POLICY IF EXISTS loan_calculator_tenant_isolation ON loan_calculator_records;
DROP TABLE IF EXISTS loan_calculator_idempotency;
DROP TABLE IF EXISTS loan_calculator_audit;
DROP TABLE IF EXISTS loan_calculator_records;
COMMIT;
