-- Rollback: 001_create_customer_360_dashboard_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_customer_360_dashboard_updated ON customer_360_dashboard_records;
DROP FUNCTION IF EXISTS update_customer_360_dashboard_timestamp();
DROP FUNCTION IF EXISTS cleanup_customer_360_dashboard_idempotency();
DROP POLICY IF EXISTS customer_360_dashboard_tenant_isolation ON customer_360_dashboard_records;
DROP TABLE IF EXISTS customer_360_dashboard_idempotency;
DROP TABLE IF EXISTS customer_360_dashboard_audit;
DROP TABLE IF EXISTS customer_360_dashboard_records;
COMMIT;
