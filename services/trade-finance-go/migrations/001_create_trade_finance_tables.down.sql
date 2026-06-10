-- Rollback: 001_create_trade_finance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_trade_finance_updated ON trade_finance_records;
DROP FUNCTION IF EXISTS update_trade_finance_timestamp();
DROP FUNCTION IF EXISTS cleanup_trade_finance_idempotency();
DROP POLICY IF EXISTS trade_finance_tenant_isolation ON trade_finance_records;
DROP TABLE IF EXISTS trade_finance_idempotency;
DROP TABLE IF EXISTS trade_finance_audit;
DROP TABLE IF EXISTS trade_finance_records;
COMMIT;
