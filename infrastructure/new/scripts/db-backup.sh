#!/bin/bash
# 54Bank Database Backup Script
# Run via cron: 0 2 * * * /opt/54bank/scripts/db-backup.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/54bank}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-bank54_db}"
DB_USER="${DB_USER:-bank54_user}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup of ${DB_NAME}..."

# Full database dump with compression
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="$BACKUP_FILE" 2>&1

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup completed: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date)] ERROR: Backup failed!" >&2
  exit 1
fi

# WAL archiving (if enabled)
if [ "${ENABLE_WAL_ARCHIVE:-false}" = "true" ]; then
  WAL_DIR="${BACKUP_DIR}/wal"
  mkdir -p "$WAL_DIR"
  pg_basebackup -h "$DB_HOST" -U "$DB_USER" -D "$WAL_DIR/base_${TIMESTAMP}" -Ft -z -P 2>&1 || true
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Cleaned up backups older than ${RETENTION_DAYS} days"

echo "[$(date)] Backup process complete"
