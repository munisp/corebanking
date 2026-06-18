-- Rollback: 001_create_hpa_autoscaler_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_hpa_autoscaler_updated ON hpa_autoscaler_records;
DROP FUNCTION IF EXISTS update_hpa_autoscaler_timestamp();
DROP FUNCTION IF EXISTS cleanup_hpa_autoscaler_idempotency();
DROP POLICY IF EXISTS hpa_autoscaler_tenant_isolation ON hpa_autoscaler_records;
DROP TABLE IF EXISTS hpa_autoscaler_idempotency;
DROP TABLE IF EXISTS hpa_autoscaler_audit;
DROP TABLE IF EXISTS hpa_autoscaler_records;
COMMIT;
