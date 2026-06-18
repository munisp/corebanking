-- Rollback: 001_create_changelog_generator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_changelog_generator_updated ON changelog_generator_records;
DROP FUNCTION IF EXISTS update_changelog_generator_timestamp();
DROP FUNCTION IF EXISTS cleanup_changelog_generator_idempotency();
DROP POLICY IF EXISTS changelog_generator_tenant_isolation ON changelog_generator_records;
DROP TABLE IF EXISTS changelog_generator_idempotency;
DROP TABLE IF EXISTS changelog_generator_audit;
DROP TABLE IF EXISTS changelog_generator_records;
COMMIT;
