-- Rollback: 001_create_customer_360_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_customer_360_updated ON customer_360_records;
DROP FUNCTION IF EXISTS update_customer_360_timestamp();
DROP FUNCTION IF EXISTS cleanup_customer_360_idempotency();
DROP POLICY IF EXISTS customer_360_tenant_isolation ON customer_360_records;
DROP TABLE IF EXISTS customer_360_idempotency;
DROP TABLE IF EXISTS customer_360_audit;
DROP TABLE IF EXISTS customer_360_records;
COMMIT;
