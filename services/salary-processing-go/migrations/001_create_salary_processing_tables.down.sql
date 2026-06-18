-- Rollback: 001_create_salary_processing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_salary_processing_updated ON salary_processing_records;
DROP FUNCTION IF EXISTS update_salary_processing_timestamp();
DROP FUNCTION IF EXISTS cleanup_salary_processing_idempotency();
DROP POLICY IF EXISTS salary_processing_tenant_isolation ON salary_processing_records;
DROP TABLE IF EXISTS salary_processing_idempotency;
DROP TABLE IF EXISTS salary_processing_audit;
DROP TABLE IF EXISTS salary_processing_records;
COMMIT;
