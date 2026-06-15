# Islamic Profit Sharing Engine

**Language:** Rust
**Kafka Topic:** `banking.lending`
**Health Endpoint:** `/healthz`

## Description

Mudarabah/Musharakah profit distribution calculations. Computes profit-sharing ratios per Islamic finance principles.

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
| `DATABASE_URL` | PostgreSQL connection string | `postgres://localhost:5432/islamic_profit_sharing_rs` |
| `KAFKA_BROKERS` | Kafka broker list | `localhost:9092` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |

## Running

```bash
# Rust
cargo run
```

## Testing

```bash
cargo test
```
