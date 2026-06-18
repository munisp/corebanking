-- Migration: 001_create_event_correlator_tables
-- Service: event-correlator-py
-- Created: 2026-06-09
-- Description: Initial schema for event-correlator-py

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS event_correlator_records (
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
CREATE TABLE IF NOT EXISTS event_correlator_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES event_correlator_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS event_correlator_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_correlator_tenant ON event_correlator_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_correlator_status ON event_correlator_records(status);
CREATE INDEX IF NOT EXISTS idx_event_correlator_type ON event_correlator_records(type);
CREATE INDEX IF NOT EXISTS idx_event_correlator_created ON event_correlator_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_correlator_reference ON event_correlator_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_correlator_audit_record ON event_correlator_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_event_correlator_audit_created ON event_correlator_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_correlator_idempotency_expires ON event_correlator_idempotency(expires_at);

-- Row-level security
ALTER TABLE event_correlator_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_correlator_tenant_isolation ON event_correlator_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_event_correlator_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_correlator_updated
    BEFORE UPDATE ON event_correlator_records
    FOR EACH ROW EXECUTE FUNCTION update_event_correlator_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_event_correlator_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM event_correlator_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
