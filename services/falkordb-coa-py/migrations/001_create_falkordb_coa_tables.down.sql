-- Rollback: 001_create_falkordb_coa_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_falkordb_coa_updated ON falkordb_coa_records;
DROP FUNCTION IF EXISTS update_falkordb_coa_timestamp();
DROP FUNCTION IF EXISTS cleanup_falkordb_coa_idempotency();
DROP POLICY IF EXISTS falkordb_coa_tenant_isolation ON falkordb_coa_records;
DROP TABLE IF EXISTS falkordb_coa_idempotency;
DROP TABLE IF EXISTS falkordb_coa_audit;
DROP TABLE IF EXISTS falkordb_coa_records;
COMMIT;
