# Kpi Engine

54Bank Kpi Engine service

## Quick Start

```bash
# Build
go build -o kpi-engine-go .

# Run
PORT=8098 ./kpi-engine-go
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/healthz` | GET | Health check |
| `/metrics` | GET | Request/error counters |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8098` |
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
docker build -t 54bank/kpi-engine-go .
docker run -p 8098:8098 54bank/kpi-engine-go
```

## Tech Stack

- **Language**: Go
- **Part of**: 54Bank Core Banking Platform
