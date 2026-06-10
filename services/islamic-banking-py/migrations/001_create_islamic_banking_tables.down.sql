-- Rollback: 001_create_islamic_banking_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_islamic_banking_updated ON islamic_banking_records;
DROP FUNCTION IF EXISTS update_islamic_banking_timestamp();
DROP FUNCTION IF EXISTS cleanup_islamic_banking_idempotency();
DROP POLICY IF EXISTS islamic_banking_tenant_isolation ON islamic_banking_records;
DROP TABLE IF EXISTS islamic_banking_idempotency;
DROP TABLE IF EXISTS islamic_banking_audit;
DROP TABLE IF EXISTS islamic_banking_records;
COMMIT;
