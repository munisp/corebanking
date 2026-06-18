-- Rollback: 001_create_langchain_agent_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_langchain_agent_updated ON langchain_agent_records;
DROP FUNCTION IF EXISTS update_langchain_agent_timestamp();
DROP FUNCTION IF EXISTS cleanup_langchain_agent_idempotency();
DROP POLICY IF EXISTS langchain_agent_tenant_isolation ON langchain_agent_records;
DROP TABLE IF EXISTS langchain_agent_idempotency;
DROP TABLE IF EXISTS langchain_agent_audit;
DROP TABLE IF EXISTS langchain_agent_records;
COMMIT;
