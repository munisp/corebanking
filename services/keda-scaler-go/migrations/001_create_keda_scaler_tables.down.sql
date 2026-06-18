-- Rollback: 001_create_keda_scaler_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_keda_scaler_updated ON keda_scaler_records;
DROP FUNCTION IF EXISTS update_keda_scaler_timestamp();
DROP FUNCTION IF EXISTS cleanup_keda_scaler_idempotency();
DROP POLICY IF EXISTS keda_scaler_tenant_isolation ON keda_scaler_records;
DROP TABLE IF EXISTS keda_scaler_idempotency;
DROP TABLE IF EXISTS keda_scaler_audit;
DROP TABLE IF EXISTS keda_scaler_records;
COMMIT;
