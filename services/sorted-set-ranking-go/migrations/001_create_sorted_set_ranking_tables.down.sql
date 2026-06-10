-- Rollback: 001_create_sorted_set_ranking_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_sorted_set_ranking_updated ON sorted_set_ranking_records;
DROP FUNCTION IF EXISTS update_sorted_set_ranking_timestamp();
DROP FUNCTION IF EXISTS cleanup_sorted_set_ranking_idempotency();
DROP POLICY IF EXISTS sorted_set_ranking_tenant_isolation ON sorted_set_ranking_records;
DROP TABLE IF EXISTS sorted_set_ranking_idempotency;
DROP TABLE IF EXISTS sorted_set_ranking_audit;
DROP TABLE IF EXISTS sorted_set_ranking_records;
COMMIT;
