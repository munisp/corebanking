-- Migration: 001_create_crop_yield_prediction_tables
-- Service: crop-yield-prediction-py
-- Created: 2026-06-09
-- Description: Initial schema for crop-yield-prediction-py

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS crop_yield_prediction_records (
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
CREATE TABLE IF NOT EXISTS crop_yield_prediction_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES crop_yield_prediction_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS crop_yield_prediction_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crop_yield_prediction_tenant ON crop_yield_prediction_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crop_yield_prediction_status ON crop_yield_prediction_records(status);
CREATE INDEX IF NOT EXISTS idx_crop_yield_prediction_type ON crop_yield_prediction_records(type);
CREATE INDEX IF NOT EXISTS idx_crop_yield_prediction_created ON crop_yield_prediction_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crop_yield_prediction_reference ON crop_yield_prediction_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crop_yield_prediction_audit_record ON crop_yield_prediction_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_crop_yield_prediction_audit_created ON crop_yield_prediction_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crop_yield_prediction_idempotency_expires ON crop_yield_prediction_idempotency(expires_at);

-- Row-level security
ALTER TABLE crop_yield_prediction_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY crop_yield_prediction_tenant_isolation ON crop_yield_prediction_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_crop_yield_prediction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crop_yield_prediction_updated
    BEFORE UPDATE ON crop_yield_prediction_records
    FOR EACH ROW EXECUTE FUNCTION update_crop_yield_prediction_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_crop_yield_prediction_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM crop_yield_prediction_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
