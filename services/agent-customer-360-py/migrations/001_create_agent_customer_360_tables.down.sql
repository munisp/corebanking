-- Rollback: 001_create_agent_customer_360_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_customer_360_updated ON agent_customer_360_records;
DROP FUNCTION IF EXISTS update_agent_customer_360_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_customer_360_idempotency();
DROP POLICY IF EXISTS agent_customer_360_tenant_isolation ON agent_customer_360_records;
DROP TABLE IF EXISTS agent_customer_360_idempotency;
DROP TABLE IF EXISTS agent_customer_360_audit;
DROP TABLE IF EXISTS agent_customer_360_records;
COMMIT;
