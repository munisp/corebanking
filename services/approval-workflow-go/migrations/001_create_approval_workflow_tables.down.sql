-- Rollback: 001_create_approval_workflow_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_approval_workflow_updated ON approval_workflow_records;
DROP FUNCTION IF EXISTS update_approval_workflow_timestamp();
DROP FUNCTION IF EXISTS cleanup_approval_workflow_idempotency();
DROP POLICY IF EXISTS approval_workflow_tenant_isolation ON approval_workflow_records;
DROP TABLE IF EXISTS approval_workflow_idempotency;
DROP TABLE IF EXISTS approval_workflow_audit;
DROP TABLE IF EXISTS approval_workflow_records;
COMMIT;
