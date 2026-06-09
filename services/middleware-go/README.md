# Middleware Go

Shared Go middleware library providing reusable components for all 54Bank Go services.

## Modules

| Module | Description |
|--------|-------------|
| `middleware.go` | HTTP middleware chain (auth, CORS, rate limiting, tracing) |
| `cache.go` | Redis cache abstraction with stampede protection |
| `datastreaming.go` | Kafka producer/consumer with DLQ and exactly-once |
| `eventsourcing.go` | Event sourcing patterns with snapshots |
| `grpc.go` | gRPC server/client with interceptors |
| `ml_client.go` | ML inference client for fraud scoring |
| `observability.go` | Structured logging and metrics collection |
| `otel.go` | OpenTelemetry tracer and span propagation |
| `pagination.go` | Cursor-based pagination helpers |
| `persistence.go` | PostgreSQL connection pooling and query builders |
| `ratelimit.go` | Distributed rate limiting with Redis backend |
| `security.go` | Input sanitization, PII masking, HSTS headers |
| `temporal.go` | Temporal workflow client and activity wrappers |
| `tigerbeetle.go` | TigerBeetle ledger client for double-entry accounting |
| `disaster_recovery.go` | DR failover and health monitoring |

## Usage

```go
import "github.com/54bank/middleware-go"
```

## Tech Stack

- **Language**: Go
- **Part of**: 54Bank Core Banking Platform
