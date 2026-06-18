-- Rollback: 001_create_commodity_exchange_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_commodity_exchange_updated ON commodity_exchange_records;
DROP FUNCTION IF EXISTS update_commodity_exchange_timestamp();
DROP FUNCTION IF EXISTS cleanup_commodity_exchange_idempotency();
DROP POLICY IF EXISTS commodity_exchange_tenant_isolation ON commodity_exchange_records;
DROP TABLE IF EXISTS commodity_exchange_idempotency;
DROP TABLE IF EXISTS commodity_exchange_audit;
DROP TABLE IF EXISTS commodity_exchange_records;
COMMIT;
