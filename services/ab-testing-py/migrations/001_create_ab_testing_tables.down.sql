-- Rollback: 001_create_ab_testing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ab_testing_updated ON ab_testing_records;
DROP FUNCTION IF EXISTS update_ab_testing_timestamp();
DROP FUNCTION IF EXISTS cleanup_ab_testing_idempotency();
DROP POLICY IF EXISTS ab_testing_tenant_isolation ON ab_testing_records;
DROP TABLE IF EXISTS ab_testing_idempotency;
DROP TABLE IF EXISTS ab_testing_audit;
DROP TABLE IF EXISTS ab_testing_records;
COMMIT;
