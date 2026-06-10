-- Rollback: 001_create_fraudfusion_ensemble_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_fraudfusion_ensemble_updated ON fraudfusion_ensemble_records;
DROP FUNCTION IF EXISTS update_fraudfusion_ensemble_timestamp();
DROP FUNCTION IF EXISTS cleanup_fraudfusion_ensemble_idempotency();
DROP POLICY IF EXISTS fraudfusion_ensemble_tenant_isolation ON fraudfusion_ensemble_records;
DROP TABLE IF EXISTS fraudfusion_ensemble_idempotency;
DROP TABLE IF EXISTS fraudfusion_ensemble_audit;
DROP TABLE IF EXISTS fraudfusion_ensemble_records;
COMMIT;
