-- Rollback: 001_create_growth_features_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_growth_features_updated ON growth_features_records;
DROP FUNCTION IF EXISTS update_growth_features_timestamp();
DROP FUNCTION IF EXISTS cleanup_growth_features_idempotency();
DROP POLICY IF EXISTS growth_features_tenant_isolation ON growth_features_records;
DROP TABLE IF EXISTS growth_features_idempotency;
DROP TABLE IF EXISTS growth_features_audit;
DROP TABLE IF EXISTS growth_features_records;
COMMIT;
