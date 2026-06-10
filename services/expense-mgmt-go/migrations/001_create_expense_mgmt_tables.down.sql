-- Rollback: 001_create_expense_mgmt_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_expense_mgmt_updated ON expense_mgmt_records;
DROP FUNCTION IF EXISTS update_expense_mgmt_timestamp();
DROP FUNCTION IF EXISTS cleanup_expense_mgmt_idempotency();
DROP POLICY IF EXISTS expense_mgmt_tenant_isolation ON expense_mgmt_records;
DROP TABLE IF EXISTS expense_mgmt_idempotency;
DROP TABLE IF EXISTS expense_mgmt_audit;
DROP TABLE IF EXISTS expense_mgmt_records;
COMMIT;
