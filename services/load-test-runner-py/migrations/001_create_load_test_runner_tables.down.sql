-- Rollback: 001_create_load_test_runner_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_load_test_runner_updated ON load_test_runner_records;
DROP FUNCTION IF EXISTS update_load_test_runner_timestamp();
DROP FUNCTION IF EXISTS cleanup_load_test_runner_idempotency();
DROP POLICY IF EXISTS load_test_runner_tenant_isolation ON load_test_runner_records;
DROP TABLE IF EXISTS load_test_runner_idempotency;
DROP TABLE IF EXISTS load_test_runner_audit;
DROP TABLE IF EXISTS load_test_runner_records;
COMMIT;
