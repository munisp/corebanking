-- Rollback: 001_create_falkordb_graph_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_falkordb_graph_engine_updated ON falkordb_graph_engine_records;
DROP FUNCTION IF EXISTS update_falkordb_graph_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_falkordb_graph_engine_idempotency();
DROP POLICY IF EXISTS falkordb_graph_engine_tenant_isolation ON falkordb_graph_engine_records;
DROP TABLE IF EXISTS falkordb_graph_engine_idempotency;
DROP TABLE IF EXISTS falkordb_graph_engine_audit;
DROP TABLE IF EXISTS falkordb_graph_engine_records;
COMMIT;
