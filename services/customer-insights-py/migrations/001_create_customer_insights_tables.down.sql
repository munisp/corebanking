-- Rollback: 001_create_customer_insights_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_customer_insights_updated ON customer_insights_records;
DROP FUNCTION IF EXISTS update_customer_insights_timestamp();
DROP FUNCTION IF EXISTS cleanup_customer_insights_idempotency();
DROP POLICY IF EXISTS customer_insights_tenant_isolation ON customer_insights_records;
DROP TABLE IF EXISTS customer_insights_idempotency;
DROP TABLE IF EXISTS customer_insights_audit;
DROP TABLE IF EXISTS customer_insights_records;
COMMIT;
