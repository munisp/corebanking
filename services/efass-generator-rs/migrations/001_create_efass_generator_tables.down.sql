-- Rollback: 001_create_efass_generator_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_efass_generator_updated ON efass_generator_records;
DROP FUNCTION IF EXISTS update_efass_generator_timestamp();
DROP FUNCTION IF EXISTS cleanup_efass_generator_idempotency();
DROP POLICY IF EXISTS efass_generator_tenant_isolation ON efass_generator_records;
DROP TABLE IF EXISTS efass_generator_idempotency;
DROP TABLE IF EXISTS efass_generator_audit;
DROP TABLE IF EXISTS efass_generator_records;
COMMIT;
