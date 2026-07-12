# ADR 0004: 14-middleware integration architecture

## Status
Accepted

## Context
Platform requires integration with Kafka, Dapr, Fluvio, Temporal, PostgreSQL, Keycloak, Permify, Redis, Mojaloop, OpenSearch, APISIX, OpenAppSec, TigerBeetle, and Lakehouse.

## Decision
All middleware configured via environment variables. Each middleware has a health check endpoint and graceful degradation when unavailable. Express server acts as integration gateway.

## Consequences
- **Positive:** Any middleware can be enabled/disabled independently
- **Positive:** Graceful fallback when middleware is unavailable
- **Negative:** Express server becomes a bottleneck if all middleware are active
- **Mitigated:** Each microservice can connect directly to middleware in production
