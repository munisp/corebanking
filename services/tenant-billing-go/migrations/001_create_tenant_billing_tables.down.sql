-- Rollback: 001_create_tenant_billing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tenant_billing_updated ON tenant_billing_records;
DROP FUNCTION IF EXISTS update_tenant_billing_timestamp();
DROP FUNCTION IF EXISTS cleanup_tenant_billing_idempotency();
DROP POLICY IF EXISTS tenant_billing_tenant_isolation ON tenant_billing_records;
DROP TABLE IF EXISTS tenant_billing_idempotency;
DROP TABLE IF EXISTS tenant_billing_audit;
DROP TABLE IF EXISTS tenant_billing_records;
COMMIT;
