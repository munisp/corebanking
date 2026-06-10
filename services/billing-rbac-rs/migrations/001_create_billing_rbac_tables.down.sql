-- Rollback: 001_create_billing_rbac_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_billing_rbac_updated ON billing_rbac_records;
DROP FUNCTION IF EXISTS update_billing_rbac_timestamp();
DROP FUNCTION IF EXISTS cleanup_billing_rbac_idempotency();
DROP POLICY IF EXISTS billing_rbac_tenant_isolation ON billing_rbac_records;
DROP TABLE IF EXISTS billing_rbac_idempotency;
DROP TABLE IF EXISTS billing_rbac_audit;
DROP TABLE IF EXISTS billing_rbac_records;
COMMIT;
