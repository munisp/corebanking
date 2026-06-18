-- Rollback: 001_create_agent_reconciliation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_reconciliation_updated ON agent_reconciliation_records;
DROP FUNCTION IF EXISTS update_agent_reconciliation_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_reconciliation_idempotency();
DROP POLICY IF EXISTS agent_reconciliation_tenant_isolation ON agent_reconciliation_records;
DROP TABLE IF EXISTS agent_reconciliation_idempotency;
DROP TABLE IF EXISTS agent_reconciliation_audit;
DROP TABLE IF EXISTS agent_reconciliation_records;
COMMIT;
