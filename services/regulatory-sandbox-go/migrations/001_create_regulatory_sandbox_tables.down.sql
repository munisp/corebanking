-- Rollback: 001_create_regulatory_sandbox_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_regulatory_sandbox_updated ON regulatory_sandbox_records;
DROP FUNCTION IF EXISTS update_regulatory_sandbox_timestamp();
DROP FUNCTION IF EXISTS cleanup_regulatory_sandbox_idempotency();
DROP POLICY IF EXISTS regulatory_sandbox_tenant_isolation ON regulatory_sandbox_records;
DROP TABLE IF EXISTS regulatory_sandbox_idempotency;
DROP TABLE IF EXISTS regulatory_sandbox_audit;
DROP TABLE IF EXISTS regulatory_sandbox_records;
COMMIT;
