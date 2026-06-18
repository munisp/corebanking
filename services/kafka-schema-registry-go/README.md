# Kafka Schema Registry

54Bank Kafka Schema Registry — Go

## Quick Start

```bash
# Build
go build -o kafka-schema-registry-go .

# Run
PORT=6379 ./kafka-schema-registry-go
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/healthz` | GET | Health check |
| `/metrics` | GET | Request/error counters |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `6379` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector | — |
| `JWT_SECRET` | JWT signing key | — |

## Resilience Patterns

- Circuit Breaker (5-failure threshold, 30s recovery)
- Rate Limiting (token bucket)
- Retry with Exponential Backoff (100ms base, 5s cap)
- Request Tracing (X-Trace-Id propagation)
- Idempotency (X-Idempotency-Key header)
- Audit Trail (append-only event log)
- Graceful Shutdown (SIGTERM/SIGINT handling)

## Security

- HSTS + CSP + X-Frame-Options headers
- Input sanitization (HTML entity encoding)
- PII masking in logs
- Non-root Docker container
- CORS with configurable origins

## Testing

```bash
go test ./...
```

## Docker

```bash
docker build -t 54bank/kafka-schema-registry-go .
docker run -p 6379:6379 54bank/kafka-schema-registry-go
```

## Tech Stack

- **Language**: Go
- **Part of**: 54Bank Core Banking Platform
