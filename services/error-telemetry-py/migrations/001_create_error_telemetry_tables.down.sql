-- Rollback: 001_create_error_telemetry_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_error_telemetry_updated ON error_telemetry_records;
DROP FUNCTION IF EXISTS update_error_telemetry_timestamp();
DROP FUNCTION IF EXISTS cleanup_error_telemetry_idempotency();
DROP POLICY IF EXISTS error_telemetry_tenant_isolation ON error_telemetry_records;
DROP TABLE IF EXISTS error_telemetry_idempotency;
DROP TABLE IF EXISTS error_telemetry_audit;
DROP TABLE IF EXISTS error_telemetry_records;
COMMIT;
