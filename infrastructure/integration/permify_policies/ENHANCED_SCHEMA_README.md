# Enhanced Permify Schema Documentation

## Overview

This enhanced schema extends the base 54link banking platform authorization model with:

- Temporal access grants (time-limited permissions)
- Conditional access policies
- User-to-user permission delegation
- Multi-level approval workflows

## Entity Hierarchy

```
platform
  └── bank
      ├── branch
      │   └── employees (teller, customer_service, manager)
      ├── customer
      ├── account
      │   ├── transaction
      │   └── card
      ├── loan
      ├── temporal_grant (NEW)
      ├── access_policy (NEW)
      └── delegation (NEW)
```

## New Entities

### temporal_grant

Represents time-limited permission grants.

**Relations:**

- `tenant`: Bank that owns this grant
- `grantor`: User who created the grant
- `grantee`: User receiving temporary permission
- `resource`: Resource being accessed (account, transaction, etc.)

**Permissions:**

- `view`: Grantee, grantor, or bank admin can view the grant
- `use`: Only grantee can use the grant
- `revoke`: Grantor or bank admin can revoke
- `extend`: Grantor or bank admin can extend duration

**Application-Layer Attributes:**

- `permission`: The permission being granted (e.g., "view", "transact")
- `expires_at`: When the grant expires
- `conditions`: JSON object with IP whitelist, MFA requirements, etc.
- `max_usage`: Maximum number of times grant can be used
- `current_usage`: Number of times grant has been used

### access_policy

Conditional access rules enforced platform-wide.

**Relations:**

- `tenant`: Bank that owns this policy
- `creator`: User who created the policy
- `resource_type`: Type of resource this applies to

**Permissions:**

- `view`: Creator or bank admin
- `edit`: Creator or bank admin
- `delete`: Creator or bank admin
- `enforce`: Bank admin only

**Application-Layer Attributes:**

- `permission`: Permission this policy applies to
- `conditions`: Amount thresholds, time windows, risk scores, etc.
- `priority`: Evaluation priority (higher = evaluated first)
- `enabled`: Whether policy is active

### delegation

User-to-user permission delegation.

**Relations:**

- `tenant`: Bank that owns this delegation
- `delegator`: User delegating their permission
- `delegate`: User receiving the permission
- `resource`: Resource being delegated

**Permissions:**

- `view`: Delegator, delegate, or bank admin
- `use`: Only delegate can use
- `revoke`: Delegator or bank admin

**Application-Layer Attributes:**

- `permissions`: Array of permissions being delegated
- `start_time`: When delegation becomes active
- `end_time`: When delegation expires
- `conditions`: IP restrictions, MFA requirements, etc.
- `status`: active, revoked, or expired

## Integration with Temporal Access Service

The Permify schema defines WHAT permissions exist and WHO can use them.
The Temporal Access Service enforces WHEN, WHERE, and UNDER WHAT CONDITIONS they can be used.

### Flow Example: 30-minute Account Access

1. **Create Grant** (via API):

   ```json
   {
     "subject_id": "user_123",
     "permission": "view",
     "resource_type": "account",
     "resource_id": "acc_456",
     "duration": "30m",
     "conditions": {
       "require_mfa": true,
       "ip_whitelist": ["192.168.1.0/24"]
     }
   }
   ```

2. **Temporal Access Service**:
   - Stores grant in Redis with 30-minute TTL
   - Writes relationship to Permify:
     ```
     account:acc_456#view@user:user_123
     ```

3. **Access Check**:
   - User requests access
   - Service checks Permify for base permission
   - Service evaluates temporal grant conditions:
     - ✓ Grant not expired (< 30 minutes)
     - ✓ MFA verified
     - ✓ IP in whitelist (192.168.1.0/24)
   - Access ALLOWED

4. **Expiration**:
   - After 30 minutes, Redis TTL expires
   - Background cleanup job removes relationship from Permify
   - Future access checks DENIED

## Conditional Access Patterns

### Pattern 1: High-Value Transaction Approval

```json
{
  "name": "High Value MFA Policy",
  "resource_type": "transaction",
  "permission": "approve",
  "conditions": {
    "amount_threshold": {
      "currency": "NGN",
      "amount": 1000000,
      "operator": "gt"
    },
    "require_mfa": true,
    "require_approval": true,
    "approver_roles": ["senior_manager", "admin"]
  }
}
```

### Pattern 2: Business Hours Only

```json
{
  "name": "Business Hours Policy",
  "resource_type": "account",
  "permission": "transact",
  "conditions": {
    "allowed_time_windows": [
      {
        "start_time": "09:00",
        "end_time": "17:00",
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "timezone": "Africa/Lagos"
      }
    ]
  }
}
```

### Pattern 3: Delegation with Constraints

```json
{
  "delegator_id": "manager_123",
  "delegate_id": "teller_456",
  "permissions": ["view", "edit"],
  "resource_type": "account",
  "duration": "4h",
  "conditions": {
    "device_ids": ["device_abc"],
    "require_mfa": false,
    "max_usage_count": 10
  },
  "justification": "Covering lunch break shift"
}
```

## ReBAC (Relationship-Based Access Control) Advantages

1. **Hierarchical Permissions**: Bank admins inherit all permissions
2. **Resource Ownership**: Account owners have natural access
3. **Contextual Access**: Branch managers can access branch resources
4. **Temporal Layers**: Time-limited grants augment base permissions
5. **Multi-Tenant Isolation**: Bank-scoped entity IDs prevent cross-tenant access

## Migration from Existing Systems

Existing services should:

1. Call Permify for base permission check
2. Call Temporal Access Service for conditional/temporal checks
3. Log all access decisions for audit

Example integration:

```go
// Check base permission
baseAllowed := permifyClient.CheckPermission(ctx, tenantID, "user", userID, "view", "account", accountID)

// Check temporal/conditional access
accessResp := temporalAccessClient.CheckAccess(ctx, AccessCheckRequest{
    TenantID: tenantID,
    SubjectID: userID,
    Permission: "view",
    ResourceType: "account",
    ResourceID: accountID,
    Context: &AccessContext{
        IPAddress: clientIP,
        MFAVerified: mfaVerified,
        // ...
    },
})

return baseAllowed && accessResp.Allowed
```

## Metrics & Monitoring

Prometheus metrics exposed:

- `temporal_access_grants_created_total{tenant_id, permission}`
- `temporal_access_grants_expired_total{tenant_id}`
- `temporal_access_condition_checks_total{condition_type, result}`
- `temporal_access_permify_call_duration_seconds{operation}`

Track these for:

- Unusual grant creation patterns
- Failed condition checks (potential security issues)
- Permify circuit breaker trips
