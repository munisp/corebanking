-- Migration: 001_create_secrets_rotation_tables
-- Service: secrets-rotation-rs
-- Created: 2026-06-09
-- Description: Initial schema for secrets-rotation-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS secrets_rotation_records (
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
CREATE TABLE IF NOT EXISTS secrets_rotation_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES secrets_rotation_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS secrets_rotation_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_tenant ON secrets_rotation_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_status ON secrets_rotation_records(status);
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_type ON secrets_rotation_records(type);
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_created ON secrets_rotation_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_reference ON secrets_rotation_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_audit_record ON secrets_rotation_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_audit_created ON secrets_rotation_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_idempotency_expires ON secrets_rotation_idempotency(expires_at);

-- Row-level security
ALTER TABLE secrets_rotation_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY secrets_rotation_tenant_isolation ON secrets_rotation_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_secrets_rotation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_secrets_rotation_updated
    BEFORE UPDATE ON secrets_rotation_records
    FOR EACH ROW EXECUTE FUNCTION update_secrets_rotation_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_secrets_rotation_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM secrets_rotation_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
