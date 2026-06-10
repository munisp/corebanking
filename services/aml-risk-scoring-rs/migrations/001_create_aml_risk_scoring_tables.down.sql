-- Rollback: 001_create_aml_risk_scoring_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_aml_risk_scoring_updated ON aml_risk_scoring_records;
DROP FUNCTION IF EXISTS update_aml_risk_scoring_timestamp();
DROP FUNCTION IF EXISTS cleanup_aml_risk_scoring_idempotency();
DROP POLICY IF EXISTS aml_risk_scoring_tenant_isolation ON aml_risk_scoring_records;
DROP TABLE IF EXISTS aml_risk_scoring_idempotency;
DROP TABLE IF EXISTS aml_risk_scoring_audit;
DROP TABLE IF EXISTS aml_risk_scoring_records;
COMMIT;
