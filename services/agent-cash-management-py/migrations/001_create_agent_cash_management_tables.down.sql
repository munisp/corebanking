-- Rollback: 001_create_agent_cash_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_cash_management_updated ON agent_cash_management_records;
DROP FUNCTION IF EXISTS update_agent_cash_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_cash_management_idempotency();
DROP POLICY IF EXISTS agent_cash_management_tenant_isolation ON agent_cash_management_records;
DROP TABLE IF EXISTS agent_cash_management_idempotency;
DROP TABLE IF EXISTS agent_cash_management_audit;
DROP TABLE IF EXISTS agent_cash_management_records;
COMMIT;
