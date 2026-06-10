-- Rollback: 001_create_account_closure_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_account_closure_updated ON account_closure_records;
DROP FUNCTION IF EXISTS update_account_closure_timestamp();
DROP FUNCTION IF EXISTS cleanup_account_closure_idempotency();
DROP POLICY IF EXISTS account_closure_tenant_isolation ON account_closure_records;
DROP TABLE IF EXISTS account_closure_idempotency;
DROP TABLE IF EXISTS account_closure_audit;
DROP TABLE IF EXISTS account_closure_records;
COMMIT;
