-- Rollback: 001_create_money_market_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_money_market_updated ON money_market_records;
DROP FUNCTION IF EXISTS update_money_market_timestamp();
DROP FUNCTION IF EXISTS cleanup_money_market_idempotency();
DROP POLICY IF EXISTS money_market_tenant_isolation ON money_market_records;
DROP TABLE IF EXISTS money_market_idempotency;
DROP TABLE IF EXISTS money_market_audit;
DROP TABLE IF EXISTS money_market_records;
COMMIT;
