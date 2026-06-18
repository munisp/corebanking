-- Rollback: 001_create_qdrant_vector_store_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_qdrant_vector_store_updated ON qdrant_vector_store_records;
DROP FUNCTION IF EXISTS update_qdrant_vector_store_timestamp();
DROP FUNCTION IF EXISTS cleanup_qdrant_vector_store_idempotency();
DROP POLICY IF EXISTS qdrant_vector_store_tenant_isolation ON qdrant_vector_store_records;
DROP TABLE IF EXISTS qdrant_vector_store_idempotency;
DROP TABLE IF EXISTS qdrant_vector_store_audit;
DROP TABLE IF EXISTS qdrant_vector_store_records;
COMMIT;
