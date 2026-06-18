-- Rollback: 001_create_aml_case_manager_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_aml_case_manager_updated ON aml_case_manager_records;
DROP FUNCTION IF EXISTS update_aml_case_manager_timestamp();
DROP FUNCTION IF EXISTS cleanup_aml_case_manager_idempotency();
DROP POLICY IF EXISTS aml_case_manager_tenant_isolation ON aml_case_manager_records;
DROP TABLE IF EXISTS aml_case_manager_idempotency;
DROP TABLE IF EXISTS aml_case_manager_audit;
DROP TABLE IF EXISTS aml_case_manager_records;
COMMIT;
