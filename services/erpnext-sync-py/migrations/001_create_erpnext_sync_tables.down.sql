-- Rollback: 001_create_erpnext_sync_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_erpnext_sync_updated ON erpnext_sync_records;
DROP FUNCTION IF EXISTS update_erpnext_sync_timestamp();
DROP FUNCTION IF EXISTS cleanup_erpnext_sync_idempotency();
DROP POLICY IF EXISTS erpnext_sync_tenant_isolation ON erpnext_sync_records;
DROP TABLE IF EXISTS erpnext_sync_idempotency;
DROP TABLE IF EXISTS erpnext_sync_audit;
DROP TABLE IF EXISTS erpnext_sync_records;
COMMIT;
