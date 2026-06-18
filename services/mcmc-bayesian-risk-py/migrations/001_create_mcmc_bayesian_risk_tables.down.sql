-- Rollback: 001_create_mcmc_bayesian_risk_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mcmc_bayesian_risk_updated ON mcmc_bayesian_risk_records;
DROP FUNCTION IF EXISTS update_mcmc_bayesian_risk_timestamp();
DROP FUNCTION IF EXISTS cleanup_mcmc_bayesian_risk_idempotency();
DROP POLICY IF EXISTS mcmc_bayesian_risk_tenant_isolation ON mcmc_bayesian_risk_records;
DROP TABLE IF EXISTS mcmc_bayesian_risk_idempotency;
DROP TABLE IF EXISTS mcmc_bayesian_risk_audit;
DROP TABLE IF EXISTS mcmc_bayesian_risk_records;
COMMIT;
