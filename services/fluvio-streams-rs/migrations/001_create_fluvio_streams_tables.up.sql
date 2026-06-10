-- Migration: 001_create_fluvio_streams_tables
-- Service: fluvio-streams-rs
-- Created: 2026-06-09
-- Description: Initial schema for fluvio-streams-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS fluvio_streams_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'primary',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    data JSONB NOT NULL DEFAULT '{}',
    amount_kobo BIGINT DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    reference VARCHAR(128) UNIQUE,
    created_by VARCHAR(128),
    updated_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1
);

-- Audit trail table
CREATE TABLE IF NOT EXISTS fluvio_streams_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES fluvio_streams_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS fluvio_streams_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fluvio_streams_tenant ON fluvio_streams_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fluvio_streams_status ON fluvio_streams_records(status);
CREATE INDEX IF NOT EXISTS idx_fluvio_streams_type ON fluvio_streams_records(type);
CREATE INDEX IF NOT EXISTS idx_fluvio_streams_created ON fluvio_streams_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fluvio_streams_reference ON fluvio_streams_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fluvio_streams_audit_record ON fluvio_streams_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_fluvio_streams_audit_created ON fluvio_streams_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fluvio_streams_idempotency_expires ON fluvio_streams_idempotency(expires_at);

-- Row-level security
ALTER TABLE fluvio_streams_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY fluvio_streams_tenant_isolation ON fluvio_streams_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_fluvio_streams_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fluvio_streams_updated
    BEFORE UPDATE ON fluvio_streams_records
    FOR EACH ROW EXECUTE FUNCTION update_fluvio_streams_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_fluvio_streams_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM fluvio_streams_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
