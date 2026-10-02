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
# PL-11: `|| true` removed — a failed basebackup must fail the job loudly
# (non-zero exit → CronJob failed → alert), not be silently swallowed.
if [ "${ENABLE_WAL_ARCHIVE:-false}" = "true" ]; then
  WAL_DIR="${BACKUP_DIR}/wal"
  mkdir -p "$WAL_DIR"
  PGPASSWORD="${DB_PASSWORD}" pg_basebackup -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -D "$WAL_DIR/base_${TIMESTAMP}" -Ft -z -P 2>&1
fi

# Offsite upload to S3-compatible object storage with server-side encryption.
# PL-11: local-only backups die with the node. Set S3_BUCKET (e.g. via the
# backup-credentials secret in k8s/backups/backup-cronjob.yaml) to enable.
if [ -n "${S3_BUCKET:-}" ]; then
  S3_PREFIX="${S3_PREFIX:-postgres}"
  echo "[$(date)] Uploading backup to s3://${S3_BUCKET}/${S3_PREFIX}/ ..."
  aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/${S3_PREFIX}/$(basename "$BACKUP_FILE")" \
    --sse AES256 --only-show-errors
  if [ "${ENABLE_WAL_ARCHIVE:-false}" = "true" ]; then
    aws s3 cp --recursive "${BACKUP_DIR}/wal/base_${TIMESTAMP}" \
      "s3://${S3_BUCKET}/${S3_PREFIX}/wal/base_${TIMESTAMP}" --sse AES256 --only-show-errors
  fi
  echo "[$(date)] S3 upload complete (SSE-AES256)."
else
  echo "[$(date)] WARNING: S3_BUCKET not set — backup remains LOCAL ONLY at ${BACKUP_FILE}." >&2
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Cleaned up backups older than ${RETENTION_DAYS} days"

echo "[$(date)] Backup process complete"
