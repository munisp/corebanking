# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

- Email: security@54bank.ng
- Do NOT open a public GitHub issue for security vulnerabilities
- Include steps to reproduce, impact assessment, and suggested fix if possible
- We will acknowledge within 24 hours and provide a fix timeline within 72 hours

## Security Measures

### Authentication
- PBKDF2-SHA512 password hashing (100,000 iterations)
- JWT tokens with HS256 signing
- Brute force protection (5 attempts → 15-minute lockout)
- Token blacklisting on logout
- CSRF token generation

### Authorization
- Role-based access control (RBAC) with 8 roles
- Permission matrix: admin, operations, compliance, treasury, branch, teller, user, auditor
- Route-level permission enforcement

### Transport Security
- HSTS with 1-year max-age
- TLS 1.2+ required in production
- Secure cookie flags (HttpOnly, Secure, SameSite)

### Application Security
- 7 OWASP security headers
- Input validation with Zod schemas
- Nigerian-specific validators (BVN, NIN, NUBAN, phone)
- SQL injection prevention (parameterized queries)
- XSS prevention (Content-Security-Policy)
- Rate limiting on all API endpoints

### Data Protection
- AES-256-GCM encryption at rest for PII
- NDPR (Nigeria Data Protection Regulation) compliance
- PCI-DSS controls for card data
- Audit logging for all auth events

### Infrastructure
- Container isolation (Docker)
- Kubernetes network policies
- External secrets management (no hardcoded secrets)
- Automated security scanning in CI

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| 1.x     | No        |

## Compliance

- CBN (Central Bank of Nigeria) guidelines
- NFIU (Nigerian Financial Intelligence Unit) reporting
- NDPR (Nigeria Data Protection Regulation)
- PCI-DSS Level 1
- FATF recommendations
- Basel III/IV capital requirements

