-- Rollback: 001_create_realtime_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_realtime_gateway_updated ON realtime_gateway_records;
DROP FUNCTION IF EXISTS update_realtime_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_realtime_gateway_idempotency();
DROP POLICY IF EXISTS realtime_gateway_tenant_isolation ON realtime_gateway_records;
DROP TABLE IF EXISTS realtime_gateway_idempotency;
DROP TABLE IF EXISTS realtime_gateway_audit;
DROP TABLE IF EXISTS realtime_gateway_records;
COMMIT;
