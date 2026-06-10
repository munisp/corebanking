-- Rollback: 001_create_workflow_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_workflow_engine_updated ON workflow_engine_records;
DROP FUNCTION IF EXISTS update_workflow_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_workflow_engine_idempotency();
DROP POLICY IF EXISTS workflow_engine_tenant_isolation ON workflow_engine_records;
DROP TABLE IF EXISTS workflow_engine_idempotency;
DROP TABLE IF EXISTS workflow_engine_audit;
DROP TABLE IF EXISTS workflow_engine_records;
COMMIT;
