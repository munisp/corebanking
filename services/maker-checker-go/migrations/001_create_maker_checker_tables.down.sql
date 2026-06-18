-- Rollback: 001_create_maker_checker_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_maker_checker_updated ON maker_checker_records;
DROP FUNCTION IF EXISTS update_maker_checker_timestamp();
DROP FUNCTION IF EXISTS cleanup_maker_checker_idempotency();
DROP POLICY IF EXISTS maker_checker_tenant_isolation ON maker_checker_records;
DROP TABLE IF EXISTS maker_checker_idempotency;
DROP TABLE IF EXISTS maker_checker_audit;
DROP TABLE IF EXISTS maker_checker_records;
COMMIT;
