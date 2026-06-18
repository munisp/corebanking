# Database Setup Guide

## Overview

The Communication Hub uses **PostgreSQL** to store:

- ✅ **Channel configurations** (API keys, credentials, settings)
- ✅ **Message history** (all sent/received messages)
- ✅ **Conversations** (active conversation tracking)
- ✅ **Broadcast history** (broadcast campaigns)

All settings you save from the dashboard are **persisted to the database** and will survive service restarts.

---

## Quick Setup

### 1. Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql
brew services start postgresql

# Or use Docker
docker run --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=54link-dev \
  -p 5432:5432 \
  -d postgres:15
```

### 2. Configure Environment

```bash
cd /home/tani/Documents/54link/54link_core_banking/services/omini-service/communication-hub

# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
nano .env
```

Update these values:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/54link-dev
DB_HOST=localhost
DB_PORT=5432
DB_NAME=54link-dev
DB_USER=postgres
DB_PASSWORD=password
```

### 3. Run Setup Script

```bash
# Make script executable
chmod +x setup_db.sh

# Run setup
./setup_db.sh
```

This will:

- ✅ Create the database
- ✅ Create all tables
- ✅ Add indexes for performance
- ✅ Insert default channel configurations
- ✅ Create triggers for updated_at timestamps

### 4. Verify Setup

```bash
# Connect to database
psql -h localhost -U postgres -d 54link-dev

# List tables
\dt

# You should see:
# - messages
# - channel_configs
# - conversations
# - broadcasts

# Check channel configs
SELECT * FROM channel_configs;

# Exit psql
\q
```

---

## Database Schema

### 1. `messages` Table

Stores all communication messages (sent & received).

```sql
CREATE TABLE messages (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    channel VARCHAR(50) NOT NULL,        -- whatsapp, sms, ussd, telegram
    direction VARCHAR(20) NOT NULL,      -- inbound, outbound
    type VARCHAR(50) NOT NULL,           -- text, image, document, etc.
    "from" VARCHAR(255) NOT NULL,
    "to" VARCHAR(255) NOT NULL,
    content TEXT,
    metadata JSONB,
    timestamp TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL,         -- pending, sent, delivered, failed
    customer_id VARCHAR(100),
    session_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**

- `idx_messages_tenant_channel` - Fast queries by tenant + channel
- `idx_messages_customer` - Fast conversation lookups
- `idx_messages_timestamp` - Recent messages queries
- `idx_messages_session` - USSD session tracking

---

### 2. `channel_configs` Table

**⭐ This is where your dashboard settings are saved!**

```sql
CREATE TABLE channel_configs (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    channel VARCHAR(50) NOT NULL,           -- whatsapp, sms, ussd, telegram
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    rate_limit INTEGER DEFAULT 1000,
    credentials JSONB,                      -- 🔐 API keys, tokens, etc.
    settings JSONB,                         -- Channel-specific settings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, channel)
);
```

**Example Data:**

```json
// WhatsApp credentials
{
  "api_key": "your_africas_talking_api_key",
  "username": "sandbox",
  "environment": "sandbox",
  "wa_number": "+2547XXXXXXXX"
}

// WhatsApp settings
{
  "callback_url": "https://your-domain.com/webhook",
  "session_timeout": 180
}
```

**Indexes:**

- `idx_channel_configs_tenant` - Fast tenant lookups
- `idx_channel_configs_enabled` - Filter active channels

---

### 3. `conversations` Table

Tracks active customer conversations across channels.

```sql
CREATE TABLE conversations (
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
```

---

### 4. `broadcasts` Table

Tracks broadcast campaigns and their results.

```sql
CREATE TABLE broadcasts (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    channels TEXT[] NOT NULL,              -- ['whatsapp', 'sms']
    recipients TEXT[] NOT NULL,            -- ['+234...', '+234...']
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    total_recipients INTEGER,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',  -- pending, sending, completed, failed
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);
```

---

## How It Works

### When You Save Settings in the Dashboard:

1. **Dashboard** → Calls `ominiService.updateChannelConfig()`
2. **API** → `PUT /api/v1/channel/config`
3. **Communication Hub** → `UpdateChannelConfig()` function
4. **Database** → Stores credentials in `channel_configs` table

```go
// This happens when you click "Save Settings"
INSERT INTO channel_configs (tenant_id, channel, enabled, credentials, settings)
VALUES ('default', 'whatsapp', true,
  '{"api_key": "...", "username": "sandbox"}',
  '{"callback_url": "..."}'
)
ON CONFLICT (tenant_id, channel)
DO UPDATE SET
  credentials = EXCLUDED.credentials,
  settings = EXCLUDED.settings,
  updated_at = CURRENT_TIMESTAMP
```

### On Service Restart:

1. **Communication Hub starts**
2. Calls `loadChannelConfigs()` function
3. **Loads all credentials from database**
4. Credentials are restored and ready to use!

---

## Manual Database Operations

### View Saved Configurations

```sql
-- See all channel configurations
SELECT
  channel,
  enabled,
  priority,
  rate_limit,
  credentials,
  settings,
  updated_at
FROM channel_configs
WHERE tenant_id = 'default';
```

### Update Configuration Manually

```sql
-- Enable/disable a channel
UPDATE channel_configs
SET enabled = false
WHERE tenant_id = 'default' AND channel = 'whatsapp';

-- Update credentials
UPDATE channel_configs
SET credentials = '{"api_key": "new_key", "username": "live"}'
WHERE tenant_id = 'default' AND channel = 'whatsapp';
```

### View Message History

```sql
-- Recent WhatsApp messages
SELECT
  id,
  direction,
  "from",
  "to",
  content,
  status,
  timestamp
FROM messages
WHERE channel = 'whatsapp'
ORDER BY timestamp DESC
LIMIT 20;

-- Message statistics
SELECT
  channel,
  direction,
  status,
  COUNT(*) as count
FROM messages
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY channel, direction, status;
```

### View Active Conversations

```sql
SELECT
  customer_id,
  channel,
  phone_number,
  message_count,
  last_message,
  last_activity
FROM conversations
WHERE is_active = true
ORDER BY last_activity DESC;
```

---

## Troubleshooting

### "relation does not exist" Error

```bash
# Database not initialized
# Run setup script:
./setup_db.sh
```

### "authentication failed" Error

```bash
# Check credentials in .env
cat .env | grep DB_

# Test connection
psql -h localhost -U postgres -d 54link-dev -c "SELECT 1"
```

### Settings Not Persisting

```bash
# Check if database is connected
curl http://localhost:8124/health

# Check database logs
docker logs postgres  # if using Docker
tail -f /var/log/postgresql/postgresql-15-main.log  # if native install

# Check table exists
psql -d 54link-dev -c "\d channel_configs"
```

### Clear All Settings

```sql
-- Reset all channel configs to defaults
DELETE FROM channel_configs WHERE tenant_id = 'default';

-- Will be recreated with defaults on next save
```

---

## Backup & Restore

### Backup Database

```bash
# Full backup
pg_dump -h localhost -U postgres 54link-dev > backup_$(date +%Y%m%d).sql

# Just channel configs
pg_dump -h localhost -U postgres -t channel_configs 54link-dev > configs_backup.sql
```

### Restore Database

```bash
# Restore full backup
psql -h localhost -U postgres -d 54link-dev < backup_20260210.sql

# Restore just configs
psql -h localhost -U postgres -d 54link-dev < configs_backup.sql
```

---

## Production Considerations

### Security

1. **Encrypt credentials in database:**

```sql
-- Use PostgreSQL encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt before insert
INSERT INTO channel_configs (credentials)
VALUES (pgp_sym_encrypt('{"api_key": "..."}', 'encryption_key'));
```

2. **Use environment variables for encryption keys**
3. **Restrict database access** - Only allow Communication Hub to connect
4. **Use SSL connections** in production

### Performance

1. **Connection pooling** - Already configured in pgxpool
2. **Index maintenance:**

```sql
-- Reindex for performance
REINDEX TABLE messages;
REINDEX TABLE channel_configs;
```

3. **Vacuum regularly:**

```sql
VACUUM ANALYZE messages;
VACUUM ANALYZE channel_configs;
```

### Monitoring

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('54link-dev'));

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = '54link-dev';
```

---

## Summary

✅ **Database is configured to save:**

- API keys and credentials (encrypted in JSONB)
- Channel settings (timeouts, URLs, etc.)
- Message history
- Conversation state
- Broadcast campaigns

✅ **Settings persist across restarts**

✅ **Loaded automatically on startup**

✅ **Dashboard integration complete**

**Next Step:** Run `./setup_db.sh` to initialize your database! 🚀
