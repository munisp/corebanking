-- Rollback: 001_create_txn_pattern_analyzer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_txn_pattern_analyzer_updated ON txn_pattern_analyzer_records;
DROP FUNCTION IF EXISTS update_txn_pattern_analyzer_timestamp();
DROP FUNCTION IF EXISTS cleanup_txn_pattern_analyzer_idempotency();
DROP POLICY IF EXISTS txn_pattern_analyzer_tenant_isolation ON txn_pattern_analyzer_records;
DROP TABLE IF EXISTS txn_pattern_analyzer_idempotency;
DROP TABLE IF EXISTS txn_pattern_analyzer_audit;
DROP TABLE IF EXISTS txn_pattern_analyzer_records;
COMMIT;
