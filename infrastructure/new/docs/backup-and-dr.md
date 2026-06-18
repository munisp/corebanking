# Backup & Disaster Recovery Plan (#30)

## PostgreSQL Backup Strategy

### WAL Archiving (Continuous)
```bash
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://54bank-wal-archive/%f --sse AES256'
max_wal_senders = 10
wal_keep_size = 1GB
```

### Automated Daily Backups
```bash
#!/bin/bash
# cron: 0 2 * * * /opt/54bank/scripts/backup.sh
DATE=$(date +%Y-%m-%d_%H%M)
DB_NAME="ndsep_db"
BACKUP_DIR="/var/backups/54bank"
S3_BUCKET="s3://54bank-backups"

# Full logical backup
pg_dump -Fc -Z9 -f "${BACKUP_DIR}/${DB_NAME}_${DATE}.dump" ${DB_NAME}

# Upload to S3
aws s3 cp "${BACKUP_DIR}/${DB_NAME}_${DATE}.dump" \
  "${S3_BUCKET}/daily/${DB_NAME}_${DATE}.dump" \
  --sse AES256 --storage-class STANDARD_IA

# Verify backup integrity
pg_restore --list "${BACKUP_DIR}/${DB_NAME}_${DATE}.dump" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "BACKUP VERIFICATION FAILED" | mail -s "54Bank Backup Alert" ops@54bank.com
  exit 1
fi

# Cleanup local backups older than 7 days
find ${BACKUP_DIR} -name "*.dump" -mtime +7 -delete

echo "Backup completed: ${DB_NAME}_${DATE}.dump"
```

### Point-in-Time Recovery (PITR)
```bash
# Restore to specific timestamp
pg_basebackup -D /var/lib/postgresql/recovery -Fp -Xs -P

# Create recovery.conf
cat > /var/lib/postgresql/recovery/recovery.conf <<EOF
restore_command = 'aws s3 cp s3://54bank-wal-archive/%f %p'
recovery_target_time = '2026-05-09 14:00:00 UTC'
recovery_target_action = 'promote'
EOF

pg_ctl -D /var/lib/postgresql/recovery start
```

## Redis Backup
```bash
# redis.conf
save 900 1       # Every 15 min if at least 1 key changed
save 300 10      # Every 5 min if at least 10 keys changed
save 60 10000    # Every 1 min if at least 10000 keys changed
appendonly yes
appendfilename "54bank-aof.aof"
appendfsync everysec
```

## Kafka Topic Backup
```bash
# Mirror Maker for cross-DC replication
kafka-mirror-maker.sh \
  --consumer.config source.properties \
  --producer.config target.properties \
  --whitelist "54bank.*"
```

## Microservice State Backup
All 17 microservices are stateless — state lives in PostgreSQL, Redis, and Kafka. Service binaries are built from Git and can be redeployed from any commit.

## Recovery Time Objectives
| Component | RPO | RTO | Strategy |
|---|---|---|---|
| PostgreSQL | 0 (WAL) | < 15 min | PITR from WAL |
| Redis | 1 sec | < 5 min | AOF replay |
| Kafka | 0 (replication) | < 10 min | Multi-broker |
| Microservices | 0 (stateless) | < 5 min | Re-deploy from Git |
| Express Gateway | 0 (stateless) | < 2 min | Container restart |

## Disaster Recovery Runbook

### Scenario 1: Single Service Failure
1. Service health check fails on `/healthz/services`
2. Kubernetes/Docker auto-restarts the container
3. No manual intervention required

### Scenario 2: Database Corruption
1. Stop all services: `docker compose down`
2. Restore latest backup: `pg_restore -C -d postgres latest.dump`
3. Apply WAL: `pg_ctl -D /data start` with recovery.conf
4. Verify data: run smoke tests
5. Restart services: `docker compose up -d`

### Scenario 3: Full Data Center Loss
1. Provision new infrastructure in DR region
2. Restore PostgreSQL from S3 WAL archive
3. Restore Redis from latest AOF in S3
4. Deploy all services from Git main branch
5. Update DNS to point to new region
6. Run full smoke test suite
7. Estimated RTO: < 30 minutes

## Monitoring Alerts
```yaml
# Grafana alert rules
- alert: BackupMissed
  expr: time() - max(backup_last_success_timestamp) > 86400
  for: 1h
  labels:
    severity: critical
  annotations:
    summary: "Database backup has not completed in 24 hours"

- alert: WALArchiveLag
  expr: pg_stat_archiver_last_archived_wal_age > 300
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "WAL archiving is lagging behind"
```
