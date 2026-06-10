-- Migration: 001_create_keepalive_tuner_tables
-- Service: keepalive-tuner-rs
-- Created: 2026-06-09
-- Description: Initial schema for keepalive-tuner-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS keepalive_tuner_records (
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
CREATE TABLE IF NOT EXISTS keepalive_tuner_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES keepalive_tuner_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS keepalive_tuner_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_keepalive_tuner_tenant ON keepalive_tuner_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_keepalive_tuner_status ON keepalive_tuner_records(status);
CREATE INDEX IF NOT EXISTS idx_keepalive_tuner_type ON keepalive_tuner_records(type);
CREATE INDEX IF NOT EXISTS idx_keepalive_tuner_created ON keepalive_tuner_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keepalive_tuner_reference ON keepalive_tuner_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_keepalive_tuner_audit_record ON keepalive_tuner_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_keepalive_tuner_audit_created ON keepalive_tuner_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keepalive_tuner_idempotency_expires ON keepalive_tuner_idempotency(expires_at);

-- Row-level security
ALTER TABLE keepalive_tuner_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY keepalive_tuner_tenant_isolation ON keepalive_tuner_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_keepalive_tuner_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_keepalive_tuner_updated
    BEFORE UPDATE ON keepalive_tuner_records
    FOR EACH ROW EXECUTE FUNCTION update_keepalive_tuner_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_keepalive_tuner_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM keepalive_tuner_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
