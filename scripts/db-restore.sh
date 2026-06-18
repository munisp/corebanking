#!/bin/bash
# 54Bank Database Restore Script
set -euo pipefail

BACKUP_FILE="${1:?Usage: db-restore.sh <backup-file>}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-bank54_db}"
DB_USER="${DB_USER:-bank54_user}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "[$(date)] Restoring ${DB_NAME} from ${BACKUP_FILE}..."
echo "WARNING: This will overwrite the current database. Press Ctrl+C to cancel."
sleep 5

PGPASSWORD="${DB_PASSWORD}" pg_restore \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  --verbose \
  "$BACKUP_FILE" 2>&1

echo "[$(date)] Restore complete"
