-- Rollback: 001_create_cash_pooling_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cash_pooling_updated ON cash_pooling_records;
DROP FUNCTION IF EXISTS update_cash_pooling_timestamp();
DROP FUNCTION IF EXISTS cleanup_cash_pooling_idempotency();
DROP POLICY IF EXISTS cash_pooling_tenant_isolation ON cash_pooling_records;
DROP TABLE IF EXISTS cash_pooling_idempotency;
DROP TABLE IF EXISTS cash_pooling_audit;
DROP TABLE IF EXISTS cash_pooling_records;
COMMIT;
