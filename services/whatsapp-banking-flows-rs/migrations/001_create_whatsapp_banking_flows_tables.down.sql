-- Rollback: 001_create_whatsapp_banking_flows_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_whatsapp_banking_flows_updated ON whatsapp_banking_flows_records;
DROP FUNCTION IF EXISTS update_whatsapp_banking_flows_timestamp();
DROP FUNCTION IF EXISTS cleanup_whatsapp_banking_flows_idempotency();
DROP POLICY IF EXISTS whatsapp_banking_flows_tenant_isolation ON whatsapp_banking_flows_records;
DROP TABLE IF EXISTS whatsapp_banking_flows_idempotency;
DROP TABLE IF EXISTS whatsapp_banking_flows_audit;
DROP TABLE IF EXISTS whatsapp_banking_flows_records;
COMMIT;
