-- Rollback: 001_create_document_intelligence_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_document_intelligence_updated ON document_intelligence_records;
DROP FUNCTION IF EXISTS update_document_intelligence_timestamp();
DROP FUNCTION IF EXISTS cleanup_document_intelligence_idempotency();
DROP POLICY IF EXISTS document_intelligence_tenant_isolation ON document_intelligence_records;
DROP TABLE IF EXISTS document_intelligence_idempotency;
DROP TABLE IF EXISTS document_intelligence_audit;
DROP TABLE IF EXISTS document_intelligence_records;
COMMIT;
