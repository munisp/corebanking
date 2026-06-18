-- Rollback: 001_create_kyc_analytics_dashboard_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kyc_analytics_dashboard_updated ON kyc_analytics_dashboard_records;
DROP FUNCTION IF EXISTS update_kyc_analytics_dashboard_timestamp();
DROP FUNCTION IF EXISTS cleanup_kyc_analytics_dashboard_idempotency();
DROP POLICY IF EXISTS kyc_analytics_dashboard_tenant_isolation ON kyc_analytics_dashboard_records;
DROP TABLE IF EXISTS kyc_analytics_dashboard_idempotency;
DROP TABLE IF EXISTS kyc_analytics_dashboard_audit;
DROP TABLE IF EXISTS kyc_analytics_dashboard_records;
COMMIT;
