-- Rollback: 001_create_agent_dormancy_prevention_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_dormancy_prevention_updated ON agent_dormancy_prevention_records;
DROP FUNCTION IF EXISTS update_agent_dormancy_prevention_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_dormancy_prevention_idempotency();
DROP POLICY IF EXISTS agent_dormancy_prevention_tenant_isolation ON agent_dormancy_prevention_records;
DROP TABLE IF EXISTS agent_dormancy_prevention_idempotency;
DROP TABLE IF EXISTS agent_dormancy_prevention_audit;
DROP TABLE IF EXISTS agent_dormancy_prevention_records;
COMMIT;
