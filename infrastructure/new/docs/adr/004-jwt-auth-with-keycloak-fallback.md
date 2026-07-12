# ADR-004: JWT Authentication with Keycloak Fallback

**Status:** Accepted  
**Date:** 2026-05-09  
**Decision Makers:** Engineering Team

## Context

Banking platform requires robust authentication with regulatory-grade audit trails.
Keycloak provides enterprise IdP capabilities but may not be available in all environments.

## Decision

Use **local JWT authentication** with **Keycloak OAuth2/OIDC** integration when available.

## Rationale

- **Local JWT:** PBKDF2-SHA512 password hashing, 6 RBAC roles, MFA/TOTP support
- **Keycloak:** Enterprise SSO, OAuth2 Authorization Code flow, token introspection
- **Fallback:** If Keycloak is unreachable, system uses local JWT seamlessly
- `ENABLE_AUTH` flag controls enforcement (default: true in production)

## RBAC Roles

| Role | Permissions |
|------|------------|
| admin | Full platform access |
| operations | Transaction processing, account management |
| compliance | AML/KYC review, SAR filing |
| teller | Branch operations, cash handling |
| auditor | Read-only audit trail access |
| viewer | Dashboard and report viewing |

## Consequences

- Auth can be toggled for development convenience
- Session management includes rotation (15-min interval) and concurrent limits (3 max)
- Brute force protection: 5 attempts → 15-min lockout
- Token blacklisting on logout prevents session reuse
- MFA/TOTP enrollment optional but enforced for admin/compliance roles in production
