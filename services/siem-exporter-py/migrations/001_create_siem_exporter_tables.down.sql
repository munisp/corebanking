-- Rollback: 001_create_siem_exporter_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_siem_exporter_updated ON siem_exporter_records;
DROP FUNCTION IF EXISTS update_siem_exporter_timestamp();
DROP FUNCTION IF EXISTS cleanup_siem_exporter_idempotency();
DROP POLICY IF EXISTS siem_exporter_tenant_isolation ON siem_exporter_records;
DROP TABLE IF EXISTS siem_exporter_idempotency;
DROP TABLE IF EXISTS siem_exporter_audit;
DROP TABLE IF EXISTS siem_exporter_records;
COMMIT;
