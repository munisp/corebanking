-- Rollback: 001_create_fixed_assets_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_fixed_assets_updated ON fixed_assets_records;
DROP FUNCTION IF EXISTS update_fixed_assets_timestamp();
DROP FUNCTION IF EXISTS cleanup_fixed_assets_idempotency();
DROP POLICY IF EXISTS fixed_assets_tenant_isolation ON fixed_assets_records;
DROP TABLE IF EXISTS fixed_assets_idempotency;
DROP TABLE IF EXISTS fixed_assets_audit;
DROP TABLE IF EXISTS fixed_assets_records;
COMMIT;
