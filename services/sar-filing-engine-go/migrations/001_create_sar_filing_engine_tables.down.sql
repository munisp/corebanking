-- Rollback: 001_create_sar_filing_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_sar_filing_engine_updated ON sar_filing_engine_records;
DROP FUNCTION IF EXISTS update_sar_filing_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_sar_filing_engine_idempotency();
DROP POLICY IF EXISTS sar_filing_engine_tenant_isolation ON sar_filing_engine_records;
DROP TABLE IF EXISTS sar_filing_engine_idempotency;
DROP TABLE IF EXISTS sar_filing_engine_audit;
DROP TABLE IF EXISTS sar_filing_engine_records;
COMMIT;
