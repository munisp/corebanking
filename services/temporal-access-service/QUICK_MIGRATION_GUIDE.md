# Quick Migration Guide: Adding Temporal Access to Existing Services

## Overview

This guide shows how to add temporal access control to your existing 54link microservice **in 3 simple steps**.

## Prerequisites

- Your service already uses Permify for base permissions
- APISIX gateway sets `x-keycloak-id` and `X-Tenant-ID` headers
- Your service runs in Kubernetes `banking` namespace

## Step 1: Add Client Library (5 minutes)

### Update go.mod

```bash
cd /services/your-service
go get temporal-access-service/client
```

### Initialize Client in main.go

```go
package main

import (
    temporal_access "temporal-access-service/client"
)

var temporalClient *temporal_access.TemporalAccessClient

func init() {
    // Add this to your service initialization
    temporalClient = temporal_access.NewTemporalAccessClient(temporal_access.Config{
        BaseURL:         getEnv("TEMPORAL_ACCESS_URL", "http://temporal-access-service.banking.svc.cluster.local:8080"),
        ServiceName:     "your-service-name",
        Timeout:         5 * time.Second,
        FailureBehavior: "closed", // Deny on error (recommended)
    })
}
```

## Step 2: Add Access Check to Endpoints (10 minutes)

### Before: Only Permify Check

```go
func (s *Service) getSensitiveData(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    resourceID := mux.Vars(r)["resource_id"]
    userID := r.Header.Get("x-keycloak-id")
    tenantID := r.Header.Get("X-Tenant-ID")

    // Only checking base permission
    allowed, _ := permifyClient.CheckPermission(
        ctx, tenantID, "user", userID, "view", "resource", resourceID,
    )

    if !allowed {
        http.Error(w, "Permission denied", 403)
        return
    }

    // Return data...
}
```

### After: Permify + Temporal Access

```go
func (s *Service) getSensitiveData(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    resourceID := mux.Vars(r)["resource_id"]
    userID := r.Header.Get("x-keycloak-id")
    tenantID := r.Header.Get("X-Tenant-ID")

    // 1. Check base permission (existing code)
    baseAllowed, _ := permifyClient.CheckPermission(
        ctx, tenantID, "user", userID, "view", "resource", resourceID,
    )

    if !baseAllowed {
        http.Error(w, "Permission denied", 403)
        return
    }

    // 2. NEW: Check temporal access
    accessCtx := temporal_access.ExtractAccessContext(
        r,
        r.Header.Get("X-MFA-Verified") == "true",
        r.Header.Get("X-Liveness-Verified") == "true",
    )

    accessResp, err := temporalClient.CheckAccess(ctx, &temporal_access.AccessCheckRequest{
        TenantID:     tenantID,
        SubjectID:    userID,
        SubjectType:  "user",
        Permission:   "view",
        ResourceType: "resource",
        ResourceID:   resourceID,
        Context:      accessCtx,
    })

    if err != nil || !accessResp.Allowed {
        reason := "Temporal access denied"
        if accessResp != nil {
            reason = accessResp.Reason
        }
        http.Error(w, reason, 403)
        return
    }

    // 3. Both checks passed - return data
    // ... existing code ...
}
```

**What changed:**

- Added 10 lines of code
- Extracted access context from request
- Called temporal access service
- Combined results with existing Permify check

## Step 3: Update Deployment Config (2 minutes)

### Add Environment Variables

**In your Kubernetes manifest or Helm values:**

```yaml
# deployment.yaml or values.yaml
env:
  - name: TEMPORAL_ACCESS_URL
    value: "http://temporal-access-service.banking.svc.cluster.local:8080"
  - name: TEMPORAL_ACCESS_TIMEOUT
    value: "5s"
```

## Real-World Examples

### Example 1: Loan Service (Gin Framework)

**File:** `services/loan-service/main.go`

```go
// Add to imports
import temporal_access "temporal-access-service/client"

// Add global variable
var temporalClient *temporal_access.TemporalAccessClient

// Add to init() or main()
func init() {
    temporalClient = temporal_access.NewTemporalAccessClient(temporal_access.Config{
        BaseURL:     "http://temporal-access-service.banking.svc.cluster.local:8080",
        ServiceName: "loan-service",
        Timeout:     5 * time.Second,
    })
}

// Update loan approval endpoint
func approveLoan(c *gin.Context) {
    loanID := c.Param("loan_id")
    userID := c.GetHeader("x-keycloak-id")
    tenantID := c.GetHeader("X-Tenant-ID")

    // Existing Permify check
    baseAllowed, _ := permifyClient.Check(
        c.Request.Context(), tenantID, "user", userID, "approve", "loan", loanID,
    )
    if !baseAllowed {
        c.JSON(403, gin.H{"error": "Permission denied"})
        return
    }

    // NEW: Temporal access check
    accessCtx := temporal_access.AccessContext{
        IPAddress:    c.ClientIP(),
        MFAVerified:  c.GetHeader("X-MFA-Verified") == "true",
        Timestamp:    time.Now(),
    }

    accessResp, err := temporalClient.CheckLoanAccess(
        c.Request.Context(), tenantID, userID, "approve", loanID, accessCtx,
    )

    if err != nil || !accessResp.Allowed {
        c.JSON(403, gin.H{"error": "Temporal access denied", "reason": accessResp.Reason})
        return
    }

    // Existing approval logic
    // ... approve loan ...
}
```

### Example 2: Transaction Service (Gorilla Mux)

**File:** `services/payment-processing-service/handlers.go`

```go
// Add temporal client
var temporalClient = temporal_access.NewTemporalAccessClient(temporal_access.Config{
    BaseURL:     "http://temporal-access-service.banking.svc.cluster.local:8080",
    ServiceName: "payment-processing-service",
})

func processPayment(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    userID := r.Header.Get("x-keycloak-id")
    tenantID := r.Header.Get("X-Tenant-ID")

    var payment PaymentRequest
    json.NewDecoder(r.Body).Decode(&payment)

    // Existing base permission check
    baseAllowed, _ := permifyClient.Check(
        ctx, tenantID, "user", userID, "transact", "account", payment.FromAccount,
    )
    if !baseAllowed {
        http.Error(w, "Permission denied", 403)
        return
    }

    // NEW: Temporal check with amount context (important!)
    accessCtx := temporal_access.ExtractAccessContext(
        r,
        r.Header.Get("X-MFA-Verified") == "true",
        false,
    )
    accessCtx.Amount = &payment.Amount      // Add amount for policy checks
    accessCtx.Currency = &payment.Currency

    accessResp, err := temporalClient.CheckAccountAccess(
        ctx, tenantID, userID, "transact", payment.FromAccount, accessCtx,
    )

    if err != nil || !accessResp.Allowed {
        http.Error(w, "Payment blocked: "+accessResp.Reason, 403)
        return
    }

    // Existing payment processing
    // ... process payment ...
}
```

### Example 3: Account Service (HTTP Handler)

**File:** `services/account-service/handlers/account.go`

```go
type AccountHandler struct {
    permifyClient  *PermifyClient
    temporalClient *temporal_access.TemporalAccessClient
    db             *sql.DB
}

func NewAccountHandler(db *sql.DB) *AccountHandler {
    return &AccountHandler{
        permifyClient: NewPermifyClient(),
        temporalClient: temporal_access.NewTemporalAccessClient(temporal_access.Config{
            BaseURL:     "http://temporal-access-service.banking.svc.cluster.local:8080",
            ServiceName: "account-service",
        }),
        db: db,
    }
}

func (h *AccountHandler) GetAccount(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    accountID := mux.Vars(r)["account_id"]
    userID := r.Header.Get("x-keycloak-id")
    tenantID := r.Header.Get("X-Tenant-ID")

    // Base permission
    baseAllowed, _ := h.permifyClient.CheckPermission(
        ctx, tenantID, "user", userID, "view", "account", accountID,
    )
    if !baseAllowed {
        http.Error(w, "Access denied", 403)
        return
    }

    // Temporal access
    accessCtx := temporal_access.ExtractAccessContext(r,
        r.Header.Get("X-MFA-Verified") == "true",
        r.Header.Get("X-Liveness-Verified") == "true",
    )

    accessResp, err := h.temporalClient.CheckAccountAccess(
        ctx, tenantID, userID, "view", accountID, accessCtx,
    )

    if err != nil || !accessResp.Allowed {
        http.Error(w, "Temporal access denied: "+accessResp.Reason, 403)
        return
    }

    // Get account
    account, err := h.db.GetAccount(ctx, accountID)
    if err != nil {
        http.Error(w, "Account not found", 404)
        return
    }

    json.NewEncoder(w).Encode(account)
}
```

## Common Patterns

### Pattern 1: Middleware Approach

Apply temporal access to all routes automatically:

```go
func temporalAccessMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Skip health/metrics
        if r.URL.Path == "/health" || r.URL.Path == "/metrics" {
            next.ServeHTTP(w, r)
            return
        }

        // Extract context
        userID := r.Header.Get("x-keycloak-id")
        tenantID := r.Header.Get("X-Tenant-ID")
        resourceID := mux.Vars(r)["resource_id"]

        if resourceID != "" {
            permission := getPermFromMethod(r.Method)
            accessCtx := temporal_access.ExtractAccessContext(r, true, false)

            accessResp, err := temporalClient.CheckAccess(r.Context(), &temporal_access.AccessCheckRequest{
                TenantID:     tenantID,
                SubjectID:    userID,
                Permission:   permission,
                ResourceType: "resource",
                ResourceID:   resourceID,
                Context:      accessCtx,
            })

            if err != nil || !accessResp.Allowed {
                http.Error(w, "Access denied", 403)
                return
            }
        }

        next.ServeHTTP(w, r)
    })
}

// Apply to router
router.Use(temporalAccessMiddleware)
```

### Pattern 2: Helper Function

Create a reusable authorization helper:

```go
func (s *Service) checkAccess(r *http.Request, permission, resourceType, resourceID string) error {
    ctx := r.Context()
    userID := r.Header.Get("x-keycloak-id")
    tenantID := r.Header.Get("X-Tenant-ID")

    // Base permission
    baseAllowed, err := s.permifyClient.Check(
        ctx, tenantID, "user", userID, permission, resourceType, resourceID,
    )
    if err != nil || !baseAllowed {
        return errors.New("base permission denied")
    }

    // Temporal access
    accessCtx := temporal_access.ExtractAccessContext(r, true, false)
    accessResp, err := s.temporalClient.CheckAccess(ctx, &temporal_access.AccessCheckRequest{
        TenantID:     tenantID,
        SubjectID:    userID,
        Permission:   permission,
        ResourceType: resourceType,
        ResourceID:   resourceID,
        Context:      accessCtx,
    })

    if err != nil || !accessResp.Allowed {
        return fmt.Errorf("temporal access denied: %s", accessResp.Reason)
    }

    return nil
}

// Use in handlers
func (s *Service) handler(w http.ResponseWriter, r *http.Request) {
    if err := s.checkAccess(r, "view", "account", "acc_123"); err != nil {
        http.Error(w, err.Error(), 403)
        return
    }

    // Process request...
}
```

## Deployment Checklist

Before deploying your updated service:

- [ ] Added temporal access client to code
- [ ] Updated all sensitive endpoints with temporal checks
- [ ] Added `TEMPORAL_ACCESS_URL` environment variable
- [ ] Tested with active temporal grant
- [ ] Tested with expired/revoked grant
- [ ] Tested with failed conditions (IP, MFA)
- [ ] Added Prometheus metrics for access checks
- [ ] Updated service documentation

## Testing Your Integration

### 1. Create a Test Grant

```bash
curl -X POST http://temporal-access-service:8080/api/v1/grants \
  -H "Authorization: Bearer user:admin_bank_001" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "bank_001",
    "subject_id": "user_test_123",
    "permission": "view",
    "resource_type": "account",
    "resource_id": "acc_test_456",
    "duration": "1h",
    "reason": "Integration testing"
  }'
```

### 2. Test Your Service Endpoint

```bash
curl http://your-service:8080/accounts/acc_test_456 \
  -H "x-keycloak-id: user_test_123" \
  -H "X-Tenant-ID: bank_001" \
  -H "X-MFA-Verified: true"

# Should return: 200 OK (grant is active)
```

### 3. Test After Grant Expires

```bash
# Wait for grant to expire or revoke it
curl -X DELETE http://temporal-access-service:8080/api/v1/grants/GRANT_ID

# Test again
curl http://your-service:8080/accounts/acc_test_456 \
  -H "x-keycloak-id: user_test_123" \
  -H "X-Tenant-ID: bank_001"

# Should return: 403 Forbidden (no active grant)
```

## Troubleshooting

### Service Can't Reach Temporal Access Service

**Check DNS:**

```bash
kubectl exec -it YOUR_POD -n banking -- nslookup temporal-access-service.banking.svc.cluster.local
```

**Check connectivity:**

```bash
kubectl exec -it YOUR_POD -n banking -- curl http://temporal-access-service.banking.svc.cluster.local:8080/health
```

### Getting "Temporal access denied" but grant exists

**Check grant status:**

```bash
curl http://temporal-access-service:8080/api/v1/grants?tenant_id=bank_001 \
  -H "Authorization: Bearer user:admin"
```

**Common issues:**

- Grant expired
- IP address not in whitelist
- MFA not verified but required
- Outside allowed time window

### Circuit Breaker Open

If you see "circuit breaker open" errors:

```go
// Check metrics
curl http://your-service:8080/metrics | grep temporal_access_circuit_breaker_state
```

**Causes:**

- Temporal access service down
- Too many failed requests
- Network issues

**Solution:**

- Check temporal access service health
- Wait for circuit breaker to reset (30s)
- Investigate root cause

## Summary

**Time to integrate:** ~15-20 minutes per service

**Steps:**

1. Add client library (5 min)
2. Update endpoints (10 min)
3. Deploy (2 min)

**Result:**
✅ Time-limited permissions
✅ Conditional access (IP, MFA, time windows)
✅ Centralized audit logs
✅ Fail-closed security
✅ Multi-tenant isolation

**Next:** See [SERVICE_INTEGRATION_FLOW.md](SERVICE_INTEGRATION_FLOW.md) for detailed flow diagrams
