-- Rollback: 001_create_project_finance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_project_finance_updated ON project_finance_records;
DROP FUNCTION IF EXISTS update_project_finance_timestamp();
DROP FUNCTION IF EXISTS cleanup_project_finance_idempotency();
DROP POLICY IF EXISTS project_finance_tenant_isolation ON project_finance_records;
DROP TABLE IF EXISTS project_finance_idempotency;
DROP TABLE IF EXISTS project_finance_audit;
DROP TABLE IF EXISTS project_finance_records;
COMMIT;
