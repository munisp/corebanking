# Temporal Access Service

A comprehensive conditional and temporal access control service with full Permify integration and tenant admin authorization.

## Features

### Temporal Grants

- Time-limited permissions with Redis TTL (15m, 30m, 1h, 4h, 8h, 24h, 7d, 30d)
- Background cleanup job for expired grants
- Grant/revoke/extend operations
- Full audit trail

### Tenant Admin Authorization

- **Multi-tenant isolation**: Tenant admins can only manage their own tenant
- **Role-based access**: Platform admin, Tenant admin, Grantor, Grantee
- **Permify integration**: Authorization checks via ReBAC
- **Fail-closed security**: Denies access if authorization service unavailable
- See [TENANT_ADMIN_GUIDE.md](TENANT_ADMIN_GUIDE.md) for details

### Conditional Access

- **IP Whitelist**: CIDR notation support (e.g., `192.168.1.0/24`)
- **Device IDs**: Restrict access to specific devices
- **MFA Required**: Enforce multi-factor authentication
- **Liveness Required**: Require biometric liveness verification
- **Time Windows**: Allow access only during specific hours/days
- **Location Restrictions**: Country/region/city-based access control
- **Max Usage Count**: Limit number of times permission can be used

### Access Policies

- Conditional rules for all resource types
- Amount thresholds with MFA/approval requirements
- Risk score thresholds
- Time window restrictions
- Priority-based evaluation

### Delegations

- User-to-user permission delegation
- Time-limited delegation
- Conditional delegation
- Full revocation support

### Integration

- Full Permify ReBAC integration
- Circuit breaker for fail-closed behavior
- Prometheus metrics
- Dapr pubsub for audit events
- Redis for state management

## API Endpoints

**All endpoints require authentication** via `Authorization: Bearer <token>` header.

**Tenant admins** can only access their own tenant's data. **Platform admins** have full access.

### Temporal Grants

- `POST /api/v1/grants` - Create temporal grant (requires tenant admin)
- `GET /api/v1/grants/{grant_id}` - Get grant details (requires view permission)
- `DELETE /api/v1/grants/{grant_id}` - Revoke grant (requires revoke permission)
- `POST /api/v1/grants/{grant_id}/extend` - Extend grant (requires extend permission)
- `GET /api/v1/grants` - List grants (filtered by access)

### Access Policies

- `POST /api/v1/policies` - Create policy
- `GET /api/v1/policies/{policy_id}` - Get policy
- `PUT /api/v1/policies/{policy_id}` - Update policy
- `DELETE /api/v1/policies/{policy_id}` - Delete policy
- `GET /api/v1/policies` - List policies

### Permission Checks

- `POST /api/v1/check` - Check access

### Delegations

- `POST /api/v1/delegations` - Create delegation
- `DELETE /api/v1/delegations/{delegation_id}` - Revoke delegation
- `GET /api/v1/delegations` - List delegations
  (as Tenant Admin)

```bash
curl -X POST http://localhost:8080/api/v1/grants \
  -H "Authorization: Bearer user:admin_bank_001" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "bank_001
curl -X POST http://localhost:8080/api/v1/grants \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "54link",
    "subject_id": "user_123",
    "subject_type": "user",
    "permission": "view",
    "resource_type": "account",
    "resource_id": "acc_456",
    "duration": "30m",
    "reason": "Temporary access for audit review",
    "max_usage": 5,
    "conditions": {
      "require_mfa": true,
      "ip_whitelist": ["192.168.1.0/24"],
      "time_windows": [{
        "start_time": "09:00",
        "end_time": "17:00",
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "timezone": "Africa/Lagos"
      }]
    }
  }'
```

## Example: Check Access

```bash
curl -X POST http://localhost:8080/api/v1/check \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "54link",
    "subject_id": "user_123",
    "subject_type": "user",
    "permission": "view",
    "resource_type": "account",
    "resource_id": "acc_456",
    "context": {
      "ip_address": "192.168.1.100",
      "device_id": "device_abc",
      "mfa_verified": true,
      "timestamp": "2026-02-12T10:30:00Z"
    }
  }'
```

## Environment Variables

- `PORT` - Service port (default: 8080)
- `REDIS_ADDR` - Redis address (default: redis-master.banking.svc.cluster.local:6379)
- `REDIS_PASSWORD` - Redis password
- `PERMIFY_URL` - Permify URL (default: http://permify.banking.svc.cluster.local:3476)
- `DAPR_HTTP_PORT` - Dapr HTTP port (default: 3500)

## Metrics

Prometheus metrics available at `/metrics`:

- `temporal_access_grants_created_total`
- `temporal_access_grants_revoked_total`
- `temporal_access_grants_expired_total`
- `temporal_access_grant_checks_total`

## Documentation

- 📖 **[README.md](README.md)** - Service overview (this file)
- 👥 **[TENANT_ADMIN_GUIDE.md](TENANT_ADMIN_GUIDE.md)** - Complete guide for tenant administrators
- 🔐 **[TENANT_ADMIN_AUTHORIZATION.md](TENANT_ADMIN_AUTHORIZATION.md)** - Authorization implementation details
- 📚 **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - Integration guide for developers
- 📋 **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Complete implementation summary
- ⚡ **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick reference for common operations

## Quick Start for Tenant Admins

1. **Verify your admin status:**

   ```bash
   # Check if you're a tenant admin
   curl -X POST http://permify:3476/v1/permissions/check \
     -d '{"tenant_id":"bank_001","subject":{"type":"user","id":"YOUR_ID"},"permission":"manage","entity":{"type":"bank","id":"bank_001"}}'
   ```

2. **Create a temporary grant:**

   ```bash
   curl -X POST http://temporal-access-service:8080/api/v1/grants \
     -H "Authorization: Bearer user:YOUR_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "tenant_id": "bank_001",
       "subject_id": "user_auditor",
       "permission": "audit",
       "resource_type": "account",
       "resource_id": "acc_123",
       "duration": "4h"
     }'
   ```

3. **View grants for your tenant:**
   ```bash
   curl http://temporal-access-service:8080/api/v1/grants?tenant_id=bank_001 \
     -H "Authorization: Bearer user:YOUR_ID"
   ```

See [TENANT_ADMIN_GUIDE.md](TENANT_ADMIN_GUIDE.md) for complete documentation.

- `temporal_access_condition_checks_total`
- `temporal_access_permify_call_duration_seconds`

## Health Check

- `GET /health` - Health check endpoint
