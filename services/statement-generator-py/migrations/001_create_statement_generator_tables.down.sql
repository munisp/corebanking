-- Rollback: 001_create_statement_generator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_statement_generator_updated ON statement_generator_records;
DROP FUNCTION IF EXISTS update_statement_generator_timestamp();
DROP FUNCTION IF EXISTS cleanup_statement_generator_idempotency();
DROP POLICY IF EXISTS statement_generator_tenant_isolation ON statement_generator_records;
DROP TABLE IF EXISTS statement_generator_idempotency;
DROP TABLE IF EXISTS statement_generator_audit;
DROP TABLE IF EXISTS statement_generator_records;
COMMIT;
