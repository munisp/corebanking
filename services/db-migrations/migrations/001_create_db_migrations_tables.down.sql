-- Rollback: 001_create_db_migrations_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_db_migrations_updated ON db_migrations_records;
DROP FUNCTION IF EXISTS update_db_migrations_timestamp();
DROP FUNCTION IF EXISTS cleanup_db_migrations_idempotency();
DROP POLICY IF EXISTS db_migrations_tenant_isolation ON db_migrations_records;
DROP TABLE IF EXISTS db_migrations_idempotency;
DROP TABLE IF EXISTS db_migrations_audit;
DROP TABLE IF EXISTS db_migrations_records;
COMMIT;
