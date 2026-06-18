-- Rollback: 001_create_event_store_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_event_store_updated ON event_store_records;
DROP FUNCTION IF EXISTS update_event_store_timestamp();
DROP FUNCTION IF EXISTS cleanup_event_store_idempotency();
DROP POLICY IF EXISTS event_store_tenant_isolation ON event_store_records;
DROP TABLE IF EXISTS event_store_idempotency;
DROP TABLE IF EXISTS event_store_audit;
DROP TABLE IF EXISTS event_store_records;
COMMIT;
