-- Rollback: 001_create_certificate_manager_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_certificate_manager_updated ON certificate_manager_records;
DROP FUNCTION IF EXISTS update_certificate_manager_timestamp();
DROP FUNCTION IF EXISTS cleanup_certificate_manager_idempotency();
DROP POLICY IF EXISTS certificate_manager_tenant_isolation ON certificate_manager_records;
DROP TABLE IF EXISTS certificate_manager_idempotency;
DROP TABLE IF EXISTS certificate_manager_audit;
DROP TABLE IF EXISTS certificate_manager_records;
COMMIT;
