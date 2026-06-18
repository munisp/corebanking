-- Rollback: 001_create_graduated_rollout_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_graduated_rollout_updated ON graduated_rollout_records;
DROP FUNCTION IF EXISTS update_graduated_rollout_timestamp();
DROP FUNCTION IF EXISTS cleanup_graduated_rollout_idempotency();
DROP POLICY IF EXISTS graduated_rollout_tenant_isolation ON graduated_rollout_records;
DROP TABLE IF EXISTS graduated_rollout_idempotency;
DROP TABLE IF EXISTS graduated_rollout_audit;
DROP TABLE IF EXISTS graduated_rollout_records;
COMMIT;
