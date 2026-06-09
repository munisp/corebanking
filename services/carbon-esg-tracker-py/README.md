# Carbon Esg Tracker

!/usr/bin/env python3

## Quick Start

```bash
# Build
pip install -r requirements.txt  # if applicable

# Run
PORT=8105 python main.py
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/healthz` | GET | Health check |
| `/metrics` | GET | Request/error counters |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8105` |
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
docker build -t 54bank/carbon-esg-tracker-py .
docker run -p 8105:8105 54bank/carbon-esg-tracker-py
```

## Tech Stack

- **Language**: Python
- **Part of**: 54Bank Core Banking Platform
