-- Rollback: 001_create_apisix_plugin_optimizer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_apisix_plugin_optimizer_updated ON apisix_plugin_optimizer_records;
DROP FUNCTION IF EXISTS update_apisix_plugin_optimizer_timestamp();
DROP FUNCTION IF EXISTS cleanup_apisix_plugin_optimizer_idempotency();
DROP POLICY IF EXISTS apisix_plugin_optimizer_tenant_isolation ON apisix_plugin_optimizer_records;
DROP TABLE IF EXISTS apisix_plugin_optimizer_idempotency;
DROP TABLE IF EXISTS apisix_plugin_optimizer_audit;
DROP TABLE IF EXISTS apisix_plugin_optimizer_records;
COMMIT;
