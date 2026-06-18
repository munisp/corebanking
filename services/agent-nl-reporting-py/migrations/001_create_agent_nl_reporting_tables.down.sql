-- Rollback: 001_create_agent_nl_reporting_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_nl_reporting_updated ON agent_nl_reporting_records;
DROP FUNCTION IF EXISTS update_agent_nl_reporting_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_nl_reporting_idempotency();
DROP POLICY IF EXISTS agent_nl_reporting_tenant_isolation ON agent_nl_reporting_records;
DROP TABLE IF EXISTS agent_nl_reporting_idempotency;
DROP TABLE IF EXISTS agent_nl_reporting_audit;
DROP TABLE IF EXISTS agent_nl_reporting_records;
COMMIT;
