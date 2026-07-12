#!/bin/bash
# Database Migration Script
# Usage: ./scripts/migrate.sh [generate|migrate|push|status]

set -euo pipefail

ACTION="${1:-migrate}"

echo "=== 54Link Core Banking Database Migration ==="
echo "Action: $ACTION"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

case "$ACTION" in
  generate)
    echo "Generating migration from schema changes..."
    npx drizzle-kit generate
    echo "Migration files generated in drizzle/ directory"
    ;;
  migrate)
    echo "Running pending migrations..."
    npx drizzle-kit migrate
    echo "Migrations applied successfully"
    ;;
  push)
    echo "Pushing schema directly (dev only)..."
    npx drizzle-kit push
    echo "Schema pushed"
    ;;
  status)
    echo "Checking migration status..."
    npx drizzle-kit check
    ;;
  full)
    echo "Full setup: generate + migrate..."
    npx drizzle-kit generate || true
    npx drizzle-kit migrate
    echo "Full database setup complete"
    ;;
  *)
    echo "Usage: $0 [generate|migrate|push|status|full]"
    exit 1
    ;;
esac
