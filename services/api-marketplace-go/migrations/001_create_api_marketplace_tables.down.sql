-- Rollback: 001_create_api_marketplace_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_api_marketplace_updated ON api_marketplace_records;
DROP FUNCTION IF EXISTS update_api_marketplace_timestamp();
DROP FUNCTION IF EXISTS cleanup_api_marketplace_idempotency();
DROP POLICY IF EXISTS api_marketplace_tenant_isolation ON api_marketplace_records;
DROP TABLE IF EXISTS api_marketplace_idempotency;
DROP TABLE IF EXISTS api_marketplace_audit;
DROP TABLE IF EXISTS api_marketplace_records;
COMMIT;
