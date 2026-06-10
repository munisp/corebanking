-- Rollback: 001_create_tenant_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tenant_management_updated ON tenant_management_records;
DROP FUNCTION IF EXISTS update_tenant_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_tenant_management_idempotency();
DROP POLICY IF EXISTS tenant_management_tenant_isolation ON tenant_management_records;
DROP TABLE IF EXISTS tenant_management_idempotency;
DROP TABLE IF EXISTS tenant_management_audit;
DROP TABLE IF EXISTS tenant_management_records;
COMMIT;
