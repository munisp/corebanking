-- Rollback: 001_create_aml_compliance_dashboard_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_aml_compliance_dashboard_updated ON aml_compliance_dashboard_records;
DROP FUNCTION IF EXISTS update_aml_compliance_dashboard_timestamp();
DROP FUNCTION IF EXISTS cleanup_aml_compliance_dashboard_idempotency();
DROP POLICY IF EXISTS aml_compliance_dashboard_tenant_isolation ON aml_compliance_dashboard_records;
DROP TABLE IF EXISTS aml_compliance_dashboard_idempotency;
DROP TABLE IF EXISTS aml_compliance_dashboard_audit;
DROP TABLE IF EXISTS aml_compliance_dashboard_records;
COMMIT;
