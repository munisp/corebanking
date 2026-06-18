-- Rollback: 001_create_microfinance_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_microfinance_engine_updated ON microfinance_engine_records;
DROP FUNCTION IF EXISTS update_microfinance_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_microfinance_engine_idempotency();
DROP POLICY IF EXISTS microfinance_engine_tenant_isolation ON microfinance_engine_records;
DROP TABLE IF EXISTS microfinance_engine_idempotency;
DROP TABLE IF EXISTS microfinance_engine_audit;
DROP TABLE IF EXISTS microfinance_engine_records;
COMMIT;
