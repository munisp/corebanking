-- Rollback: 001_create_realtime_pricing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_realtime_pricing_updated ON realtime_pricing_records;
DROP FUNCTION IF EXISTS update_realtime_pricing_timestamp();
DROP FUNCTION IF EXISTS cleanup_realtime_pricing_idempotency();
DROP POLICY IF EXISTS realtime_pricing_tenant_isolation ON realtime_pricing_records;
DROP TABLE IF EXISTS realtime_pricing_idempotency;
DROP TABLE IF EXISTS realtime_pricing_audit;
DROP TABLE IF EXISTS realtime_pricing_records;
COMMIT;
