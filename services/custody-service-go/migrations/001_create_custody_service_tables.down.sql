-- Rollback: 001_create_custody_service_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_custody_service_updated ON custody_service_records;
DROP FUNCTION IF EXISTS update_custody_service_timestamp();
DROP FUNCTION IF EXISTS cleanup_custody_service_idempotency();
DROP POLICY IF EXISTS custody_service_tenant_isolation ON custody_service_records;
DROP TABLE IF EXISTS custody_service_idempotency;
DROP TABLE IF EXISTS custody_service_audit;
DROP TABLE IF EXISTS custody_service_records;
COMMIT;
