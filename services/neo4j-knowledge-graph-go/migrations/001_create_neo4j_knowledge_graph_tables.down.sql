-- Rollback: 001_create_neo4j_knowledge_graph_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_neo4j_knowledge_graph_updated ON neo4j_knowledge_graph_records;
DROP FUNCTION IF EXISTS update_neo4j_knowledge_graph_timestamp();
DROP FUNCTION IF EXISTS cleanup_neo4j_knowledge_graph_idempotency();
DROP POLICY IF EXISTS neo4j_knowledge_graph_tenant_isolation ON neo4j_knowledge_graph_records;
DROP TABLE IF EXISTS neo4j_knowledge_graph_idempotency;
DROP TABLE IF EXISTS neo4j_knowledge_graph_audit;
DROP TABLE IF EXISTS neo4j_knowledge_graph_records;
COMMIT;
