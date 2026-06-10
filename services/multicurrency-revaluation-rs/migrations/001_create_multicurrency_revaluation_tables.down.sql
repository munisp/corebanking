-- Rollback: 001_create_multicurrency_revaluation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_multicurrency_revaluation_updated ON multicurrency_revaluation_records;
DROP FUNCTION IF EXISTS update_multicurrency_revaluation_timestamp();
DROP FUNCTION IF EXISTS cleanup_multicurrency_revaluation_idempotency();
DROP POLICY IF EXISTS multicurrency_revaluation_tenant_isolation ON multicurrency_revaluation_records;
DROP TABLE IF EXISTS multicurrency_revaluation_idempotency;
DROP TABLE IF EXISTS multicurrency_revaluation_audit;
DROP TABLE IF EXISTS multicurrency_revaluation_records;
COMMIT;
