-- Rollback: 001_create_diaspora_banking_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_diaspora_banking_updated ON diaspora_banking_records;
DROP FUNCTION IF EXISTS update_diaspora_banking_timestamp();
DROP FUNCTION IF EXISTS cleanup_diaspora_banking_idempotency();
DROP POLICY IF EXISTS diaspora_banking_tenant_isolation ON diaspora_banking_records;
DROP TABLE IF EXISTS diaspora_banking_idempotency;
DROP TABLE IF EXISTS diaspora_banking_audit;
DROP TABLE IF EXISTS diaspora_banking_records;
COMMIT;
