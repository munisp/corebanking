-- Rollback: 001_create_api_key_vault_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_api_key_vault_updated ON api_key_vault_records;
DROP FUNCTION IF EXISTS update_api_key_vault_timestamp();
DROP FUNCTION IF EXISTS cleanup_api_key_vault_idempotency();
DROP POLICY IF EXISTS api_key_vault_tenant_isolation ON api_key_vault_records;
DROP TABLE IF EXISTS api_key_vault_idempotency;
DROP TABLE IF EXISTS api_key_vault_audit;
DROP TABLE IF EXISTS api_key_vault_records;
COMMIT;
