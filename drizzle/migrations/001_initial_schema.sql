-- Initial schema migration
-- Generated from drizzle/schema.ts
-- This represents the baseline schema state

-- Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    "openId" VARCHAR(64) NOT NULL UNIQUE,
    name TEXT,
    email VARCHAR(320),
    "loginMethod" VARCHAR(64),
    role TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "lastSignedIn" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consent_status VARCHAR(32) DEFAULT 'pending',
    consent_timestamp TIMESTAMPTZ,
    data_retention_policy VARCHAR(32) DEFAULT 'standard',
    pii_encryption_key_id VARCHAR(64)
);

-- Tenants (Multi-tenancy)
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    "tenantId" VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(191) NOT NULL,
    "onboardingStatus" TEXT NOT NULL,
    segment TEXT NOT NULL,
    region VARCHAR(96) NOT NULL,
    "enabledModules" JSONB NOT NULL,
    "whiteLabel" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NDPR Consent Management
CREATE TABLE IF NOT EXISTS ndpr_consents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    purpose VARCHAR(128) NOT NULL,
    legal_basis VARCHAR(64) NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT FALSE,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ndpr_consents_user ON ndpr_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_ndpr_consents_purpose ON ndpr_consents(purpose);

-- NDPR Data Subject Requests
CREATE TABLE IF NOT EXISTS ndpr_dsar (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    request_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    response_data JSONB,
    handler_notes TEXT,
    deadline_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);
CREATE INDEX IF NOT EXISTS idx_ndpr_dsar_user ON ndpr_dsar(user_id);
CREATE INDEX IF NOT EXISTS idx_ndpr_dsar_status ON ndpr_dsar(status);

-- Event Store (Event Sourcing)
CREATE TABLE IF NOT EXISTS event_store (
    id BIGSERIAL PRIMARY KEY,
    aggregate_id VARCHAR(128) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    version INTEGER NOT NULL,
    tenant_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(aggregate_id, version)
);
CREATE INDEX IF NOT EXISTS idx_event_store_aggregate ON event_store(aggregate_id, version);
CREATE INDEX IF NOT EXISTS idx_event_store_type ON event_store(aggregate_type, event_type);
CREATE INDEX IF NOT EXISTS idx_event_store_created ON event_store(created_at);

-- Feature Flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
    target_tenants JSONB DEFAULT '[]',
    target_roles JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dead Letter Queue tracking
CREATE TABLE IF NOT EXISTS dlq_messages (
    id BIGSERIAL PRIMARY KEY,
    original_topic VARCHAR(256) NOT NULL,
    consumer_group VARCHAR(256) NOT NULL,
    message_key TEXT,
    message_value JSONB NOT NULL,
    error_message TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(32) NOT NULL DEFAULT 'failed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_retry_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_dlq_topic ON dlq_messages(original_topic);
CREATE INDEX IF NOT EXISTS idx_dlq_status ON dlq_messages(status);

-- Audit Trail (immutable)
CREATE TABLE IF NOT EXISTS audit_trail (
    id BIGSERIAL PRIMARY KEY,
    actor_id VARCHAR(128) NOT NULL,
    actor_type VARCHAR(32) NOT NULL,
    action VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128),
    tenant_id VARCHAR(64),
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_trail(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_trail(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_trail(created_at);
