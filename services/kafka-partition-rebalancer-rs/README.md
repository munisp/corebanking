# Kafka Partition Rebalancer

**Language:** Rust
**Kafka Topic:** `platform.events`
**Health Endpoint:** `/healthz`

## Description

Optimizes Kafka partition assignment across consumers. Ensures even distribution for maximum throughput.

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
| `DATABASE_URL` | PostgreSQL connection string | `postgres://localhost:5432/kafka_partition_rebalancer_rs` |
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
