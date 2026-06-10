-- Rollback: 001_create_waf_rules_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_waf_rules_engine_updated ON waf_rules_engine_records;
DROP FUNCTION IF EXISTS update_waf_rules_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_waf_rules_engine_idempotency();
DROP POLICY IF EXISTS waf_rules_engine_tenant_isolation ON waf_rules_engine_records;
DROP TABLE IF EXISTS waf_rules_engine_idempotency;
DROP TABLE IF EXISTS waf_rules_engine_audit;
DROP TABLE IF EXISTS waf_rules_engine_records;
COMMIT;
