# ADR-002: Polyglot Microservices (Go, Rust, Python)

**Status:** Accepted  
**Date:** 2026-05-09  
**Decision Makers:** Engineering Team

## Context

425 microservices handle different banking domains with varying performance, safety, and data science requirements.

## Decision

Use **Go** for high-throughput API services, **Rust** for safety-critical financial processing, and **Python** for analytics/ML/compliance.

## Rationale

- **Go (180 services):** Fast compilation, goroutine concurrency, stdlib HTTP server, ideal for CRUD APIs and middleware
- **Rust (139 services):** Memory safety without GC, zero-cost abstractions, ideal for transaction processing, fraud detection, cryptographic operations
- **Python (106 services):** Rich ML/data science ecosystem (pandas, scikit-learn), rapid prototyping for compliance rules, regulatory reporting

## Consequences

- Three separate CI pipelines (Go, Rust, Python)
- Three Dockerfile templates (`Dockerfile.go`, `Dockerfile.rust`, `Dockerfile.python`)
- Shared PostgreSQL database via DATABASE_URL environment variable
- All services expose `/health` and `/data` endpoints for uniformity
- Express BFF (TypeScript) proxies requests to appropriate microservice
