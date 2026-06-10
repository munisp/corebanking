-- Rollback: 001_create_account_statement_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_account_statement_updated ON account_statement_records;
DROP FUNCTION IF EXISTS update_account_statement_timestamp();
DROP FUNCTION IF EXISTS cleanup_account_statement_idempotency();
DROP POLICY IF EXISTS account_statement_tenant_isolation ON account_statement_records;
DROP TABLE IF EXISTS account_statement_idempotency;
DROP TABLE IF EXISTS account_statement_audit;
DROP TABLE IF EXISTS account_statement_records;
COMMIT;
