-- Rollback: 001_create_standing_orders_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_standing_orders_updated ON standing_orders_records;
DROP FUNCTION IF EXISTS update_standing_orders_timestamp();
DROP FUNCTION IF EXISTS cleanup_standing_orders_idempotency();
DROP POLICY IF EXISTS standing_orders_tenant_isolation ON standing_orders_records;
DROP TABLE IF EXISTS standing_orders_idempotency;
DROP TABLE IF EXISTS standing_orders_audit;
DROP TABLE IF EXISTS standing_orders_records;
COMMIT;
