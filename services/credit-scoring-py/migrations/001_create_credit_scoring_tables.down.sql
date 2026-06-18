-- Rollback: 001_create_credit_scoring_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_credit_scoring_updated ON credit_scoring_records;
DROP FUNCTION IF EXISTS update_credit_scoring_timestamp();
DROP FUNCTION IF EXISTS cleanup_credit_scoring_idempotency();
DROP POLICY IF EXISTS credit_scoring_tenant_isolation ON credit_scoring_records;
DROP TABLE IF EXISTS credit_scoring_idempotency;
DROP TABLE IF EXISTS credit_scoring_audit;
DROP TABLE IF EXISTS credit_scoring_records;
COMMIT;
