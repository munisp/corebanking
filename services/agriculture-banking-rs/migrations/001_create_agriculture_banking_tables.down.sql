-- Rollback: 001_create_agriculture_banking_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agriculture_banking_updated ON agriculture_banking_records;
DROP FUNCTION IF EXISTS update_agriculture_banking_timestamp();
DROP FUNCTION IF EXISTS cleanup_agriculture_banking_idempotency();
DROP POLICY IF EXISTS agriculture_banking_tenant_isolation ON agriculture_banking_records;
DROP TABLE IF EXISTS agriculture_banking_idempotency;
DROP TABLE IF EXISTS agriculture_banking_audit;
DROP TABLE IF EXISTS agriculture_banking_records;
COMMIT;
