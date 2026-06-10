-- Rollback: 001_create_branch_operations_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_branch_operations_updated ON branch_operations_records;
DROP FUNCTION IF EXISTS update_branch_operations_timestamp();
DROP FUNCTION IF EXISTS cleanup_branch_operations_idempotency();
DROP POLICY IF EXISTS branch_operations_tenant_isolation ON branch_operations_records;
DROP TABLE IF EXISTS branch_operations_idempotency;
DROP TABLE IF EXISTS branch_operations_audit;
DROP TABLE IF EXISTS branch_operations_records;
COMMIT;
