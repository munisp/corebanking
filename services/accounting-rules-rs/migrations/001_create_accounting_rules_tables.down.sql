-- Rollback: 001_create_accounting_rules_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_accounting_rules_updated ON accounting_rules_records;
DROP FUNCTION IF EXISTS update_accounting_rules_timestamp();
DROP FUNCTION IF EXISTS cleanup_accounting_rules_idempotency();
DROP POLICY IF EXISTS accounting_rules_tenant_isolation ON accounting_rules_records;
DROP TABLE IF EXISTS accounting_rules_idempotency;
DROP TABLE IF EXISTS accounting_rules_audit;
DROP TABLE IF EXISTS accounting_rules_records;
COMMIT;
