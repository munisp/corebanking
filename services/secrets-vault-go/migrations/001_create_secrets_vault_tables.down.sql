-- Rollback: 001_create_secrets_vault_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_secrets_vault_updated ON secrets_vault_records;
DROP FUNCTION IF EXISTS update_secrets_vault_timestamp();
DROP FUNCTION IF EXISTS cleanup_secrets_vault_idempotency();
DROP POLICY IF EXISTS secrets_vault_tenant_isolation ON secrets_vault_records;
DROP TABLE IF EXISTS secrets_vault_idempotency;
DROP TABLE IF EXISTS secrets_vault_audit;
DROP TABLE IF EXISTS secrets_vault_records;
COMMIT;
