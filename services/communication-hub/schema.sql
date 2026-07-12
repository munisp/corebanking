-- Communication Hub Database Schema
-- PostgreSQL

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL,
    "from" VARCHAR(255) NOT NULL,
    "to" VARCHAR(255) NOT NULL,
    content TEXT,
    metadata JSONB,
    timestamp TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL,
    customer_id VARCHAR(100),
    session_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_tenant_channel ON messages(tenant_id, channel);
CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages(tenant_id, customer_id, channel);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

-- Channel configurations table
CREATE TABLE IF NOT EXISTS channel_configs (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    rate_limit INTEGER DEFAULT 1000,
    credentials JSONB,
    settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, channel)
);

-- Index for channel configs
CREATE INDEX IF NOT EXISTS idx_channel_configs_tenant ON channel_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_channel_configs_enabled ON channel_configs(enabled);

-- Conversations table for tracking active conversations
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    phone_number VARCHAR(50),
    state VARCHAR(50) DEFAULT 'active',
    context JSONB,
    message_count INTEGER DEFAULT 0,
    last_message TEXT,
    last_activity TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_active ON conversations(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);

-- Broadcast history table
CREATE TABLE IF NOT EXISTS broadcasts (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    channels TEXT[] NOT NULL,
    recipients TEXT[] NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    total_recipients INTEGER,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Index for broadcasts
CREATE INDEX IF NOT EXISTS idx_broadcasts_tenant ON broadcasts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts(created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channel_configs_updated_at BEFORE UPDATE ON channel_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default channel configurations
INSERT INTO channel_configs (tenant_id, channel, enabled, priority, rate_limit, credentials, settings)
VALUES 
    ('default', 'whatsapp', true, 1, 1000, '{}', '{}'),
    ('default', 'sms', true, 1, 1000, '{}', '{}'),
    ('default', 'ussd', true, 1, 1000, '{}', '{}'),
    ('default', 'telegram', true, 1, 1000, '{}', '{}')
ON CONFLICT (tenant_id, channel) DO NOTHING;

-- Grant permissions (adjust for your database user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_db_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_db_user;
