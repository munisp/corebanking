-- Rollback: 001_create_feature_entitlement_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_feature_entitlement_updated ON feature_entitlement_records;
DROP FUNCTION IF EXISTS update_feature_entitlement_timestamp();
DROP FUNCTION IF EXISTS cleanup_feature_entitlement_idempotency();
DROP POLICY IF EXISTS feature_entitlement_tenant_isolation ON feature_entitlement_records;
DROP TABLE IF EXISTS feature_entitlement_idempotency;
DROP TABLE IF EXISTS feature_entitlement_audit;
DROP TABLE IF EXISTS feature_entitlement_records;
COMMIT;
