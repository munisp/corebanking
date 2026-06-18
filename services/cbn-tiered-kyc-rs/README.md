# Cbn Tiered Kyc

54Bank Cbn Tiered Kyc service

## Quick Start

```bash
# Build
cargo build --release

# Run
PORT=9210 ./target/release/cbn-tiered-kyc-rs
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/healthz` | GET | Health check |
| `/metrics` | GET | Request/error counters |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `9210` |
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
cargo test
```

## Docker

```bash
docker build -t 54bank/cbn-tiered-kyc-rs .
docker run -p 9210:9210 54bank/cbn-tiered-kyc-rs
```

## Tech Stack

- **Language**: Rust
- **Part of**: 54Bank Core Banking Platform
