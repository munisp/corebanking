-- Rollback: 001_create_trade_finance_gl_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_trade_finance_gl_updated ON trade_finance_gl_records;
DROP FUNCTION IF EXISTS update_trade_finance_gl_timestamp();
DROP FUNCTION IF EXISTS cleanup_trade_finance_gl_idempotency();
DROP POLICY IF EXISTS trade_finance_gl_tenant_isolation ON trade_finance_gl_records;
DROP TABLE IF EXISTS trade_finance_gl_idempotency;
DROP TABLE IF EXISTS trade_finance_gl_audit;
DROP TABLE IF EXISTS trade_finance_gl_records;
COMMIT;
