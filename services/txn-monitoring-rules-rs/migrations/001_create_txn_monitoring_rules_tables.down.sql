-- Rollback: 001_create_txn_monitoring_rules_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_txn_monitoring_rules_updated ON txn_monitoring_rules_records;
DROP FUNCTION IF EXISTS update_txn_monitoring_rules_timestamp();
DROP FUNCTION IF EXISTS cleanup_txn_monitoring_rules_idempotency();
DROP POLICY IF EXISTS txn_monitoring_rules_tenant_isolation ON txn_monitoring_rules_records;
DROP TABLE IF EXISTS txn_monitoring_rules_idempotency;
DROP TABLE IF EXISTS txn_monitoring_rules_audit;
DROP TABLE IF EXISTS txn_monitoring_rules_records;
COMMIT;
