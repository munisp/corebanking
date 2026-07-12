# Temporal Access Control Integration Guide

## Overview

This guide explains how to integrate the Temporal Access Service into your existing 54link banking microservices for conditional and time-limited authorization.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     APISIX Gateway                          │
│             (handles authentication)                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Your Microservice                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Extract request context (IP, MFA status, etc.)   │  │
│  │  2. Call Permify for base permission                 │  │
│  │  3. Call Temporal Access Service for conditions      │  │
│  │  4. Combine results: access = base AND temporal      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼────────┐           ┌──────────▼─────────┐
│    Permify     │           │ Temporal Access    │
│   (ReBAC)      │           │    Service         │
│                │           │                    │
│ • Base perms   │           │ • Time limits      │
│ • Hierarchies  │           │ • Conditions       │
│ • Relationships│           │ • Delegations      │
└────────────────┘           └────────┬───────────┘
                                      │
                             ┌────────▼────────┐
                             │     Redis       │
                             │  (Grant State)  │
                             └─────────────────┘
```

## Integration Steps

### Step 1: Add Client Library to Your Service

Add the temporal access client to your Go service:

```go
import (
    temporal_access "temporal-access-service/client"
)

// Initialize client
temporalClient := temporal_access.NewTemporalAccessClient(temporal_access.Config{
    BaseURL:         "http://temporal-access-service.banking.svc.cluster.local",
    ServiceName:     "account-service", // Your service name
    Timeout:         5 * time.Second,
    FailureBehavior: "closed", // Fail-closed = deny on error (recommended)
})
```

### Step 2: Update Permission Checks

**Before (Permify only):**

```go
func (s *AccountService) getAccount(w http.ResponseWriter, r *http.Request) {
    accountID := mux.Vars(r)["account_id"]
    userID := getUserID(r) // From JWT
    tenantID := getTenantID(r)

    // Check Permify only
    allowed := permifyClient.CheckPermission(
        ctx, tenantID, "user", userID, "view", "account", accountID,
    )

    if !allowed {
        http.Error(w, "Permission denied", http.StatusForbidden)
        return
    }

    // Return account...
}
```

**After (Permify + Temporal Access):**

```go
func (s *AccountService) getAccount(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    accountID := mux.Vars(r)["account_id"]
    userID := getUserID(r)
    tenantID := getTenantID(r)

    // 1. Check base permission with Permify
    baseAllowed := permifyClient.CheckPermission(
        ctx, tenantID, "user", userID, "view", "account", accountID,
    )

    if !baseAllowed {
        http.Error(w, "Permission denied: base policy", http.StatusForbidden)
        return
    }

    // 2. Check temporal/conditional access
    accessCtx := temporal_access.ExtractAccessContext(
        r,
        getMFAStatus(r),      // Extract from JWT or session
        getLivenessStatus(r), // Extract from JWT or session
    )

    accessResp, err := temporalClient.CheckAccountAccess(
        ctx, tenantID, userID, "view", accountID, accessCtx,
    )

    if err != nil || !accessResp.Allowed {
        reason := "temporal access denied"
        if accessResp != nil {
            reason = accessResp.Reason
        }
        http.Error(w, reason, http.StatusForbidden)
        return
    }

    // 3. Access granted - return account
    // ... return account data
}
```

### Step 3: Handle High-Value Transactions

For transactions, include amount in the access context:

```go
func (s *TransactionService) approveTransaction(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    txID := mux.Vars(r)["transaction_id"]
    userID := getUserID(r)
    tenantID := getTenantID(r)

    // Get transaction details
    tx := getTransaction(txID)

    // Check base permission
    baseAllowed := permifyClient.CheckPermission(
        ctx, tenantID, "user", userID, "approve", "transaction", txID,
    )

    if !baseAllowed {
        http.Error(w, "Permission denied", http.StatusForbidden)
        return
    }

    // Check temporal access with amount context
    accessCtx := temporal_access.ExtractAccessContext(r, getMFAStatus(r), false)

    accessResp, err := temporalClient.CheckTransactionAccess(
        ctx,
        tenantID,
        userID,
        "approve",
        txID,
        tx.Amount,    // Amount for policy evaluation
        tx.Currency,  // Currency
        accessCtx,
    )

    if err != nil || !accessResp.Allowed {
        // Might fail due to:
        // - No MFA but amount > 1M NGN (policy requirement)
        // - Outside business hours (time window policy)
        // - Risk score too high
        http.Error(w, accessResp.Reason, http.StatusForbidden)
        return
    }

    // Approve transaction...
}
```

### Step 4: Create Temporal Grants Programmatically

Services can create grants on behalf of users:

```go
// Example: Grant temporary audit access during investigation
func (s *AuditService) grantInvestigatorAccess(
    ctx context.Context,
    investigatorID, accountID string,
) error {
    grant, err := temporalClient.CreateGrantWithMFA(
        ctx,
        "54link",                    // tenant ID
        investigatorID,              // subject ID
        "audit",                     // permission
        "account",                   // resource type
        accountID,                   // resource ID
        "4h",                        // duration
        "Fraud investigation case #123",  // reason
        []string{"192.168.1.0/24"},  // IP whitelist
    )

    if err != nil {
        return fmt.Errorf("failed to create grant: %w", err)
    }

    log.Printf("Granted audit access to %s, expires at %s",
        investigatorID, grant.ExpiresAt)

    return nil
}
```

## Example Use Cases

### Use Case 1: Temporary Account Access for Auditor

An auditor needs temporary access to review specific accounts:

```bash
# Admin creates 8-hour grant with conditions
curl -X POST http://temporal-access-service/api/v1/grants \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "54link",
    "subject_id": "auditor_001",
    "subject_type": "user",
    "permission": "audit",
    "resource_type": "account",
    "resource_id": "acc_high_value_123",
    "duration": "8h",
    "reason": "Q4 2025 audit review",
    "max_usage": 20,
    "conditions": {
      "require_mfa": true,
      "ip_whitelist": ["10.0.1.0/24"],
      "time_windows": [{
        "start_time": "09:00",
        "end_time": "17:00",
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "timezone": "Africa/Lagos"
      }]
    }
  }'
```

**When auditor tries to access:**

- ✅ Within 8 hours
- ✅ From IP 10.0.1.50 (in whitelist)
- ✅ MFA verified
- ✅ Time is 10:30 AM on Wednesday
- ✅ Used 15 times (< 20 max)
- **Result: ACCESS GRANTED**

**If conditions fail:**

- ❌ After 8 hours → DENIED (grant expired)
- ❌ From IP 203.0.113.5 (not in whitelist) → DENIED
- ❌ MFA not verified → DENIED
- ❌ Time is 8:00 PM → DENIED (outside time window)
- ❌ Used 20 times already → DENIED (usage limit)

### Use Case 2: High-Value Transaction Policy

Create a policy requiring MFA for transactions > 1M NGN:

```bash
curl -X POST http://temporal-access-service/api/v1/policies \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "54link",
    "name": "High Value Transaction MFA",
    "description": "Require MFA for transactions exceeding 1M NGN",
    "resource_type": "transaction",
    "permission": "approve",
    "priority": 100,
    "enabled": true,
    "conditions": {
      "amount_threshold": {
        "currency": "NGN",
        "amount": 1000000,
        "operator": "gt"
      },
      "require_mfa": true,
      "require_approval": false
    }
  }'
```

**When user tries to approve 2M NGN transaction:**

- Base Permission: ✅ (user has `approve` permission)
- Policy Check:
  - Amount is 2M > 1M ✅
  - MFA required? Check user context
    - If MFA verified: ✅ **ACCESS GRANTED**
    - If MFA not verified: ❌ **ACCESS DENIED**

### Use Case 3: Manager Delegation During Vacation

A manager delegates approval permissions to their deputy:

```bash
curl -X POST http://temporal-access-service/api/v1/delegations \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "54link",
    "delegator_id": "manager_jane",
    "delegate_id": "deputy_john",
    "permissions": ["approve", "view", "edit"],
    "resource_type": "loan",
    "resource_id": "",
    "duration": "7d",
    "justification": "On vacation from Feb 12-19, 2026",
    "conditions": {
      "require_mfa": true,
      "time_windows": [{
        "start_time": "08:00",
        "end_time": "18:00",
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "timezone": "Africa/Lagos"
      }]
    }
  }'
```

**During the 7-day period:**

- `deputy_john` can approve loans (normally only `manager_jane` can)
- Only during business hours (8 AM - 6 PM, Mon-Fri)
- Only with MFA verification
- Empty `resource_id` means ALL loans

## Monitoring & Metrics

Monitor these Prometheus metrics:

```promql
# Total access checks by service and result
sum(rate(temporal_access_checks_total[5m])) by (service, result)

# Failed condition checks (security concern!)
sum(rate(temporal_access_condition_checks_total{result="failed"}[5m])) by (condition_type)

# Grant creation rate (unusual spikes?)
rate(temporal_access_grants_created_total[5m])

# Circuit breaker trips (Permify unavailable?)
changes(temporal_access_permify_call_duration_seconds_count[5m]) > 0
```

## Migration Checklist

- [ ] Deploy temporal-access-service (see `deploy-temporal-access.sh`)
- [ ] Apply enhanced Permify schema
- [ ] Add temporal access client to service
- [ ] Update permission check logic
- [ ] Extract access context from requests (IP, MFA, etc.)
- [ ] Test with temporal grants
- [ ] Create initial access policies
- [ ] Monitor metrics
- [ ] Train admins on dashboard usage
- [ ] Update incident response procedures

## Common Patterns

### Pattern: Service-to-Service with Service Account

```go
// Service account gets long-lived grant
grant, _ := temporalClient.CreateGrant(ctx, temporal_access.CreateGrantRequest{
    TenantID:     "54link",
    SubjectID:    "svc_reporting",
    SubjectType:  "service_account",
    Permission:   "read",
    ResourceType: "account",
    ResourceID:   "",  // All accounts
    Duration:     "30d",
    Reason:       "Monthly reporting job",
})
```

### Pattern: Break-Glass Emergency Access

```go
// Admin creates short-lived, heavily audited grant
grant, _ := temporalClient.CreateGrant(ctx, temporal_access.CreateGrantRequest{
    TenantID:     "54link",
    SubjectID:    "admin_emergency",
    SubjectType:  "user",
    Permission:   "manage",
    ResourceType: "account",
    ResourceID:   "acc_frozen_123",
    Duration:     "15m",
    Reason:       "EMERGENCY: Unfreeze account for medical payment",
    MaxUsage:     1,  // One-time use
    Conditions: &temporal_access.AccessConditions{
        RequireMFA:      true,
        RequireLiveness: true,  // Biometric verification
    },
})
```

### Pattern: Graduated Access (Progressive Trust)

```go
// New employee starts with limited access
grant1, _ := temporalClient.CreateGrant(..., "view", ..., "7d", ...)

// After training, escalate to edit
grant2, _ := temporalClient.CreateGrant(..., "edit", ..., "30d", ...)

// After probation, grant permanent via base Permify permissions
permifyClient.WriteRelationship(..., "editor", ...)
```

## Troubleshooting

**Issue: Access denied despite having base permission**

- Check if temporal grant exists: `GET /api/v1/grants?subject_id=USER_ID`
- Check failed conditions in response: `failed_conditions: ["mfa_required"]`
- Check audit log: `GET /api/v1/audit?event_type=access_check`

**Issue: Grant not expiring**

- Check Redis TTL: `kubectl exec redis-master-0 -- redis-cli TTL grant:54link:GRANT_ID`
- Check cleanup job logs: `kubectl logs -l app=temporal-access-service | grep cleanup`

**Issue: Permify circuit breaker open**

- Check Permify health: `kubectl get pods -l app=permify`
- Check metrics: `temporal_access_permify_call_duration_seconds`
- Service will fail-closed (deny access) for safety

## Security Considerations

1. **Fail-Closed by Default**: Service denies access if temporal access service is unreachable
2. **Audit Everything**: All grants, checks, and revocations are logged
3. **Minimal Grants**: Create shortest-duration grants possible
4. **Condition Layering**: Combine IP + MFA + time windows for sensitive operations
5. **Regular Reviews**: Audit active grants weekly
6. **Automated Cleanup**: Expired grants are auto-removed from Permify

## Support

For questions or issues:

- Slack: #temporal-access-support
- Docs: https://docs.54link.com/temporal-access
- Runbook: [TEMPORAL_ACCESS_RUNBOOK.md](./TEMPORAL_ACCESS_RUNBOOK.md)
