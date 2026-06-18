# Middleware Rust

Shared Rust middleware library providing reusable components for all 54Bank Rust services.

## Features

- Actix-web middleware chain (auth, CORS, rate limiting, tracing)
- Circuit breaker with atomic state management
- Request/response metrics via AtomicU64 counters
- OpenTelemetry trace propagation
- Input sanitization and HTML entity encoding
- HSTS and security headers

## Usage

```toml
[dependencies]
middleware-rs = { path = "../middleware-rs" }
```

## Tech Stack

- **Language**: Rust
- **Framework**: Actix-web
- **Part of**: 54Bank Core Banking Platform
