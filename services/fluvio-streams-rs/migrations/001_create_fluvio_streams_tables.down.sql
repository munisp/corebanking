-- Rollback: 001_create_fluvio_streams_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_fluvio_streams_updated ON fluvio_streams_records;
DROP FUNCTION IF EXISTS update_fluvio_streams_timestamp();
DROP FUNCTION IF EXISTS cleanup_fluvio_streams_idempotency();
DROP POLICY IF EXISTS fluvio_streams_tenant_isolation ON fluvio_streams_records;
DROP TABLE IF EXISTS fluvio_streams_idempotency;
DROP TABLE IF EXISTS fluvio_streams_audit;
DROP TABLE IF EXISTS fluvio_streams_records;
COMMIT;
