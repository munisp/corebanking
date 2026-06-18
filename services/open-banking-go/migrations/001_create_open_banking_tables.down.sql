-- Rollback: 001_create_open_banking_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_open_banking_updated ON open_banking_records;
DROP FUNCTION IF EXISTS update_open_banking_timestamp();
DROP FUNCTION IF EXISTS cleanup_open_banking_idempotency();
DROP POLICY IF EXISTS open_banking_tenant_isolation ON open_banking_records;
DROP TABLE IF EXISTS open_banking_idempotency;
DROP TABLE IF EXISTS open_banking_audit;
DROP TABLE IF EXISTS open_banking_records;
COMMIT;
