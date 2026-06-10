-- Rollback: 001_create_satellite_crop_monitor_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_satellite_crop_monitor_updated ON satellite_crop_monitor_records;
DROP FUNCTION IF EXISTS update_satellite_crop_monitor_timestamp();
DROP FUNCTION IF EXISTS cleanup_satellite_crop_monitor_idempotency();
DROP POLICY IF EXISTS satellite_crop_monitor_tenant_isolation ON satellite_crop_monitor_records;
DROP TABLE IF EXISTS satellite_crop_monitor_idempotency;
DROP TABLE IF EXISTS satellite_crop_monitor_audit;
DROP TABLE IF EXISTS satellite_crop_monitor_records;
COMMIT;
