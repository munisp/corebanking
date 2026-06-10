-- Rollback: 001_create_warehouse_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_warehouse_management_updated ON warehouse_management_records;
DROP FUNCTION IF EXISTS update_warehouse_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_warehouse_management_idempotency();
DROP POLICY IF EXISTS warehouse_management_tenant_isolation ON warehouse_management_records;
DROP TABLE IF EXISTS warehouse_management_idempotency;
DROP TABLE IF EXISTS warehouse_management_audit;
DROP TABLE IF EXISTS warehouse_management_records;
COMMIT;
