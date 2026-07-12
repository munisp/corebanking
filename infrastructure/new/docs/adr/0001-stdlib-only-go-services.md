# ADR 0001: Use stdlib-only Go services

## Status
Accepted

## Context
180 Go microservices need HTTP servers and Postgres connectivity. External dependencies (e.g., github.com/lib/pq, gorilla/mux) add supply chain risk and require go.mod/go.sum management in CI.

## Decision
All Go services use only the standard library (`net/http`, `database/sql`, `encoding/json`, `crypto`). No external Go modules.

## Consequences
- **Positive:** Zero supply chain risk, faster CI builds, no dependency updates needed
- **Positive:** Single `go build .` compiles with no `go mod download`
- **Negative:** More boilerplate code (manual routing, manual JSON parsing)
- **Negative:** No connection pooling config (basic `database/sql` pool only)
