-- Rollback: 001_create_cooperative_meetings_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cooperative_meetings_updated ON cooperative_meetings_records;
DROP FUNCTION IF EXISTS update_cooperative_meetings_timestamp();
DROP FUNCTION IF EXISTS cleanup_cooperative_meetings_idempotency();
DROP POLICY IF EXISTS cooperative_meetings_tenant_isolation ON cooperative_meetings_records;
DROP TABLE IF EXISTS cooperative_meetings_idempotency;
DROP TABLE IF EXISTS cooperative_meetings_audit;
DROP TABLE IF EXISTS cooperative_meetings_records;
COMMIT;
