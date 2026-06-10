-- Rollback: 001_create_customer_engagement_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_customer_engagement_updated ON customer_engagement_records;
DROP FUNCTION IF EXISTS update_customer_engagement_timestamp();
DROP FUNCTION IF EXISTS cleanup_customer_engagement_idempotency();
DROP POLICY IF EXISTS customer_engagement_tenant_isolation ON customer_engagement_records;
DROP TABLE IF EXISTS customer_engagement_idempotency;
DROP TABLE IF EXISTS customer_engagement_audit;
DROP TABLE IF EXISTS customer_engagement_records;
COMMIT;
