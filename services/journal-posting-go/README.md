# Journal Posting Engine

**Language:** Go
**Kafka Topic:** `accounting.ledger`
**Health Endpoint:** `/healthz`

## Description

Posts double-entry journal entries to the general ledger. Ensures GAAP/IFRS-compliant bookkeeping with audit trail.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Health check |
| GET | `/livez` | Liveness (watchdog-based) |
| GET | `/readyz` | Readiness probe |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `8080` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://localhost:5432/journal_posting_go` |
| `KAFKA_BROKERS` | Kafka broker list | `localhost:9092` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |

## Running

```bash
# Go
go run main.go
```

## Testing

```bash
go test ./...
```
