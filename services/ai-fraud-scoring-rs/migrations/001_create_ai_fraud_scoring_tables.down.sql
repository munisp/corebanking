-- Rollback: 001_create_ai_fraud_scoring_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ai_fraud_scoring_updated ON ai_fraud_scoring_records;
DROP FUNCTION IF EXISTS update_ai_fraud_scoring_timestamp();
DROP FUNCTION IF EXISTS cleanup_ai_fraud_scoring_idempotency();
DROP POLICY IF EXISTS ai_fraud_scoring_tenant_isolation ON ai_fraud_scoring_records;
DROP TABLE IF EXISTS ai_fraud_scoring_idempotency;
DROP TABLE IF EXISTS ai_fraud_scoring_audit;
DROP TABLE IF EXISTS ai_fraud_scoring_records;
COMMIT;
