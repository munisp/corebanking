-- Rollback: 001_create_billing_analytics_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_billing_analytics_updated ON billing_analytics_records;
DROP FUNCTION IF EXISTS update_billing_analytics_timestamp();
DROP FUNCTION IF EXISTS cleanup_billing_analytics_idempotency();
DROP POLICY IF EXISTS billing_analytics_tenant_isolation ON billing_analytics_records;
DROP TABLE IF EXISTS billing_analytics_idempotency;
DROP TABLE IF EXISTS billing_analytics_audit;
DROP TABLE IF EXISTS billing_analytics_records;
COMMIT;
