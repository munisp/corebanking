-- Rollback: 001_create_gnn_fraud_detection_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_gnn_fraud_detection_updated ON gnn_fraud_detection_records;
DROP FUNCTION IF EXISTS update_gnn_fraud_detection_timestamp();
DROP FUNCTION IF EXISTS cleanup_gnn_fraud_detection_idempotency();
DROP POLICY IF EXISTS gnn_fraud_detection_tenant_isolation ON gnn_fraud_detection_records;
DROP TABLE IF EXISTS gnn_fraud_detection_idempotency;
DROP TABLE IF EXISTS gnn_fraud_detection_audit;
DROP TABLE IF EXISTS gnn_fraud_detection_records;
COMMIT;
