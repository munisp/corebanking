-- Rollback: 001_create_risk_scoring_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_risk_scoring_updated ON risk_scoring_records;
DROP FUNCTION IF EXISTS update_risk_scoring_timestamp();
DROP FUNCTION IF EXISTS cleanup_risk_scoring_idempotency();
DROP POLICY IF EXISTS risk_scoring_tenant_isolation ON risk_scoring_records;
DROP TABLE IF EXISTS risk_scoring_idempotency;
DROP TABLE IF EXISTS risk_scoring_audit;
DROP TABLE IF EXISTS risk_scoring_records;
COMMIT;
