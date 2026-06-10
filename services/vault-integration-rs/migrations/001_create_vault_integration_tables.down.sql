-- Rollback: 001_create_vault_integration_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_vault_integration_updated ON vault_integration_records;
DROP FUNCTION IF EXISTS update_vault_integration_timestamp();
DROP FUNCTION IF EXISTS cleanup_vault_integration_idempotency();
DROP POLICY IF EXISTS vault_integration_tenant_isolation ON vault_integration_records;
DROP TABLE IF EXISTS vault_integration_idempotency;
DROP TABLE IF EXISTS vault_integration_audit;
DROP TABLE IF EXISTS vault_integration_records;
COMMIT;
