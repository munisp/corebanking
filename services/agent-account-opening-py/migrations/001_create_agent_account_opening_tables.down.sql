-- Rollback: 001_create_agent_account_opening_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_account_opening_updated ON agent_account_opening_records;
DROP FUNCTION IF EXISTS update_agent_account_opening_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_account_opening_idempotency();
DROP POLICY IF EXISTS agent_account_opening_tenant_isolation ON agent_account_opening_records;
DROP TABLE IF EXISTS agent_account_opening_idempotency;
DROP TABLE IF EXISTS agent_account_opening_audit;
DROP TABLE IF EXISTS agent_account_opening_records;
COMMIT;
