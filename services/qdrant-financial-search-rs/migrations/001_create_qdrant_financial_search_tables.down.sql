-- Rollback: 001_create_qdrant_financial_search_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_qdrant_financial_search_updated ON qdrant_financial_search_records;
DROP FUNCTION IF EXISTS update_qdrant_financial_search_timestamp();
DROP FUNCTION IF EXISTS cleanup_qdrant_financial_search_idempotency();
DROP POLICY IF EXISTS qdrant_financial_search_tenant_isolation ON qdrant_financial_search_records;
DROP TABLE IF EXISTS qdrant_financial_search_idempotency;
DROP TABLE IF EXISTS qdrant_financial_search_audit;
DROP TABLE IF EXISTS qdrant_financial_search_records;
COMMIT;
