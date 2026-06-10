-- Rollback: 001_create_falkordb_graph_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_falkordb_graph_updated ON falkordb_graph_records;
DROP FUNCTION IF EXISTS update_falkordb_graph_timestamp();
DROP FUNCTION IF EXISTS cleanup_falkordb_graph_idempotency();
DROP POLICY IF EXISTS falkordb_graph_tenant_isolation ON falkordb_graph_records;
DROP TABLE IF EXISTS falkordb_graph_idempotency;
DROP TABLE IF EXISTS falkordb_graph_audit;
DROP TABLE IF EXISTS falkordb_graph_records;
COMMIT;
