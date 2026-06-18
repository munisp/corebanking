-- Rollback: 001_create_stress_testing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_stress_testing_updated ON stress_testing_records;
DROP FUNCTION IF EXISTS update_stress_testing_timestamp();
DROP FUNCTION IF EXISTS cleanup_stress_testing_idempotency();
DROP POLICY IF EXISTS stress_testing_tenant_isolation ON stress_testing_records;
DROP TABLE IF EXISTS stress_testing_idempotency;
DROP TABLE IF EXISTS stress_testing_audit;
DROP TABLE IF EXISTS stress_testing_records;
COMMIT;
