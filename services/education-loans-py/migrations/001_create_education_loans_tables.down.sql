-- Rollback: 001_create_education_loans_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_education_loans_updated ON education_loans_records;
DROP FUNCTION IF EXISTS update_education_loans_timestamp();
DROP FUNCTION IF EXISTS cleanup_education_loans_idempotency();
DROP POLICY IF EXISTS education_loans_tenant_isolation ON education_loans_records;
DROP TABLE IF EXISTS education_loans_idempotency;
DROP TABLE IF EXISTS education_loans_audit;
DROP TABLE IF EXISTS education_loans_records;
COMMIT;
