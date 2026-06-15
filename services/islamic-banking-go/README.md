# Islamic Banking Service

**Language:** Go
**Kafka Topic:** `banking.lending`
**Health Endpoint:** `/healthz`

## Description

Shariah-compliant banking products (Murabaha, Ijara, Mudarabah). Manages Islamic finance calculations, profit-sharing, and halal compliance.

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
| `DATABASE_URL` | PostgreSQL connection string | `postgres://localhost:5432/islamic_banking_go` |
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
