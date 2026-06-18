-- Rollback: 001_create_cooperative_credit_scoring_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cooperative_credit_scoring_updated ON cooperative_credit_scoring_records;
DROP FUNCTION IF EXISTS update_cooperative_credit_scoring_timestamp();
DROP FUNCTION IF EXISTS cleanup_cooperative_credit_scoring_idempotency();
DROP POLICY IF EXISTS cooperative_credit_scoring_tenant_isolation ON cooperative_credit_scoring_records;
DROP TABLE IF EXISTS cooperative_credit_scoring_idempotency;
DROP TABLE IF EXISTS cooperative_credit_scoring_audit;
DROP TABLE IF EXISTS cooperative_credit_scoring_records;
COMMIT;
