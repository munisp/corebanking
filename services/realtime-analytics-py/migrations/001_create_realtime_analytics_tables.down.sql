-- Rollback: 001_create_realtime_analytics_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_realtime_analytics_updated ON realtime_analytics_records;
DROP FUNCTION IF EXISTS update_realtime_analytics_timestamp();
DROP FUNCTION IF EXISTS cleanup_realtime_analytics_idempotency();
DROP POLICY IF EXISTS realtime_analytics_tenant_isolation ON realtime_analytics_records;
DROP TABLE IF EXISTS realtime_analytics_idempotency;
DROP TABLE IF EXISTS realtime_analytics_audit;
DROP TABLE IF EXISTS realtime_analytics_records;
COMMIT;
