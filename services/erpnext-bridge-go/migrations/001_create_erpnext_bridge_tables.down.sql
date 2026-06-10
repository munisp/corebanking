-- Rollback: 001_create_erpnext_bridge_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_erpnext_bridge_updated ON erpnext_bridge_records;
DROP FUNCTION IF EXISTS update_erpnext_bridge_timestamp();
DROP FUNCTION IF EXISTS cleanup_erpnext_bridge_idempotency();
DROP POLICY IF EXISTS erpnext_bridge_tenant_isolation ON erpnext_bridge_records;
DROP TABLE IF EXISTS erpnext_bridge_idempotency;
DROP TABLE IF EXISTS erpnext_bridge_audit;
DROP TABLE IF EXISTS erpnext_bridge_records;
COMMIT;
