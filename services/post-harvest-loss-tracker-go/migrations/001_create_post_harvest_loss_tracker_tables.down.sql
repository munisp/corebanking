-- Rollback: 001_create_post_harvest_loss_tracker_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_post_harvest_loss_tracker_updated ON post_harvest_loss_tracker_records;
DROP FUNCTION IF EXISTS update_post_harvest_loss_tracker_timestamp();
DROP FUNCTION IF EXISTS cleanup_post_harvest_loss_tracker_idempotency();
DROP POLICY IF EXISTS post_harvest_loss_tracker_tenant_isolation ON post_harvest_loss_tracker_records;
DROP TABLE IF EXISTS post_harvest_loss_tracker_idempotency;
DROP TABLE IF EXISTS post_harvest_loss_tracker_audit;
DROP TABLE IF EXISTS post_harvest_loss_tracker_records;
COMMIT;
