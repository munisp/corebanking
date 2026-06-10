-- Rollback: 001_create_banking_domain_integration_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_banking_domain_integration_updated ON banking_domain_integration_records;
DROP FUNCTION IF EXISTS update_banking_domain_integration_timestamp();
DROP FUNCTION IF EXISTS cleanup_banking_domain_integration_idempotency();
DROP POLICY IF EXISTS banking_domain_integration_tenant_isolation ON banking_domain_integration_records;
DROP TABLE IF EXISTS banking_domain_integration_idempotency;
DROP TABLE IF EXISTS banking_domain_integration_audit;
DROP TABLE IF EXISTS banking_domain_integration_records;
COMMIT;
