-- Rollback: 001_create_treasury_liquidity_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_treasury_liquidity_updated ON treasury_liquidity_records;
DROP FUNCTION IF EXISTS update_treasury_liquidity_timestamp();
DROP FUNCTION IF EXISTS cleanup_treasury_liquidity_idempotency();
DROP POLICY IF EXISTS treasury_liquidity_tenant_isolation ON treasury_liquidity_records;
DROP TABLE IF EXISTS treasury_liquidity_idempotency;
DROP TABLE IF EXISTS treasury_liquidity_audit;
DROP TABLE IF EXISTS treasury_liquidity_records;
COMMIT;
