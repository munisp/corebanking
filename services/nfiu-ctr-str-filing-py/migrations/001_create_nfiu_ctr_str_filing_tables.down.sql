-- Rollback: 001_create_nfiu_ctr_str_filing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_nfiu_ctr_str_filing_updated ON nfiu_ctr_str_filing_records;
DROP FUNCTION IF EXISTS update_nfiu_ctr_str_filing_timestamp();
DROP FUNCTION IF EXISTS cleanup_nfiu_ctr_str_filing_idempotency();
DROP POLICY IF EXISTS nfiu_ctr_str_filing_tenant_isolation ON nfiu_ctr_str_filing_records;
DROP TABLE IF EXISTS nfiu_ctr_str_filing_idempotency;
DROP TABLE IF EXISTS nfiu_ctr_str_filing_audit;
DROP TABLE IF EXISTS nfiu_ctr_str_filing_records;
COMMIT;
