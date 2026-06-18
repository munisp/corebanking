-- Rollback: 001_create_inventory_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_inventory_updated ON inventory_records;
DROP FUNCTION IF EXISTS update_inventory_timestamp();
DROP FUNCTION IF EXISTS cleanup_inventory_idempotency();
DROP POLICY IF EXISTS inventory_tenant_isolation ON inventory_records;
DROP TABLE IF EXISTS inventory_idempotency;
DROP TABLE IF EXISTS inventory_audit;
DROP TABLE IF EXISTS inventory_records;
COMMIT;
