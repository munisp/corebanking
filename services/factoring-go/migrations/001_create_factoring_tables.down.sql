-- Rollback: 001_create_factoring_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_factoring_updated ON factoring_records;
DROP FUNCTION IF EXISTS update_factoring_timestamp();
DROP FUNCTION IF EXISTS cleanup_factoring_idempotency();
DROP POLICY IF EXISTS factoring_tenant_isolation ON factoring_records;
DROP TABLE IF EXISTS factoring_idempotency;
DROP TABLE IF EXISTS factoring_audit;
DROP TABLE IF EXISTS factoring_records;
COMMIT;
