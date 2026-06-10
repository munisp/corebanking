-- Rollback: 001_create_liveness_detection_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_liveness_detection_updated ON liveness_detection_records;
DROP FUNCTION IF EXISTS update_liveness_detection_timestamp();
DROP FUNCTION IF EXISTS cleanup_liveness_detection_idempotency();
DROP POLICY IF EXISTS liveness_detection_tenant_isolation ON liveness_detection_records;
DROP TABLE IF EXISTS liveness_detection_idempotency;
DROP TABLE IF EXISTS liveness_detection_audit;
DROP TABLE IF EXISTS liveness_detection_records;
COMMIT;
