-- Rollback: 001_create_agent_fraud_detection_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agent_fraud_detection_updated ON agent_fraud_detection_records;
DROP FUNCTION IF EXISTS update_agent_fraud_detection_timestamp();
DROP FUNCTION IF EXISTS cleanup_agent_fraud_detection_idempotency();
DROP POLICY IF EXISTS agent_fraud_detection_tenant_isolation ON agent_fraud_detection_records;
DROP TABLE IF EXISTS agent_fraud_detection_idempotency;
DROP TABLE IF EXISTS agent_fraud_detection_audit;
DROP TABLE IF EXISTS agent_fraud_detection_records;
COMMIT;
