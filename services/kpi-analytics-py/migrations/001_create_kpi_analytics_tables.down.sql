-- Rollback: 001_create_kpi_analytics_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kpi_analytics_updated ON kpi_analytics_records;
DROP FUNCTION IF EXISTS update_kpi_analytics_timestamp();
DROP FUNCTION IF EXISTS cleanup_kpi_analytics_idempotency();
DROP POLICY IF EXISTS kpi_analytics_tenant_isolation ON kpi_analytics_records;
DROP TABLE IF EXISTS kpi_analytics_idempotency;
DROP TABLE IF EXISTS kpi_analytics_audit;
DROP TABLE IF EXISTS kpi_analytics_records;
COMMIT;
