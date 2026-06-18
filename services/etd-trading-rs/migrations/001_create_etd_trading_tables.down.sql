-- Rollback: 001_create_etd_trading_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_etd_trading_updated ON etd_trading_records;
DROP FUNCTION IF EXISTS update_etd_trading_timestamp();
DROP FUNCTION IF EXISTS cleanup_etd_trading_idempotency();
DROP POLICY IF EXISTS etd_trading_tenant_isolation ON etd_trading_records;
DROP TABLE IF EXISTS etd_trading_idempotency;
DROP TABLE IF EXISTS etd_trading_audit;
DROP TABLE IF EXISTS etd_trading_records;
COMMIT;
