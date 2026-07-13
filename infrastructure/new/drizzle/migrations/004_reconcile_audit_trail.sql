-- 004: Reconcile the audit_trail schema.
-- 001_initial_schema.sql creates audit_trail with resource_id/resource_type,
-- while 002_business_logic_fixes.sql (and the application query layer in
-- server/lib) expect entity_id/entity_type/operation/checksum. Because 002 uses
-- CREATE TABLE IF NOT EXISTS, its definition is skipped when 001 already created
-- the table, leaving idx_audit_trail_entity un-created. This forward migration
-- adds the missing columns (non-destructively) and creates the expected index.

ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS entity_id   TEXT;
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS operation   TEXT;
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS service     TEXT;
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS old_state   TEXT DEFAULT '';
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS new_state   TEXT DEFAULT '';
ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS checksum    TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_trail_entity  ON audit_trail (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_actor   ON audit_trail (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_service ON audit_trail (service, created_at DESC);
