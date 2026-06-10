-- Rollback: 001_create_savings_products_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_savings_products_updated ON savings_products_records;
DROP FUNCTION IF EXISTS update_savings_products_timestamp();
DROP FUNCTION IF EXISTS cleanup_savings_products_idempotency();
DROP POLICY IF EXISTS savings_products_tenant_isolation ON savings_products_records;
DROP TABLE IF EXISTS savings_products_idempotency;
DROP TABLE IF EXISTS savings_products_audit;
DROP TABLE IF EXISTS savings_products_records;
COMMIT;
