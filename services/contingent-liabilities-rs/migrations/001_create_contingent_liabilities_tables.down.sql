-- Rollback: 001_create_contingent_liabilities_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_contingent_liabilities_updated ON contingent_liabilities_records;
DROP FUNCTION IF EXISTS update_contingent_liabilities_timestamp();
DROP FUNCTION IF EXISTS cleanup_contingent_liabilities_idempotency();
DROP POLICY IF EXISTS contingent_liabilities_tenant_isolation ON contingent_liabilities_records;
DROP TABLE IF EXISTS contingent_liabilities_idempotency;
DROP TABLE IF EXISTS contingent_liabilities_audit;
DROP TABLE IF EXISTS contingent_liabilities_records;
COMMIT;
