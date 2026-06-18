-- Rollback: 001_create_parametric_insurance_iot_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_parametric_insurance_iot_updated ON parametric_insurance_iot_records;
DROP FUNCTION IF EXISTS update_parametric_insurance_iot_timestamp();
DROP FUNCTION IF EXISTS cleanup_parametric_insurance_iot_idempotency();
DROP POLICY IF EXISTS parametric_insurance_iot_tenant_isolation ON parametric_insurance_iot_records;
DROP TABLE IF EXISTS parametric_insurance_iot_idempotency;
DROP TABLE IF EXISTS parametric_insurance_iot_audit;
DROP TABLE IF EXISTS parametric_insurance_iot_records;
COMMIT;
