#!/bin/bash

# Communication Hub Database Setup Script
# This script initializes the PostgreSQL database for the Communication Hub

set -e  # Exit on error

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Database connection parameters
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-54link-dev}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD}"

echo "🚀 Setting up Communication Hub Database"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed"
    echo "Please install PostgreSQL client"
    exit 1
fi

# Check if database exists
echo "📊 Checking database connection..."
if [ -z "$DB_PASSWORD" ]; then
    PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1" > /dev/null 2>&1
    CONN_STATUS=$?
else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1" > /dev/null 2>&1
    CONN_STATUS=$?
fi

if [ $CONN_STATUS -ne 0 ]; then
    echo "❌ Error: Cannot connect to PostgreSQL"
    echo "Please check your database credentials"
    exit 1
fi

echo "✅ Database connection successful"
echo ""

# Create database if it doesn't exist
echo "📦 Creating database if not exists..."
if [ -z "$DB_PASSWORD" ]; then
    PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME"
else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME"
fi

echo "✅ Database ready"
echo ""

# Run schema
echo "📝 Running schema.sql..."
if [ -z "$DB_PASSWORD" ]; then
    PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f schema.sql
else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f schema.sql
fi

echo "✅ Schema applied successfully"
echo ""

# Verify tables
echo "🔍 Verifying tables..."
if [ -z "$DB_PASSWORD" ]; then
    TABLE_COUNT=$(PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('messages', 'channel_configs', 'conversations', 'broadcasts')")
else
    TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('messages', 'channel_configs', 'conversations', 'broadcasts')")
fi

TABLE_COUNT=$(echo $TABLE_COUNT | xargs)

if [ "$TABLE_COUNT" -eq 4 ]; then
    echo "✅ All tables created successfully:"
    echo "   - messages"
    echo "   - channel_configs"
    echo "   - conversations"
    echo "   - broadcasts"
else
    echo "⚠️  Warning: Expected 4 tables, found $TABLE_COUNT"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Database setup complete!"
echo ""
echo "You can now start the Communication Hub:"
echo "  go run communication_hub.go"
echo ""
