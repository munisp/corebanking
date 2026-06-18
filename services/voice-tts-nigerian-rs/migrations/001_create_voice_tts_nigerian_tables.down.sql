-- Rollback: 001_create_voice_tts_nigerian_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_voice_tts_nigerian_updated ON voice_tts_nigerian_records;
DROP FUNCTION IF EXISTS update_voice_tts_nigerian_timestamp();
DROP FUNCTION IF EXISTS cleanup_voice_tts_nigerian_idempotency();
DROP POLICY IF EXISTS voice_tts_nigerian_tenant_isolation ON voice_tts_nigerian_records;
DROP TABLE IF EXISTS voice_tts_nigerian_idempotency;
DROP TABLE IF EXISTS voice_tts_nigerian_audit;
DROP TABLE IF EXISTS voice_tts_nigerian_records;
COMMIT;
