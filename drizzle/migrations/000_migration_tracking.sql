-- Migration tracking table
-- Applied automatically by the migration runner
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checksum VARCHAR(64) NOT NULL,
    rolled_back BOOLEAN NOT NULL DEFAULT FALSE,
    rolled_back_at TIMESTAMPTZ,
    execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_migrations_version ON _migrations(version);
CREATE INDEX IF NOT EXISTS idx_migrations_applied ON _migrations(applied_at);
