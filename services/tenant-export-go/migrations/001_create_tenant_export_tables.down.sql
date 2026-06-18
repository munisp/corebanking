-- Rollback: 001_create_tenant_export_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tenant_export_updated ON tenant_export_records;
DROP FUNCTION IF EXISTS update_tenant_export_timestamp();
DROP FUNCTION IF EXISTS cleanup_tenant_export_idempotency();
DROP POLICY IF EXISTS tenant_export_tenant_isolation ON tenant_export_records;
DROP TABLE IF EXISTS tenant_export_idempotency;
DROP TABLE IF EXISTS tenant_export_audit;
DROP TABLE IF EXISTS tenant_export_records;
COMMIT;
