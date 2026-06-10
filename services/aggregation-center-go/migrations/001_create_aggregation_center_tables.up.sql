-- Migration: 001_create_aggregation_center_tables
-- Service: aggregation-center-go
-- Created: 2026-06-09
-- Description: Initial schema for aggregation-center-go

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS aggregation_center_records (
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
CREATE TABLE IF NOT EXISTS aggregation_center_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES aggregation_center_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS aggregation_center_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aggregation_center_tenant ON aggregation_center_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aggregation_center_status ON aggregation_center_records(status);
CREATE INDEX IF NOT EXISTS idx_aggregation_center_type ON aggregation_center_records(type);
CREATE INDEX IF NOT EXISTS idx_aggregation_center_created ON aggregation_center_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aggregation_center_reference ON aggregation_center_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aggregation_center_audit_record ON aggregation_center_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_aggregation_center_audit_created ON aggregation_center_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aggregation_center_idempotency_expires ON aggregation_center_idempotency(expires_at);

-- Row-level security
ALTER TABLE aggregation_center_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY aggregation_center_tenant_isolation ON aggregation_center_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_aggregation_center_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aggregation_center_updated
    BEFORE UPDATE ON aggregation_center_records
    FOR EACH ROW EXECUTE FUNCTION update_aggregation_center_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_aggregation_center_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM aggregation_center_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
