-- Rollback: 001_create_multi_peril_crop_insurance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_multi_peril_crop_insurance_updated ON multi_peril_crop_insurance_records;
DROP FUNCTION IF EXISTS update_multi_peril_crop_insurance_timestamp();
DROP FUNCTION IF EXISTS cleanup_multi_peril_crop_insurance_idempotency();
DROP POLICY IF EXISTS multi_peril_crop_insurance_tenant_isolation ON multi_peril_crop_insurance_records;
DROP TABLE IF EXISTS multi_peril_crop_insurance_idempotency;
DROP TABLE IF EXISTS multi_peril_crop_insurance_audit;
DROP TABLE IF EXISTS multi_peril_crop_insurance_records;
COMMIT;
