-- Rollback: 001_create_risk_based_approach_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_risk_based_approach_updated ON risk_based_approach_records;
DROP FUNCTION IF EXISTS update_risk_based_approach_timestamp();
DROP FUNCTION IF EXISTS cleanup_risk_based_approach_idempotency();
DROP POLICY IF EXISTS risk_based_approach_tenant_isolation ON risk_based_approach_records;
DROP TABLE IF EXISTS risk_based_approach_idempotency;
DROP TABLE IF EXISTS risk_based_approach_audit;
DROP TABLE IF EXISTS risk_based_approach_records;
COMMIT;
