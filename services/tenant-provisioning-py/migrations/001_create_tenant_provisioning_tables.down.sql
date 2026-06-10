-- Rollback: 001_create_tenant_provisioning_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tenant_provisioning_updated ON tenant_provisioning_records;
DROP FUNCTION IF EXISTS update_tenant_provisioning_timestamp();
DROP FUNCTION IF EXISTS cleanup_tenant_provisioning_idempotency();
DROP POLICY IF EXISTS tenant_provisioning_tenant_isolation ON tenant_provisioning_records;
DROP TABLE IF EXISTS tenant_provisioning_idempotency;
DROP TABLE IF EXISTS tenant_provisioning_audit;
DROP TABLE IF EXISTS tenant_provisioning_records;
COMMIT;
