-- Rollback: 001_create_billing_enforcement_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_billing_enforcement_updated ON billing_enforcement_records;
DROP FUNCTION IF EXISTS update_billing_enforcement_timestamp();
DROP FUNCTION IF EXISTS cleanup_billing_enforcement_idempotency();
DROP POLICY IF EXISTS billing_enforcement_tenant_isolation ON billing_enforcement_records;
DROP TABLE IF EXISTS billing_enforcement_idempotency;
DROP TABLE IF EXISTS billing_enforcement_audit;
DROP TABLE IF EXISTS billing_enforcement_records;
COMMIT;
