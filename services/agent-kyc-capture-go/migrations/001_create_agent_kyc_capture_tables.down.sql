-- Rollback: 001_create_agent_kyc_capture_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_kyc_capture_updated ON agent_kyc_capture_records;
DROP FUNCTION IF EXISTS update_agent_kyc_capture_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_kyc_capture_idempotency();
DROP POLICY IF EXISTS agent_kyc_capture_tenant_isolation ON agent_kyc_capture_records;
DROP TABLE IF EXISTS agent_kyc_capture_idempotency;
DROP TABLE IF EXISTS agent_kyc_capture_audit;
DROP TABLE IF EXISTS agent_kyc_capture_records;
COMMIT;
