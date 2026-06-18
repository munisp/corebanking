-- Rollback: 001_create_pep_enhanced_dd_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_pep_enhanced_dd_updated ON pep_enhanced_dd_records;
DROP FUNCTION IF EXISTS update_pep_enhanced_dd_timestamp();
DROP FUNCTION IF EXISTS cleanup_pep_enhanced_dd_idempotency();
DROP POLICY IF EXISTS pep_enhanced_dd_tenant_isolation ON pep_enhanced_dd_records;
DROP TABLE IF EXISTS pep_enhanced_dd_idempotency;
DROP TABLE IF EXISTS pep_enhanced_dd_audit;
DROP TABLE IF EXISTS pep_enhanced_dd_records;
COMMIT;
