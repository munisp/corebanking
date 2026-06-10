-- Rollback: 001_create_supply_chain_finance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_supply_chain_finance_updated ON supply_chain_finance_records;
DROP FUNCTION IF EXISTS update_supply_chain_finance_timestamp();
DROP FUNCTION IF EXISTS cleanup_supply_chain_finance_idempotency();
DROP POLICY IF EXISTS supply_chain_finance_tenant_isolation ON supply_chain_finance_records;
DROP TABLE IF EXISTS supply_chain_finance_idempotency;
DROP TABLE IF EXISTS supply_chain_finance_audit;
DROP TABLE IF EXISTS supply_chain_finance_records;
COMMIT;
