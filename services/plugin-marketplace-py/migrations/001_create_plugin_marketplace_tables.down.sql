-- Rollback: 001_create_plugin_marketplace_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_plugin_marketplace_updated ON plugin_marketplace_records;
DROP FUNCTION IF EXISTS update_plugin_marketplace_timestamp();
DROP FUNCTION IF EXISTS cleanup_plugin_marketplace_idempotency();
DROP POLICY IF EXISTS plugin_marketplace_tenant_isolation ON plugin_marketplace_records;
DROP TABLE IF EXISTS plugin_marketplace_idempotency;
DROP TABLE IF EXISTS plugin_marketplace_audit;
DROP TABLE IF EXISTS plugin_marketplace_records;
COMMIT;
