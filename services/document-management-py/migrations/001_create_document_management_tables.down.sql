-- Rollback: 001_create_document_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_document_management_updated ON document_management_records;
DROP FUNCTION IF EXISTS update_document_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_document_management_idempotency();
DROP POLICY IF EXISTS document_management_tenant_isolation ON document_management_records;
DROP TABLE IF EXISTS document_management_idempotency;
DROP TABLE IF EXISTS document_management_audit;
DROP TABLE IF EXISTS document_management_records;
COMMIT;
