# Tenant Admin Guide - Temporal Access Control

## Overview

This guide explains how **tenant administrators** (bank admins) use the temporal access control system to manage conditional and time-limited permissions within their organization.

## Tenant Admin Permissions

### What Can Tenant Admins Do?

As a tenant admin (bank admin), you can:

✅ **Create temporal grants** for users in your tenant/bank
✅ **View all grants** within your tenant
✅ **Revoke any grant** in your tenant (even if created by others)
✅ **Extend grants** within your tenant
✅ **Create and manage access policies** for your tenant
✅ **View delegation delegations** within your tenant
✅ **Monitor audit logs** for your tenant's access activities

### What Can't Tenant Admins Do?

❌ Create grants for users in **other tenants/banks**
❌ View or modify grants in **other tenants/banks**
❌ Access platform-level administration features (reserved for platform admins)

## Authorization Model

### Hierarchy

```
Platform Admin (platform.admin)
    ├─ Can manage ALL tenants
    └─ Super admin access

Tenant Admin (bank.admin)
    ├─ Can manage only their tenant
    ├─ Full control over their tenant's grants/policies
    └─ Cannot access other tenants

Grant Grantor (creator of specific grant)
    ├─ Can view/revoke/extend their own grants
    └─ Cannot modify other users' grants

Grant Grantee (recipient of grant)
    └─ Can view grants they received
```

### Permify Schema Integration

The system uses Permify's ReBAC model:

```permify
entity bank {
  relation admin: user
  relation manager: user
  relation employee: user

  permission manage = admin or platform.admin
}

entity temporal_grant {
  relation tenant: bank
  relation grantor: user
  relation grantee: user

  permission view = grantee or grantor or tenant.admin
  permission revoke = grantor or tenant.admin
  permission extend = grantor or tenant.admin
}
```

## Getting Started as Tenant Admin

### 1. Verify Your Admin Status

Check if you have tenant admin permissions:

```bash
curl -X POST https://api.54link.com/api/permify/v1/permissions/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "bank_001",
    "subject": {
      "type": "user",
      "id": "user_123"
    },
    "permission": "manage",
    "entity": {
      "type": "bank",
      "id": "bank_001"
    }
  }'
```

Expected response for admin:

```json
{
  "allowed": true
}
```

### 2. Access the Admin Dashboard

Navigate to your admin dashboard:

```
https://admin.54link.com/temporal-access
```

The dashboard automatically scopes to your tenant.

### 3. Grant Management Workflow

#### Create a Temporal Grant

**Scenario:** Grant auditor temporary account access for 4 hours

1. Click "Create Grant" in the Temporal Grants tab
2. Fill in the form:
   ```
   Tenant ID: bank_001 (auto-selected)
   Subject ID: user_auditor_456
   Subject Type: user
   Resource Type: account
   Resource ID: acc_789
   Permission: audit
   Duration: 4h
   Reason: Q4 2025 compliance audit
   ```
3. Add conditions:
   ```
   ✓ Require MFA
   ✓ IP Whitelist: 192.168.100.0/24 (office network)
   ✓ Time Window: 09:00-17:00 Mon-Fri Africa/Lagos
   ```
4. Click "Create Grant"

**Via API:**

```bash
curl -X POST https://api.54link.com/api/temporal-access/grants \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "bank_001",
    "subject_id": "user_auditor_456",
    "subject_type": "user",
    "permission": "audit",
    "resource_type": "account",
    "resource_id": "acc_789",
    "duration": "4h",
    "reason": "Q4 2025 compliance audit",
    "conditions": {
      "require_mfa": true,
      "ip_whitelist": ["192.168.100.0/24"],
      "time_windows": [{
        "start_time": "09:00",
        "end_time": "17:00",
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "timezone": "Africa/Lagos"
      }]
    }
  }'
```

#### Revoke a Grant

Revoke a grant immediately (e.g., employee terminated):

```bash
curl -X DELETE https://api.54link.com/api/temporal-access/grants/GRANT_ID?tenant_id=bank_001 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Employee terminated"
  }'
```

#### Extend a Grant

Extend an existing grant by 2 hours:

```bash
curl -X POST https://api.54link.com/api/temporal-access/grants/GRANT_ID/extend?tenant_id=bank_001 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "additional_duration": "2h",
    "reason": "Audit taking longer than expected"
  }'
```

## Common Use Cases for Tenant Admins

### Use Case 1: Temporary Auditor Access

**Requirement:** External auditor needs read-only access to all accounts for 1 week

```json
{
  "tenant_id": "bank_001",
  "subject_id": "user_external_auditor",
  "subject_type": "user",
  "permission": "view",
  "resource_type": "account",
  "resource_id": "*",
  "duration": "7d",
  "reason": "Annual external audit",
  "conditions": {
    "require_mfa": true,
    "ip_whitelist": ["203.0.113.0/24"],
    "time_windows": [
      {
        "start_time": "08:00",
        "end_time": "18:00",
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "timezone": "Africa/Lagos"
      }
    ]
  }
}
```

### Use Case 2: Emergency Override

**Requirement:** Branch manager needs emergency withdrawal approval for 30 minutes

```json
{
  "tenant_id": "bank_001",
  "subject_id": "user_branch_mgr_789",
  "subject_type": "user",
  "permission": "approve",
  "resource_type": "transaction",
  "resource_id": "txn_emergency_123",
  "duration": "30m",
  "reason": "Emergency medical withdrawal - customer in hospital",
  "max_usage": 1,
  "conditions": {
    "require_mfa": true,
    "require_liveness": true,
    "amount_threshold": {
      "max": 500000,
      "currency": "NGN"
    }
  }
}
```

### Use Case 3: Vacation Delegation

**Requirement:** Manager on vacation delegates approvals to team lead for 2 weeks

```bash
curl -X POST https://api.54link.com/api/temporal-access/delegations \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "bank_001",
    "delegator_id": "user_manager_456",
    "delegate_id": "user_team_lead_789",
    "permissions": ["approve_loan", "approve_transaction"],
    "resource_type": "loan",
    "resource_id": "*",
    "start_time": "2026-03-01T00:00:00Z",
    "end_time": "2026-03-15T23:59:59Z",
    "reason": "Manager vacation - March 1-15",
    "conditions": {
      "time_windows": [{
        "start_time": "09:00",
        "end_time": "17:00",
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "timezone": "Africa/Lagos"
      }]
    }
  }'
```

## Access Policies for Tenant Admins

### Create a High-Value Transaction Policy

Require MFA for all transactions above ₦1,000,000:

```bash
curl -X POST https://api.54link.com/api/temporal-access/policies \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "bank_001",
    "name": "High-Value Transaction MFA Policy",
    "description": "Require MFA for transactions above 1M NGN",
    "resource_type": "transaction",
    "permission": "approve",
    "conditions": {
      "require_mfa": true,
      "amount_threshold": {
        "min": 1000000,
        "currency": "NGN"
      }
    },
    "priority": 100,
    "enabled": true
  }'
```

### Business Hours Only Policy

Restrict account modifications to business hours:

```json
{
  "tenant_id": "bank_001",
  "name": "Business Hours Only - Account Modifications",
  "resource_type": "account",
  "permission": "edit",
  "conditions": {
    "time_windows": [
      {
        "start_time": "08:00",
        "end_time": "17:00",
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "timezone": "Africa/Lagos"
      }
    ]
  },
  "priority": 50,
  "enabled": true
}
```

## Monitoring & Audit Logs

### View All Grants for Your Tenant

```bash
curl https://api.54link.com/api/temporal-access/grants?tenant_id=bank_001 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### View Audit Logs

```bash
curl https://api.54link.com/api/temporal-access/audit?tenant_id=bank_001&limit=100 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Filter by event type:

```bash
curl https://api.54link.com/api/temporal-access/audit?tenant_id=bank_001&event_type=grant_created \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Prometheus Metrics for Your Tenant

Query grants created in your tenant:

```promql
temporal_access_grants_created_total{tenant_id="bank_001"}
```

Failed condition checks (security alerts):

```promql
rate(temporal_access_condition_checks_total{tenant_id="bank_001", result="denied"}[5m])
```

## Security Best Practices for Tenant Admins

### 1. Principle of Least Privilege

✅ **DO:**

- Grant minimum necessary permissions
- Use shortest possible duration
- Set specific resource IDs (avoid wildcards)

❌ **DON'T:**

- Grant broad permissions like `manage` unless absolutely necessary
- Use long durations (30d+) without strong justification
- Allow wildcard access (`resource_id: "*"`) for sensitive operations

### 2. Multi-Factor Authentication

✅ **DO:**

- Always require MFA for high-value transactions
- Require MFA for sensitive operations (approve, manage)
- Combine MFA with IP whitelisting

❌ **DON'T:**

- Allow emergency overrides without MFA
- Disable MFA for convenience

### 3. Condition Stacking

Combine multiple conditions for defense-in-depth:

```json
{
  "conditions": {
    "require_mfa": true,
    "ip_whitelist": ["192.168.1.0/24"],
    "time_windows": [{ "start_time": "09:00", "end_time": "17:00" }],
    "max_usage": 5
  }
}
```

### 4. Regular Audits

**Weekly:** Review active grants

```bash
curl https://api.54link.com/api/temporal-access/grants?tenant_id=bank_001&status=active
```

**Daily:** Check for unusual patterns

- Grants created outside business hours
- High number of failed condition checks
- Grants with long durations

**Monthly:** Review and clean up policies

### 5. Immediate Revocation

Revoke grants immediately when:

- Employee leaves the organization
- Grant purpose is fulfilled
- Security incident detected
- Suspicious activity observed

## Troubleshooting

### Issue: "Forbidden: User is not authorized"

**Cause:** You're not a tenant admin for the specified tenant

**Solution:** Verify your admin status:

```bash
# Check your role
curl -X POST https://api.54link.com/api/permify/v1/permissions/check \
  -d '{"tenant_id":"bank_001","subject":{"type":"user","id":"YOUR_USER_ID"},"permission":"manage","entity":{"type":"bank","id":"bank_001"}}'
```

### Issue: Grant Not Working Despite Being Active

**Checklist:**

1. ✓ Check grant hasn't expired: `expires_at > now()`
2. ✓ Verify conditions are met (IP, MFA, time window)
3. ✓ Check usage count: `current_usage < max_usage`
4. ✓ View audit log for failed checks

### Issue: Can't View Another User's Grant

**Cause:** You can only view grants where you are:

- The grantor (creator)
- The grantee (recipient)
- A tenant admin for that tenant

**Solution:** Use admin API to list all grants in your tenant

## API Reference for Tenant Admins

### Authentication

All requests require:

```
Authorization: Bearer <your_token>
```

Your token must have `bank.admin` permission for the tenant.

### Endpoints

| Method   | Endpoint                                        | Description       |
| -------- | ----------------------------------------------- | ----------------- |
| `POST`   | `/api/temporal-access/grants`                   | Create grant      |
| `GET`    | `/api/temporal-access/grants?tenant_id={id}`    | List grants       |
| `GET`    | `/api/temporal-access/grants/{grant_id}`        | Get grant details |
| `DELETE` | `/api/temporal-access/grants/{grant_id}`        | Revoke grant      |
| `POST`   | `/api/temporal-access/grants/{grant_id}/extend` | Extend grant      |
| `POST`   | `/api/temporal-access/policies`                 | Create policy     |
| `GET`    | `/api/temporal-access/policies?tenant_id={id}`  | List policies     |
| `POST`   | `/api/temporal-access/delegations`              | Create delegation |
| `GET`    | `/api/temporal-access/audit?tenant_id={id}`     | View audit logs   |

## Support

- **Slack:** #tenant-admin-support
- **Email:** tenant-support@54link.com
- **Documentation:** https://docs.54link.com/temporal-access/tenant-admin
- **Emergency:** +234-XXX-XXXX-XXX

## Compliance Notes

### Data Residency

All temporal grant data is stored in Redis within your tenant namespace:

```
grant:{tenant_id}:{grant_id}
```

### Audit Trail

All grant operations are logged with:

- Actor ID (who performed the action)
- Timestamp
- IP address
- User agent
- Operation details

Audit logs are retained for **7 years** for compliance.

### GDPR/NDPR Compliance

When a user requests data deletion:

1. List all grants for the user
2. Revoke active grants
3. Archive (don't delete) grant history for audit compliance
4. Anonymize user_id in stored grants

Contact compliance team for user deletion procedures.
