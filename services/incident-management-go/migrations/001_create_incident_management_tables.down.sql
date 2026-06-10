-- Rollback: 001_create_incident_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_incident_management_updated ON incident_management_records;
DROP FUNCTION IF EXISTS update_incident_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_incident_management_idempotency();
DROP POLICY IF EXISTS incident_management_tenant_isolation ON incident_management_records;
DROP TABLE IF EXISTS incident_management_idempotency;
DROP TABLE IF EXISTS incident_management_audit;
DROP TABLE IF EXISTS incident_management_records;
COMMIT;
