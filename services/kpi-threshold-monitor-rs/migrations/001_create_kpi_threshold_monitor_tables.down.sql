-- Rollback: 001_create_kpi_threshold_monitor_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kpi_threshold_monitor_updated ON kpi_threshold_monitor_records;
DROP FUNCTION IF EXISTS update_kpi_threshold_monitor_timestamp();
DROP FUNCTION IF EXISTS cleanup_kpi_threshold_monitor_idempotency();
DROP POLICY IF EXISTS kpi_threshold_monitor_tenant_isolation ON kpi_threshold_monitor_records;
DROP TABLE IF EXISTS kpi_threshold_monitor_idempotency;
DROP TABLE IF EXISTS kpi_threshold_monitor_audit;
DROP TABLE IF EXISTS kpi_threshold_monitor_records;
COMMIT;
