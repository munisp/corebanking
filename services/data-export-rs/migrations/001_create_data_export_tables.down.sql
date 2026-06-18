-- Rollback: 001_create_data_export_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_data_export_updated ON data_export_records;
DROP FUNCTION IF EXISTS update_data_export_timestamp();
DROP FUNCTION IF EXISTS cleanup_data_export_idempotency();
DROP POLICY IF EXISTS data_export_tenant_isolation ON data_export_records;
DROP TABLE IF EXISTS data_export_idempotency;
DROP TABLE IF EXISTS data_export_audit;
DROP TABLE IF EXISTS data_export_records;
COMMIT;
