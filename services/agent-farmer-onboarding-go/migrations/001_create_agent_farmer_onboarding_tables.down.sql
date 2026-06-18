-- Rollback: 001_create_agent_farmer_onboarding_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_farmer_onboarding_updated ON agent_farmer_onboarding_records;
DROP FUNCTION IF EXISTS update_agent_farmer_onboarding_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_farmer_onboarding_idempotency();
DROP POLICY IF EXISTS agent_farmer_onboarding_tenant_isolation ON agent_farmer_onboarding_records;
DROP TABLE IF EXISTS agent_farmer_onboarding_idempotency;
DROP TABLE IF EXISTS agent_farmer_onboarding_audit;
DROP TABLE IF EXISTS agent_farmer_onboarding_records;
COMMIT;
