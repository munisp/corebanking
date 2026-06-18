-- Rollback: 001_create_voice_asr_nigerian_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_voice_asr_nigerian_updated ON voice_asr_nigerian_records;
DROP FUNCTION IF EXISTS update_voice_asr_nigerian_timestamp();
DROP FUNCTION IF EXISTS cleanup_voice_asr_nigerian_idempotency();
DROP POLICY IF EXISTS voice_asr_nigerian_tenant_isolation ON voice_asr_nigerian_records;
DROP TABLE IF EXISTS voice_asr_nigerian_idempotency;
DROP TABLE IF EXISTS voice_asr_nigerian_audit;
DROP TABLE IF EXISTS voice_asr_nigerian_records;
COMMIT;
