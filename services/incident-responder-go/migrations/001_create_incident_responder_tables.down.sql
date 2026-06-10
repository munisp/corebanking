-- Rollback: 001_create_incident_responder_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_incident_responder_updated ON incident_responder_records;
DROP FUNCTION IF EXISTS update_incident_responder_timestamp();
DROP FUNCTION IF EXISTS cleanup_incident_responder_idempotency();
DROP POLICY IF EXISTS incident_responder_tenant_isolation ON incident_responder_records;
DROP TABLE IF EXISTS incident_responder_idempotency;
DROP TABLE IF EXISTS incident_responder_audit;
DROP TABLE IF EXISTS incident_responder_records;
COMMIT;
