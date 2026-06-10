-- Rollback: 001_create_product_factory_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_product_factory_updated ON product_factory_records;
DROP FUNCTION IF EXISTS update_product_factory_timestamp();
DROP FUNCTION IF EXISTS cleanup_product_factory_idempotency();
DROP POLICY IF EXISTS product_factory_tenant_isolation ON product_factory_records;
DROP TABLE IF EXISTS product_factory_idempotency;
DROP TABLE IF EXISTS product_factory_audit;
DROP TABLE IF EXISTS product_factory_records;
COMMIT;
