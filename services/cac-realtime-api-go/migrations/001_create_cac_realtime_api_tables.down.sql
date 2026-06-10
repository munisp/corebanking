-- Rollback: 001_create_cac_realtime_api_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cac_realtime_api_updated ON cac_realtime_api_records;
DROP FUNCTION IF EXISTS update_cac_realtime_api_timestamp();
DROP FUNCTION IF EXISTS cleanup_cac_realtime_api_idempotency();
DROP POLICY IF EXISTS cac_realtime_api_tenant_isolation ON cac_realtime_api_records;
DROP TABLE IF EXISTS cac_realtime_api_idempotency;
DROP TABLE IF EXISTS cac_realtime_api_audit;
DROP TABLE IF EXISTS cac_realtime_api_records;
COMMIT;
