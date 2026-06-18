-- Rollback: 001_create_anomaly_detector_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_anomaly_detector_updated ON anomaly_detector_records;
DROP FUNCTION IF EXISTS update_anomaly_detector_timestamp();
DROP FUNCTION IF EXISTS cleanup_anomaly_detector_idempotency();
DROP POLICY IF EXISTS anomaly_detector_tenant_isolation ON anomaly_detector_records;
DROP TABLE IF EXISTS anomaly_detector_idempotency;
DROP TABLE IF EXISTS anomaly_detector_audit;
DROP TABLE IF EXISTS anomaly_detector_records;
COMMIT;
