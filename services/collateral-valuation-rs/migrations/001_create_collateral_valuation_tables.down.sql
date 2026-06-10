-- Rollback: 001_create_collateral_valuation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_collateral_valuation_updated ON collateral_valuation_records;
DROP FUNCTION IF EXISTS update_collateral_valuation_timestamp();
DROP FUNCTION IF EXISTS cleanup_collateral_valuation_idempotency();
DROP POLICY IF EXISTS collateral_valuation_tenant_isolation ON collateral_valuation_records;
DROP TABLE IF EXISTS collateral_valuation_idempotency;
DROP TABLE IF EXISTS collateral_valuation_audit;
DROP TABLE IF EXISTS collateral_valuation_records;
COMMIT;
