-- Rollback: 001_create_openappsec_waf_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_openappsec_waf_updated ON openappsec_waf_records;
DROP FUNCTION IF EXISTS update_openappsec_waf_timestamp();
DROP FUNCTION IF EXISTS cleanup_openappsec_waf_idempotency();
DROP POLICY IF EXISTS openappsec_waf_tenant_isolation ON openappsec_waf_records;
DROP TABLE IF EXISTS openappsec_waf_idempotency;
DROP TABLE IF EXISTS openappsec_waf_audit;
DROP TABLE IF EXISTS openappsec_waf_records;
COMMIT;
