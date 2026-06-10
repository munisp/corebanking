-- Rollback: 001_create_cooperative_financials_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cooperative_financials_updated ON cooperative_financials_records;
DROP FUNCTION IF EXISTS update_cooperative_financials_timestamp();
DROP FUNCTION IF EXISTS cleanup_cooperative_financials_idempotency();
DROP POLICY IF EXISTS cooperative_financials_tenant_isolation ON cooperative_financials_records;
DROP TABLE IF EXISTS cooperative_financials_idempotency;
DROP TABLE IF EXISTS cooperative_financials_audit;
DROP TABLE IF EXISTS cooperative_financials_records;
COMMIT;
