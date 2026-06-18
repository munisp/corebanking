-- Rollback: 001_create_islamic_banking_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_islamic_banking_engine_updated ON islamic_banking_engine_records;
DROP FUNCTION IF EXISTS update_islamic_banking_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_islamic_banking_engine_idempotency();
DROP POLICY IF EXISTS islamic_banking_engine_tenant_isolation ON islamic_banking_engine_records;
DROP TABLE IF EXISTS islamic_banking_engine_idempotency;
DROP TABLE IF EXISTS islamic_banking_engine_audit;
DROP TABLE IF EXISTS islamic_banking_engine_records;
COMMIT;
