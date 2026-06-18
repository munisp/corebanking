-- Rollback: 001_create_enaira_cbdc_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_enaira_cbdc_updated ON enaira_cbdc_records;
DROP FUNCTION IF EXISTS update_enaira_cbdc_timestamp();
DROP FUNCTION IF EXISTS cleanup_enaira_cbdc_idempotency();
DROP POLICY IF EXISTS enaira_cbdc_tenant_isolation ON enaira_cbdc_records;
DROP TABLE IF EXISTS enaira_cbdc_idempotency;
DROP TABLE IF EXISTS enaira_cbdc_audit;
DROP TABLE IF EXISTS enaira_cbdc_records;
COMMIT;
