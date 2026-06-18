# 54Bank Operations Runbook

## Incident Response

### Severity Levels
| Level | Description | Response Time | Escalation |
|-------|------------|---------------|------------|
| P1 | Platform down, no transactions | 15 min | CTO + Engineering Lead |
| P2 | Degraded performance, partial outage | 30 min | Engineering Lead |
| P3 | Non-critical feature broken | 2 hours | Team Lead |
| P4 | Minor UI issue, cosmetic | Next business day | Assigned developer |

### Common Issues

#### Database Connection Failures
```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Check connection pool
curl http://localhost:3000/api/health | jq '.database'

# Restart connection pool (graceful)
kill -USR2 $(pgrep -f "server/index.ts")
```

#### High Memory Usage
```bash
# Check Node.js heap
curl http://localhost:3000/api/metrics/prometheus | grep nodejs_heap

# Force garbage collection (development only)
kill -SIGUSR1 $(pgrep -f "server/index.ts")
```

#### Kafka Consumer Lag
```bash
# Check consumer group lag
kafka-consumer-groups.sh --bootstrap-server kafka:9092 \
  --group 54bank-consumer-group --describe

# Reset consumer offset (CAUTION)
kafka-consumer-groups.sh --bootstrap-server kafka:9092 \
  --group 54bank-consumer-group --reset-offsets --to-latest --execute
```

## Daily Operations

### Health Checks
```bash
# Platform health
curl http://localhost:3000/api/health

# Database connectivity
curl http://localhost:3000/api/db/health

# All middleware status
curl http://localhost:3000/api/platform/middleware/status
```

### Database Maintenance
```bash
# Daily backup (automated via cron)
./scripts/db-backup.sh

# Vacuum analyze (weekly)
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "VACUUM ANALYZE;"

# Check table sizes
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 20;"
```

## Deployment Procedures

### Rolling Update
```bash
# Build new image
docker build -t 54bank:$(git rev-parse --short HEAD) .

# Deploy via Helm
helm upgrade 54bank ./helm/54bank \
  --set image.tag=$(git rev-parse --short HEAD) \
  --wait --timeout 300s
```

### Rollback
```bash
# Helm rollback
helm rollback 54bank 1

# Database rollback (if migration was applied)
./scripts/db-restore.sh /var/backups/54bank/latest.sql.gz
```
