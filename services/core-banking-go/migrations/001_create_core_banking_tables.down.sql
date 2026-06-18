-- Rollback: 001_create_core_banking_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_core_banking_updated ON core_banking_records;
DROP FUNCTION IF EXISTS update_core_banking_timestamp();
DROP FUNCTION IF EXISTS cleanup_core_banking_idempotency();
DROP POLICY IF EXISTS core_banking_tenant_isolation ON core_banking_records;
DROP TABLE IF EXISTS core_banking_idempotency;
DROP TABLE IF EXISTS core_banking_audit;
DROP TABLE IF EXISTS core_banking_records;
COMMIT;
