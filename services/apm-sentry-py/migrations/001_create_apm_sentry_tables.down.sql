-- Rollback: 001_create_apm_sentry_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_apm_sentry_updated ON apm_sentry_records;
DROP FUNCTION IF EXISTS update_apm_sentry_timestamp();
DROP FUNCTION IF EXISTS cleanup_apm_sentry_idempotency();
DROP POLICY IF EXISTS apm_sentry_tenant_isolation ON apm_sentry_records;
DROP TABLE IF EXISTS apm_sentry_idempotency;
DROP TABLE IF EXISTS apm_sentry_audit;
DROP TABLE IF EXISTS apm_sentry_records;
COMMIT;
