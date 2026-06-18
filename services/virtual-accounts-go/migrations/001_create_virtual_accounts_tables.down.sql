-- Rollback: 001_create_virtual_accounts_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_virtual_accounts_updated ON virtual_accounts_records;
DROP FUNCTION IF EXISTS update_virtual_accounts_timestamp();
DROP FUNCTION IF EXISTS cleanup_virtual_accounts_idempotency();
DROP POLICY IF EXISTS virtual_accounts_tenant_isolation ON virtual_accounts_records;
DROP TABLE IF EXISTS virtual_accounts_idempotency;
DROP TABLE IF EXISTS virtual_accounts_audit;
DROP TABLE IF EXISTS virtual_accounts_records;
COMMIT;
