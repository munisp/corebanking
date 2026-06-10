-- Rollback: 001_create_contract_test_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_contract_test_updated ON contract_test_records;
DROP FUNCTION IF EXISTS update_contract_test_timestamp();
DROP FUNCTION IF EXISTS cleanup_contract_test_idempotency();
DROP POLICY IF EXISTS contract_test_tenant_isolation ON contract_test_records;
DROP TABLE IF EXISTS contract_test_idempotency;
DROP TABLE IF EXISTS contract_test_audit;
DROP TABLE IF EXISTS contract_test_records;
COMMIT;
