-- Rollback: 001_create_i18n_service_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_i18n_service_updated ON i18n_service_records;
DROP FUNCTION IF EXISTS update_i18n_service_timestamp();
DROP FUNCTION IF EXISTS cleanup_i18n_service_idempotency();
DROP POLICY IF EXISTS i18n_service_tenant_isolation ON i18n_service_records;
DROP TABLE IF EXISTS i18n_service_idempotency;
DROP TABLE IF EXISTS i18n_service_audit;
DROP TABLE IF EXISTS i18n_service_records;
COMMIT;
