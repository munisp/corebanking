-- 004 rollback: drop the reconciliation index and added columns.
DROP INDEX IF EXISTS idx_audit_trail_entity;
DROP INDEX IF EXISTS idx_audit_trail_actor;
DROP INDEX IF EXISTS idx_audit_trail_service;
ALTER TABLE audit_trail DROP COLUMN IF EXISTS entity_id;
ALTER TABLE audit_trail DROP COLUMN IF EXISTS entity_type;
ALTER TABLE audit_trail DROP COLUMN IF EXISTS operation;
ALTER TABLE audit_trail DROP COLUMN IF EXISTS service;
ALTER TABLE audit_trail DROP COLUMN IF EXISTS old_state;
ALTER TABLE audit_trail DROP COLUMN IF EXISTS new_state;
ALTER TABLE audit_trail DROP COLUMN IF EXISTS checksum;
