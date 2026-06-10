-- Rollback: 001_create_agent_regulatory_returns_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_regulatory_returns_updated ON agent_regulatory_returns_records;
DROP FUNCTION IF EXISTS update_agent_regulatory_returns_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_regulatory_returns_idempotency();
DROP POLICY IF EXISTS agent_regulatory_returns_tenant_isolation ON agent_regulatory_returns_records;
DROP TABLE IF EXISTS agent_regulatory_returns_idempotency;
DROP TABLE IF EXISTS agent_regulatory_returns_audit;
DROP TABLE IF EXISTS agent_regulatory_returns_records;
COMMIT;
