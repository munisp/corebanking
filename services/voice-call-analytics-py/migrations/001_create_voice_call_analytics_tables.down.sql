-- Rollback: 001_create_voice_call_analytics_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_voice_call_analytics_updated ON voice_call_analytics_records;
DROP FUNCTION IF EXISTS update_voice_call_analytics_timestamp();
DROP FUNCTION IF EXISTS cleanup_voice_call_analytics_idempotency();
DROP POLICY IF EXISTS voice_call_analytics_tenant_isolation ON voice_call_analytics_records;
DROP TABLE IF EXISTS voice_call_analytics_idempotency;
DROP TABLE IF EXISTS voice_call_analytics_audit;
DROP TABLE IF EXISTS voice_call_analytics_records;
COMMIT;
