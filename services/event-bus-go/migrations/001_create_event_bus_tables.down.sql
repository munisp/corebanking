-- Rollback: 001_create_event_bus_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_event_bus_updated ON event_bus_records;
DROP FUNCTION IF EXISTS update_event_bus_timestamp();
DROP FUNCTION IF EXISTS cleanup_event_bus_idempotency();
DROP POLICY IF EXISTS event_bus_tenant_isolation ON event_bus_records;
DROP TABLE IF EXISTS event_bus_idempotency;
DROP TABLE IF EXISTS event_bus_audit;
DROP TABLE IF EXISTS event_bus_records;
COMMIT;
