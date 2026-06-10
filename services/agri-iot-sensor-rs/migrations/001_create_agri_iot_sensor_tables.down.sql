-- Rollback: 001_create_agri_iot_sensor_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agri_iot_sensor_updated ON agri_iot_sensor_records;
DROP FUNCTION IF EXISTS update_agri_iot_sensor_timestamp();
DROP FUNCTION IF EXISTS cleanup_agri_iot_sensor_idempotency();
DROP POLICY IF EXISTS agri_iot_sensor_tenant_isolation ON agri_iot_sensor_records;
DROP TABLE IF EXISTS agri_iot_sensor_idempotency;
DROP TABLE IF EXISTS agri_iot_sensor_audit;
DROP TABLE IF EXISTS agri_iot_sensor_records;
COMMIT;
