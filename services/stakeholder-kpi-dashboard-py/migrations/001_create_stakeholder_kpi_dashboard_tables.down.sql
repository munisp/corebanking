-- Rollback: 001_create_stakeholder_kpi_dashboard_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_stakeholder_kpi_dashboard_updated ON stakeholder_kpi_dashboard_records;
DROP FUNCTION IF EXISTS update_stakeholder_kpi_dashboard_timestamp();
DROP FUNCTION IF EXISTS cleanup_stakeholder_kpi_dashboard_idempotency();
DROP POLICY IF EXISTS stakeholder_kpi_dashboard_tenant_isolation ON stakeholder_kpi_dashboard_records;
DROP TABLE IF EXISTS stakeholder_kpi_dashboard_idempotency;
DROP TABLE IF EXISTS stakeholder_kpi_dashboard_audit;
DROP TABLE IF EXISTS stakeholder_kpi_dashboard_records;
COMMIT;
