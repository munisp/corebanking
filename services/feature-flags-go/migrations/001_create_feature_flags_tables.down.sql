-- Rollback: 001_create_feature_flags_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_feature_flags_updated ON feature_flags_records;
DROP FUNCTION IF EXISTS update_feature_flags_timestamp();
DROP FUNCTION IF EXISTS cleanup_feature_flags_idempotency();
DROP POLICY IF EXISTS feature_flags_tenant_isolation ON feature_flags_records;
DROP TABLE IF EXISTS feature_flags_idempotency;
DROP TABLE IF EXISTS feature_flags_audit;
DROP TABLE IF EXISTS feature_flags_records;
COMMIT;
