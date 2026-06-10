-- Migration: 001_create_branded_comms_tables
-- Service: branded-comms-py
-- Created: 2026-06-09
-- Description: Initial schema for branded-comms-py

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS branded_comms_records (
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
CREATE TABLE IF NOT EXISTS branded_comms_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES branded_comms_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS branded_comms_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_branded_comms_tenant ON branded_comms_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branded_comms_status ON branded_comms_records(status);
CREATE INDEX IF NOT EXISTS idx_branded_comms_type ON branded_comms_records(type);
CREATE INDEX IF NOT EXISTS idx_branded_comms_created ON branded_comms_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branded_comms_reference ON branded_comms_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_branded_comms_audit_record ON branded_comms_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_branded_comms_audit_created ON branded_comms_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branded_comms_idempotency_expires ON branded_comms_idempotency(expires_at);

-- Row-level security
ALTER TABLE branded_comms_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY branded_comms_tenant_isolation ON branded_comms_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_branded_comms_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_branded_comms_updated
    BEFORE UPDATE ON branded_comms_records
    FOR EACH ROW EXECUTE FUNCTION update_branded_comms_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_branded_comms_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM branded_comms_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
