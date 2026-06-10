-- Rollback: 001_create_microfinance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_microfinance_updated ON microfinance_records;
DROP FUNCTION IF EXISTS update_microfinance_timestamp();
DROP FUNCTION IF EXISTS cleanup_microfinance_idempotency();
DROP POLICY IF EXISTS microfinance_tenant_isolation ON microfinance_records;
DROP TABLE IF EXISTS microfinance_idempotency;
DROP TABLE IF EXISTS microfinance_audit;
DROP TABLE IF EXISTS microfinance_records;
COMMIT;
