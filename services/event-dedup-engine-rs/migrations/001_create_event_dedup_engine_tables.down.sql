-- Rollback: 001_create_event_dedup_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_event_dedup_engine_updated ON event_dedup_engine_records;
DROP FUNCTION IF EXISTS update_event_dedup_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_event_dedup_engine_idempotency();
DROP POLICY IF EXISTS event_dedup_engine_tenant_isolation ON event_dedup_engine_records;
DROP TABLE IF EXISTS event_dedup_engine_idempotency;
DROP TABLE IF EXISTS event_dedup_engine_audit;
DROP TABLE IF EXISTS event_dedup_engine_records;
COMMIT;
