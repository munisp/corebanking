-- Rollback: 001_create_voice_agent_escalation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_voice_agent_escalation_updated ON voice_agent_escalation_records;
DROP FUNCTION IF EXISTS update_voice_agent_escalation_timestamp();
DROP FUNCTION IF EXISTS cleanup_voice_agent_escalation_idempotency();
DROP POLICY IF EXISTS voice_agent_escalation_tenant_isolation ON voice_agent_escalation_records;
DROP TABLE IF EXISTS voice_agent_escalation_idempotency;
DROP TABLE IF EXISTS voice_agent_escalation_audit;
DROP TABLE IF EXISTS voice_agent_escalation_records;
COMMIT;
