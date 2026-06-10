-- Rollback: 001_create_whatsapp_document_service_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_whatsapp_document_service_updated ON whatsapp_document_service_records;
DROP FUNCTION IF EXISTS update_whatsapp_document_service_timestamp();
DROP FUNCTION IF EXISTS cleanup_whatsapp_document_service_idempotency();
DROP POLICY IF EXISTS whatsapp_document_service_tenant_isolation ON whatsapp_document_service_records;
DROP TABLE IF EXISTS whatsapp_document_service_idempotency;
DROP TABLE IF EXISTS whatsapp_document_service_audit;
DROP TABLE IF EXISTS whatsapp_document_service_records;
COMMIT;
