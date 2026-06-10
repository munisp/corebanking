-- Rollback: 001_create_continuous_liveness_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_continuous_liveness_updated ON continuous_liveness_records;
DROP FUNCTION IF EXISTS update_continuous_liveness_timestamp();
DROP FUNCTION IF EXISTS cleanup_continuous_liveness_idempotency();
DROP POLICY IF EXISTS continuous_liveness_tenant_isolation ON continuous_liveness_records;
DROP TABLE IF EXISTS continuous_liveness_idempotency;
DROP TABLE IF EXISTS continuous_liveness_audit;
DROP TABLE IF EXISTS continuous_liveness_records;
COMMIT;
