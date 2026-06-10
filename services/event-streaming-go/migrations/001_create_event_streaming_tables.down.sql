-- Rollback: 001_create_event_streaming_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_event_streaming_updated ON event_streaming_records;
DROP FUNCTION IF EXISTS update_event_streaming_timestamp();
DROP FUNCTION IF EXISTS cleanup_event_streaming_idempotency();
DROP POLICY IF EXISTS event_streaming_tenant_isolation ON event_streaming_records;
DROP TABLE IF EXISTS event_streaming_idempotency;
DROP TABLE IF EXISTS event_streaming_audit;
DROP TABLE IF EXISTS event_streaming_records;
COMMIT;
