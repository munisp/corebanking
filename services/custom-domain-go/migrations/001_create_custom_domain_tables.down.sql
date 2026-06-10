-- Rollback: 001_create_custom_domain_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_custom_domain_updated ON custom_domain_records;
DROP FUNCTION IF EXISTS update_custom_domain_timestamp();
DROP FUNCTION IF EXISTS cleanup_custom_domain_idempotency();
DROP POLICY IF EXISTS custom_domain_tenant_isolation ON custom_domain_records;
DROP TABLE IF EXISTS custom_domain_idempotency;
DROP TABLE IF EXISTS custom_domain_audit;
DROP TABLE IF EXISTS custom_domain_records;
COMMIT;
