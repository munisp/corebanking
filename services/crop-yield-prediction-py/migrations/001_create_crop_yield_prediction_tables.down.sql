-- Rollback: 001_create_crop_yield_prediction_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_crop_yield_prediction_updated ON crop_yield_prediction_records;
DROP FUNCTION IF EXISTS update_crop_yield_prediction_timestamp();
DROP FUNCTION IF EXISTS cleanup_crop_yield_prediction_idempotency();
DROP POLICY IF EXISTS crop_yield_prediction_tenant_isolation ON crop_yield_prediction_records;
DROP TABLE IF EXISTS crop_yield_prediction_idempotency;
DROP TABLE IF EXISTS crop_yield_prediction_audit;
DROP TABLE IF EXISTS crop_yield_prediction_records;
COMMIT;
