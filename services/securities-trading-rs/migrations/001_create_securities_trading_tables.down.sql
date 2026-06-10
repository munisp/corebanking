-- Rollback: 001_create_securities_trading_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_securities_trading_updated ON securities_trading_records;
DROP FUNCTION IF EXISTS update_securities_trading_timestamp();
DROP FUNCTION IF EXISTS cleanup_securities_trading_idempotency();
DROP POLICY IF EXISTS securities_trading_tenant_isolation ON securities_trading_records;
DROP TABLE IF EXISTS securities_trading_idempotency;
DROP TABLE IF EXISTS securities_trading_audit;
DROP TABLE IF EXISTS securities_trading_records;
COMMIT;
