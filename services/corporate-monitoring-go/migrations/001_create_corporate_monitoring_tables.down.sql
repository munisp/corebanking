-- Rollback: 001_create_corporate_monitoring_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_corporate_monitoring_updated ON corporate_monitoring_records;
DROP FUNCTION IF EXISTS update_corporate_monitoring_timestamp();
DROP FUNCTION IF EXISTS cleanup_corporate_monitoring_idempotency();
DROP POLICY IF EXISTS corporate_monitoring_tenant_isolation ON corporate_monitoring_records;
DROP TABLE IF EXISTS corporate_monitoring_idempotency;
DROP TABLE IF EXISTS corporate_monitoring_audit;
DROP TABLE IF EXISTS corporate_monitoring_records;
COMMIT;
