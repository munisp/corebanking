-- Rollback: 001_create_enaira_cbdc_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_enaira_cbdc_gateway_updated ON enaira_cbdc_gateway_records;
DROP FUNCTION IF EXISTS update_enaira_cbdc_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_enaira_cbdc_gateway_idempotency();
DROP POLICY IF EXISTS enaira_cbdc_gateway_tenant_isolation ON enaira_cbdc_gateway_records;
DROP TABLE IF EXISTS enaira_cbdc_gateway_idempotency;
DROP TABLE IF EXISTS enaira_cbdc_gateway_audit;
DROP TABLE IF EXISTS enaira_cbdc_gateway_records;
COMMIT;
