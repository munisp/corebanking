-- Rollback: 001_create_event_sourcing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_event_sourcing_updated ON event_sourcing_records;
DROP FUNCTION IF EXISTS update_event_sourcing_timestamp();
DROP FUNCTION IF EXISTS cleanup_event_sourcing_idempotency();
DROP POLICY IF EXISTS event_sourcing_tenant_isolation ON event_sourcing_records;
DROP TABLE IF EXISTS event_sourcing_idempotency;
DROP TABLE IF EXISTS event_sourcing_audit;
DROP TABLE IF EXISTS event_sourcing_records;
COMMIT;
