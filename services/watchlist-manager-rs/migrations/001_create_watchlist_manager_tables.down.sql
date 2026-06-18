-- Rollback: 001_create_watchlist_manager_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_watchlist_manager_updated ON watchlist_manager_records;
DROP FUNCTION IF EXISTS update_watchlist_manager_timestamp();
DROP FUNCTION IF EXISTS cleanup_watchlist_manager_idempotency();
DROP POLICY IF EXISTS watchlist_manager_tenant_isolation ON watchlist_manager_records;
DROP TABLE IF EXISTS watchlist_manager_idempotency;
DROP TABLE IF EXISTS watchlist_manager_audit;
DROP TABLE IF EXISTS watchlist_manager_records;
COMMIT;
