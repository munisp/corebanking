-- Rollback: 001_create_notification_router_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_notification_router_updated ON notification_router_records;
DROP FUNCTION IF EXISTS update_notification_router_timestamp();
DROP FUNCTION IF EXISTS cleanup_notification_router_idempotency();
DROP POLICY IF EXISTS notification_router_tenant_isolation ON notification_router_records;
DROP TABLE IF EXISTS notification_router_idempotency;
DROP TABLE IF EXISTS notification_router_audit;
DROP TABLE IF EXISTS notification_router_records;
COMMIT;
