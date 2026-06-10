-- Rollback: 001_create_prometheus_dashboard_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_prometheus_dashboard_updated ON prometheus_dashboard_records;
DROP FUNCTION IF EXISTS update_prometheus_dashboard_timestamp();
DROP FUNCTION IF EXISTS cleanup_prometheus_dashboard_idempotency();
DROP POLICY IF EXISTS prometheus_dashboard_tenant_isolation ON prometheus_dashboard_records;
DROP TABLE IF EXISTS prometheus_dashboard_idempotency;
DROP TABLE IF EXISTS prometheus_dashboard_audit;
DROP TABLE IF EXISTS prometheus_dashboard_records;
COMMIT;
