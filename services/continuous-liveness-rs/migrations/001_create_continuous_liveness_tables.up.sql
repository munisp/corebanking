-- Migration: 001_create_continuous_liveness_tables
-- Service: continuous-liveness-rs
-- Created: 2026-06-09
-- Description: Initial schema for continuous-liveness-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS continuous_liveness_records (
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
CREATE TABLE IF NOT EXISTS continuous_liveness_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES continuous_liveness_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS continuous_liveness_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_continuous_liveness_tenant ON continuous_liveness_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_continuous_liveness_status ON continuous_liveness_records(status);
CREATE INDEX IF NOT EXISTS idx_continuous_liveness_type ON continuous_liveness_records(type);
CREATE INDEX IF NOT EXISTS idx_continuous_liveness_created ON continuous_liveness_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_continuous_liveness_reference ON continuous_liveness_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_continuous_liveness_audit_record ON continuous_liveness_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_continuous_liveness_audit_created ON continuous_liveness_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_continuous_liveness_idempotency_expires ON continuous_liveness_idempotency(expires_at);

-- Row-level security
ALTER TABLE continuous_liveness_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY continuous_liveness_tenant_isolation ON continuous_liveness_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_continuous_liveness_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_continuous_liveness_updated
    BEFORE UPDATE ON continuous_liveness_records
    FOR EACH ROW EXECUTE FUNCTION update_continuous_liveness_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_continuous_liveness_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM continuous_liveness_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
