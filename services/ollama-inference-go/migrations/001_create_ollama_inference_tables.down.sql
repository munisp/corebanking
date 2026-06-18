-- Rollback: 001_create_ollama_inference_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ollama_inference_updated ON ollama_inference_records;
DROP FUNCTION IF EXISTS update_ollama_inference_timestamp();
DROP FUNCTION IF EXISTS cleanup_ollama_inference_idempotency();
DROP POLICY IF EXISTS ollama_inference_tenant_isolation ON ollama_inference_records;
DROP TABLE IF EXISTS ollama_inference_idempotency;
DROP TABLE IF EXISTS ollama_inference_audit;
DROP TABLE IF EXISTS ollama_inference_records;
COMMIT;
