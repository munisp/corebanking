-- Rollback: 001_create_otel_collector_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_otel_collector_updated ON otel_collector_records;
DROP FUNCTION IF EXISTS update_otel_collector_timestamp();
DROP FUNCTION IF EXISTS cleanup_otel_collector_idempotency();
DROP POLICY IF EXISTS otel_collector_tenant_isolation ON otel_collector_records;
DROP TABLE IF EXISTS otel_collector_idempotency;
DROP TABLE IF EXISTS otel_collector_audit;
DROP TABLE IF EXISTS otel_collector_records;
COMMIT;
