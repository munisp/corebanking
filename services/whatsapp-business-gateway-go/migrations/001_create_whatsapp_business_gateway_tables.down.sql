-- Rollback: 001_create_whatsapp_business_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_whatsapp_business_gateway_updated ON whatsapp_business_gateway_records;
DROP FUNCTION IF EXISTS update_whatsapp_business_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_whatsapp_business_gateway_idempotency();
DROP POLICY IF EXISTS whatsapp_business_gateway_tenant_isolation ON whatsapp_business_gateway_records;
DROP TABLE IF EXISTS whatsapp_business_gateway_idempotency;
DROP TABLE IF EXISTS whatsapp_business_gateway_audit;
DROP TABLE IF EXISTS whatsapp_business_gateway_records;
COMMIT;
