-- Rollback: 001_create_event_correlator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_event_correlator_updated ON event_correlator_records;
DROP FUNCTION IF EXISTS update_event_correlator_timestamp();
DROP FUNCTION IF EXISTS cleanup_event_correlator_idempotency();
DROP POLICY IF EXISTS event_correlator_tenant_isolation ON event_correlator_records;
DROP TABLE IF EXISTS event_correlator_idempotency;
DROP TABLE IF EXISTS event_correlator_audit;
DROP TABLE IF EXISTS event_correlator_records;
COMMIT;
