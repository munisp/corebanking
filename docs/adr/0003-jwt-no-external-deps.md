# ADR 0003: Pure-crypto JWT implementation

## Status
Accepted

## Context
Authentication requires JWT token generation and validation. The `jsonwebtoken` npm package is commonly used but adds a dependency.

## Decision
Implement JWT signing/verification using Node.js built-in `crypto` module (HMAC-SHA256). No external JWT library.

## Consequences
- **Positive:** Zero additional dependencies for auth
- **Positive:** Full control over token format and validation
- **Negative:** Only supports HS256 algorithm (no RS256/ES256)
- **Negative:** Must manually handle token expiry, clock skew
