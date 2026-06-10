-- Rollback: 001_create_agent_loan_origination_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_loan_origination_updated ON agent_loan_origination_records;
DROP FUNCTION IF EXISTS update_agent_loan_origination_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_loan_origination_idempotency();
DROP POLICY IF EXISTS agent_loan_origination_tenant_isolation ON agent_loan_origination_records;
DROP TABLE IF EXISTS agent_loan_origination_idempotency;
DROP TABLE IF EXISTS agent_loan_origination_audit;
DROP TABLE IF EXISTS agent_loan_origination_records;
COMMIT;
