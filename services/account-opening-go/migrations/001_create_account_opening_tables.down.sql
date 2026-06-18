-- Rollback: 001_create_account_opening_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_account_opening_updated ON account_opening_records;
DROP FUNCTION IF EXISTS update_account_opening_timestamp();
DROP FUNCTION IF EXISTS cleanup_account_opening_idempotency();
DROP POLICY IF EXISTS account_opening_tenant_isolation ON account_opening_records;
DROP TABLE IF EXISTS account_opening_idempotency;
DROP TABLE IF EXISTS account_opening_audit;
DROP TABLE IF EXISTS account_opening_records;
COMMIT;
