-- Rollback: 001_create_agent_banking_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_banking_updated ON agent_banking_records;
DROP FUNCTION IF EXISTS update_agent_banking_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_banking_idempotency();
DROP POLICY IF EXISTS agent_banking_tenant_isolation ON agent_banking_records;
DROP TABLE IF EXISTS agent_banking_idempotency;
DROP TABLE IF EXISTS agent_banking_audit;
DROP TABLE IF EXISTS agent_banking_records;
COMMIT;
