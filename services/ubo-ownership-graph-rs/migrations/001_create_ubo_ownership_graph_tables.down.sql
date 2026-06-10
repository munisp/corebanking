-- Rollback: 001_create_ubo_ownership_graph_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ubo_ownership_graph_updated ON ubo_ownership_graph_records;
DROP FUNCTION IF EXISTS update_ubo_ownership_graph_timestamp();
DROP FUNCTION IF EXISTS cleanup_ubo_ownership_graph_idempotency();
DROP POLICY IF EXISTS ubo_ownership_graph_tenant_isolation ON ubo_ownership_graph_records;
DROP TABLE IF EXISTS ubo_ownership_graph_idempotency;
DROP TABLE IF EXISTS ubo_ownership_graph_audit;
DROP TABLE IF EXISTS ubo_ownership_graph_records;
COMMIT;
