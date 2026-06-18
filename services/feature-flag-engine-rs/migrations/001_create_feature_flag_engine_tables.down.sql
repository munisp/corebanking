-- Rollback: 001_create_feature_flag_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_feature_flag_engine_updated ON feature_flag_engine_records;
DROP FUNCTION IF EXISTS update_feature_flag_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_feature_flag_engine_idempotency();
DROP POLICY IF EXISTS feature_flag_engine_tenant_isolation ON feature_flag_engine_records;
DROP TABLE IF EXISTS feature_flag_engine_idempotency;
DROP TABLE IF EXISTS feature_flag_engine_audit;
DROP TABLE IF EXISTS feature_flag_engine_records;
COMMIT;
