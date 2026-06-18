# Kafka Dead Letter Queue Processor

**Language:** Go
**Kafka Topic:** `platform.events`
**Health Endpoint:** `/healthz`

## Description

Retries and manages failed Kafka messages. Processes DLQ topics with exponential backoff and alerting.

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
| `DATABASE_URL` | PostgreSQL connection string | `postgres://localhost:5432/kafka_dlq_processor_go` |
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
