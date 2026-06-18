-- Rollback: 001_create_dapr_sidecar_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_dapr_sidecar_updated ON dapr_sidecar_records;
DROP FUNCTION IF EXISTS update_dapr_sidecar_timestamp();
DROP FUNCTION IF EXISTS cleanup_dapr_sidecar_idempotency();
DROP POLICY IF EXISTS dapr_sidecar_tenant_isolation ON dapr_sidecar_records;
DROP TABLE IF EXISTS dapr_sidecar_idempotency;
DROP TABLE IF EXISTS dapr_sidecar_audit;
DROP TABLE IF EXISTS dapr_sidecar_records;
COMMIT;
