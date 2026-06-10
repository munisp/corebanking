-- Rollback: 001_create_fraud_detection_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_fraud_detection_updated ON fraud_detection_records;
DROP FUNCTION IF EXISTS update_fraud_detection_timestamp();
DROP FUNCTION IF EXISTS cleanup_fraud_detection_idempotency();
DROP POLICY IF EXISTS fraud_detection_tenant_isolation ON fraud_detection_records;
DROP TABLE IF EXISTS fraud_detection_idempotency;
DROP TABLE IF EXISTS fraud_detection_audit;
DROP TABLE IF EXISTS fraud_detection_records;
COMMIT;
