-- Rollback: 001_create_liveness_inference_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_liveness_inference_updated ON liveness_inference_records;
DROP FUNCTION IF EXISTS update_liveness_inference_timestamp();
DROP FUNCTION IF EXISTS cleanup_liveness_inference_idempotency();
DROP POLICY IF EXISTS liveness_inference_tenant_isolation ON liveness_inference_records;
DROP TABLE IF EXISTS liveness_inference_idempotency;
DROP TABLE IF EXISTS liveness_inference_audit;
DROP TABLE IF EXISTS liveness_inference_records;
COMMIT;
