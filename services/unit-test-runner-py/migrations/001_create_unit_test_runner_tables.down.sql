-- Rollback: 001_create_unit_test_runner_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_unit_test_runner_updated ON unit_test_runner_records;
DROP FUNCTION IF EXISTS update_unit_test_runner_timestamp();
DROP FUNCTION IF EXISTS cleanup_unit_test_runner_idempotency();
DROP POLICY IF EXISTS unit_test_runner_tenant_isolation ON unit_test_runner_records;
DROP TABLE IF EXISTS unit_test_runner_idempotency;
DROP TABLE IF EXISTS unit_test_runner_audit;
DROP TABLE IF EXISTS unit_test_runner_records;
COMMIT;
