# Falkordb Coa

--- PII Masking (NDPR Compliance) ---

## Quick Start

```bash
# Build
pip install -r requirements.txt  # if applicable

# Run
PORT=8080 python main.py
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/healthz` | GET | Health check |
| `/metrics` | GET | Request/error counters |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
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
python -m pytest test_main.py
```

## Docker

```bash
docker build -t 54bank/falkordb-coa-py .
docker run -p 8080:8080 54bank/falkordb-coa-py
```

## Tech Stack

- **Language**: Python
- **Part of**: 54Bank Core Banking Platform
