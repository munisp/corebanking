# Service Integration - Complete Flow Diagram

## How Temporal Access Works with Other Services

### Complete Request Flow

```
┌─────────────┐
│   Client    │
│ (Web/Mobile)│
└──────┬──────┘
       │
       │ 1. Request with JWT token
       │    Authorization: Bearer eyJhbGc...
       ▼
┌──────────────────────────────────────────────────────────┐
│                    APISIX Gateway                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │  • Validates JWT token                             │  │
│  │  • Extracts user_id, tenant_id, mfa_status         │  │
│  │  • Adds headers: x-keycloak-id, X-Tenant-ID           │  │
│  │  • Routes to appropriate service                   │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐     ┌──────────────┐
│Account      │      │Transaction  │     │Loan          │
│Service      │      │Service      │     │Service       │
│             │      │             │     │              │
│Port 8080    │      │Port 8081    │     │Port 8011     │
└──────┬──────┘      └──────┬──────┘     └──────┬───────┘
       │                    │                    │
       │ 2. Each service extracts headers        │
       │    x-keycloak-id: user_123                  │
       │    X-Tenant-ID: bank_001                │
       │    X-MFA-Verified: true                 │
       │                    │                    │
       │ 3. Check base permission with Permify   │
       └────────────────────┼────────────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                     Permify                             │
│  Check: user_123 has "view" on account_456?            │
│  Result: ✓ Yes (user is account owner)                 │
└─────────────────────────────────────────────────────────┘
       │
       │ 4. If base permission OK, check temporal access
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│            Temporal Access Service                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │ POST /api/v1/check                                │  │
│  │ {                                                 │  │
│  │   "tenant_id": "bank_001",                        │  │
│  │   "subject_id": "user_123",                       │  │
│  │   "permission": "view",                           │  │
│  │   "resource_type": "account",                     │  │
│  │   "resource_id": "acc_456",                       │  │
│  │   "context": {                                    │  │
│  │     "ip_address": "192.168.1.100",                │  │
│  │     "mfa_verified": true,                         │  │
│  │     "timestamp": "2026-02-12T14:30:00Z"           │  │
│  │   }                                               │  │
│  │ }                                                 │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  1. Check Redis for active grants                      │
│  2. Check if grant expired                             │
│  3. Evaluate conditions:                               │
│     ✓ IP: 192.168.1.100 in whitelist                   │
│     ✓ MFA: verified = true                             │
│     ✓ Time: within business hours                      │
│  4. Return: { "allowed": true }                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ Result: allowed=true
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Account Service                            │
│  • Base permission: ✓ Allowed                           │
│  • Temporal access: ✓ Allowed                           │
│  • Final decision: ALLOW                                │
│  • Return account data to client                        │
└─────────────────────────────────────────────────────────┘
```

## Header Propagation

### 1. Client → APISIX

**Client Request:**

```http
GET /api/accounts/acc_456
Host: api.54link.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidXNlcl8xMjMiLCJ0ZW5hbnRfaWQiOiJiYW5rXzAwMSIsIm1mYV92ZXJpZmllZCI6dHJ1ZX0...
```

### 2. APISIX → Account Service

**APISIX adds headers:**

```http
GET /accounts/acc_456
Host: account-service.banking.svc.cluster.local:8080
x-keycloak-id: user_123
X-Tenant-ID: bank_001
X-MFA-Verified: true
X-Liveness-Verified: false
X-Device-ID: device_abc123
X-Client-IP: 192.168.1.100
X-Original-Token: eyJhbGci...
```

### 3. Account Service → Temporal Access Service

**Account service makes temporal check:**

```http
POST /api/v1/check
Host: temporal-access-service.banking.svc.cluster.local:8080
Content-Type: application/json

{
  "tenant_id": "bank_001",
  "subject_id": "user_123",
  "subject_type": "user",
  "permission": "view",
  "resource_type": "account",
  "resource_id": "acc_456",
  "context": {
    "ip_address": "192.168.1.100",
    "device_id": "device_abc123",
    "mfa_verified": true,
    "liveness_verified": false,
    "timestamp": "2026-02-12T14:30:00Z"
  }
}
```

### 4. Temporal Access Service Response

```json
{
  "allowed": true,
  "reason": "",
  "matched_grant": {
    "grant_id": "grant_xyz789",
    "expires_at": "2026-02-12T18:30:00Z",
    "created_by": "admin_bank_001"
  },
  "conditions_checked": ["ip_whitelist", "mfa_required", "time_window"],
  "timestamp": "2026-02-12T14:30:01Z"
}
```

## Practical Integration Examples

### Example 1: Loan Service Integration

**File:** `/services/loan-service/main.go`

```go
package main

import (
    "context"
    "github.com/gin-gonic/gin"
    temporal_access "temporal-access-service/client"
)

var temporalClient *temporal_access.TemporalAccessClient

func init() {
    // Initialize temporal access client
    temporalClient = temporal_access.NewTemporalAccessClient(temporal_access.Config{
        BaseURL:         "http://temporal-access-service.banking.svc.cluster.local:8080",
        ServiceName:     "loan-service",
        Timeout:         5 * time.Second,
        FailureBehavior: "closed",
    })
}

// Approve loan - requires temporal access check
func approveLoan(c *gin.Context) {
    loanID := c.Param("loan_id")
    userID := c.GetHeader("x-keycloak-id")
    tenantID := c.GetHeader("X-Tenant-ID")

    // 1. Check base permission (Permify)
    baseAllowed, err := permifyClient.Check(
        c.Request.Context(),
        tenantID, "user", userID, "approve", "loan", loanID,
    )

    if err != nil || !baseAllowed {
        c.JSON(403, gin.H{"error": "Permission denied"})
        return
    }

    // Get loan details for amount check
    loan, _ := db.GetLoan(c.Request.Context(), loanID)

    // 2. Check temporal access with amount context
    accessCtx := temporal_access.AccessContext{
        IPAddress:       c.ClientIP(),
        DeviceID:        c.GetHeader("X-Device-ID"),
        MFAVerified:     c.GetHeader("X-MFA-Verified") == "true",
        LivenessVerified: c.GetHeader("X-Liveness-Verified") == "true",
        Timestamp:       time.Now(),
        Amount:          &loan.Amount,
        Currency:        &loan.Currency,
    }

    accessResp, err := temporalClient.CheckLoanAccess(
        c.Request.Context(),
        tenantID,
        userID,
        "approve",
        loanID,
        accessCtx,
    )

    if err != nil || !accessResp.Allowed {
        c.JSON(403, gin.H{
            "error": "Temporal access denied",
            "reason": accessResp.Reason,
        })
        return
    }

    // 3. Access granted - approve loan
    if err := db.ApproveLoan(c.Request.Context(), loanID, userID); err != nil {
        c.JSON(500, gin.H{"error": "Approval failed"})
        return
    }

    c.JSON(200, gin.H{"message": "Loan approved", "loan_id": loanID})
}

func main() {
    router := gin.Default()
    router.POST("/loans/:loan_id/approve", approveLoan)
    router.Run(":8011")
}
```

### Example 2: Transaction Service Integration

**File:** `/services/payment-processing-service/main.go`

```go
package main

import (
    "context"
    "github.com/gorilla/mux"
    temporal_access "temporal-access-service/client"
)

var temporalClient *temporal_access.TemporalAccessClient

func init() {
    temporalClient = temporal_access.NewTemporalAccessClient(temporal_access.Config{
        BaseURL:         "http://temporal-access-service.banking.svc.cluster.local:8080",
        ServiceName:     "payment-processing-service",
        Timeout:         5 * time.Second,
        FailureBehavior: "closed",
    })
}

// Process high-value payment with temporal access check
func processPayment(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    userID := r.Header.Get("x-keycloak-id")
    tenantID := r.Header.Get("X-Tenant-ID")

    var payment struct {
        FromAccount string  `json:"from_account"`
        ToAccount   string  `json:"to_account"`
        Amount      float64 `json:"amount"`
        Currency    string  `json:"currency"`
    }

    json.NewDecoder(r.Body).Decode(&payment)

    // 1. Base permission check
    baseAllowed, _ := permifyClient.Check(
        ctx, tenantID, "user", userID, "transact", "account", payment.FromAccount,
    )

    if !baseAllowed {
        http.Error(w, "Permission denied", 403)
        return
    }

    // 2. Temporal access check with amount (critical for high-value)
    accessCtx := temporal_access.AccessContext{
        IPAddress:       r.Header.Get("X-Client-IP"),
        DeviceID:        r.Header.Get("X-Device-ID"),
        MFAVerified:     r.Header.Get("X-MFA-Verified") == "true",
        LivenessVerified: r.Header.Get("X-Liveness-Verified") == "true",
        Timestamp:       time.Now(),
        Amount:          &payment.Amount,
        Currency:        &payment.Currency,
    }

    // If amount > $10,000, policy will require MFA
    accessResp, err := temporalClient.CheckTransactionAccess(
        ctx,
        tenantID,
        userID,
        "approve",
        payment.FromAccount,
        accessCtx,
    )

    if err != nil || !accessResp.Allowed {
        // Denied - could be:
        // - MFA not verified for high amount
        // - Outside allowed time window
        // - IP not whitelisted
        // - Grant expired
        http.Error(w, "Payment blocked: "+accessResp.Reason, 403)
        return
    }

    // 3. Process payment
    txn, err := db.ProcessPayment(ctx, payment.FromAccount, payment.ToAccount, payment.Amount)
    if err != nil {
        http.Error(w, "Payment failed", 500)
        return
    }

    json.NewEncoder(w).Encode(txn)
}
```

## Sequence Diagram: Complete Flow

```
Client        APISIX       Account-Svc    Permify    Temporal-Svc    Redis
  │              │               │            │            │            │
  │─GET /accounts/acc_456──────>│            │            │            │
  │  + JWT token │               │            │            │            │
  │              │               │            │            │            │
  │              │─Validate JWT──────────────>│            │            │
  │              │<─OK + user_id─────────────>│            │            │
  │              │               │            │            │            │
  │              │─Forward───────>│           │            │            │
  │              │  + x-keycloak-id   │           │            │            │
  │              │  + X-Tenant-ID │           │            │            │
  │              │               │            │            │            │
  │              │               │─Check perm──>           │            │
  │              │               │  (base)    │            │            │
  │              │               │<─Allowed?──>│           │            │
  │              │               │            │            │            │
  │              │               │─Check temporal access──>│            │
  │              │               │            │            │            │
  │              │               │            │            │─Get grant──>│
  │              │               │            │            │<─grant data──│
  │              │               │            │            │            │
  │              │               │            │            │─Eval cond. │
  │              │               │            │            │  • IP ✓    │
  │              │               │            │            │  • MFA ✓   │
  │              │               │            │            │  • Time ✓  │
  │              │               │            │            │            │
  │              │               │<─Allowed───────────────>│            │
  │              │               │            │            │            │
  │              │               │─Get account data        │            │
  │              │               │  from DB   │            │            │
  │              │               │            │            │            │
  │              │<─Account data──│           │            │            │
  │<─Account data────────────────│            │            │            │
  │              │               │            │            │            │
```

## Service Configuration

### Account Service Helm Values

```yaml
# values.yaml
accountService:
  env:
    - name: TEMPORAL_ACCESS_URL
      value: "http://temporal-access-service.banking.svc.cluster.local:8080"
    - name: TEMPORAL_ACCESS_TIMEOUT
      value: "5s"
    - name: TEMPORAL_ACCESS_FAIL_BEHAVIOR
      value: "closed" # Deny on error
    - name: PERMIFY_URL
      value: "http://permify.banking.svc.cluster.local:3476"
```

### Kubernetes Service Discovery

All services discover temporal-access-service via DNS:

```bash
# DNS resolution
temporal-access-service.banking.svc.cluster.local
→ 10.96.123.45:8080 (ClusterIP)
```

## Error Handling

### Scenario 1: Temporal Access Service Down

```go
accessResp, err := temporalClient.CheckAccountAccess(...)
if err != nil {
    // Circuit breaker OPEN or service unavailable
    // Fail-closed: DENY access
    log.Printf("Temporal access service unavailable: %v", err)
    http.Error(w, "Service temporarily unavailable", 503)
    return
}
```

### Scenario 2: Grant Expired During Request

```json
{
  "allowed": false,
  "reason": "Temporal grant expired at 2026-02-12T14:00:00Z",
  "matched_grant": null
}
```

**Service handles:**

```go
if !accessResp.Allowed {
    log.Printf("Access denied: %s", accessResp.Reason)
    http.Error(w, accessResp.Reason, 403)
    return
}
```

### Scenario 3: Condition Failed (MFA Required)

```json
{
  "allowed": false,
  "reason": "MFA required for amount exceeding $10,000",
  "matched_grant": {
    "grant_id": "grant_123",
    "conditions": {
      "require_mfa": true,
      "amount_threshold": { "min": 10000 }
    }
  },
  "conditions_checked": ["amount_threshold", "mfa_required"],
  "failed_conditions": ["mfa_required"]
}
```

**Client should:**

1. Prompt user for MFA
2. Retry request after MFA verification
3. APISIX will set `X-MFA-Verified: true`

## Testing Integration

### Unit Test Example

```go
func TestAccountAccessWithTemporalGrant(t *testing.T) {
    // Mock temporal access client
    mockClient := &MockTemporalAccessClient{
        checkAccountAccessFunc: func(ctx context.Context, tenantID, userID, permission, accountID string, accessCtx AccessContext) (*AccessCheckResponse, error) {
            return &AccessCheckResponse{
                Allowed: true,
                Reason:  "",
            }, nil
        },
    }

    service := &AccountService{
        temporalClient: mockClient,
    }

    // Test getAccount endpoint
    req := httptest.NewRequest("GET", "/accounts/acc_123", nil)
    req.Header.Set("x-keycloak-id", "user_456")
    req.Header.Set("X-Tenant-ID", "bank_001")

    w := httptest.NewRecorder()
    service.getAccount(w, req)

    assert.Equal(t, 200, w.Code)
}
```

### Integration Test

```bash
#!/bin/bash

# 1. Create temporal grant
curl -X POST http://temporal-access-service:8080/api/v1/grants \
  -H "Authorization: Bearer user:admin_bank_001" \
  -d '{
    "tenant_id": "bank_001",
    "subject_id": "user_auditor",
    "permission": "view",
    "resource_type": "account",
    "resource_id": "acc_123",
    "duration": "1h"
  }'

# 2. Test account service access
curl http://account-service:8080/accounts/acc_123 \
  -H "x-keycloak-id: user_auditor" \
  -H "X-Tenant-ID: bank_001"

# Expected: 200 OK (grant is active)

# 3. Revoke grant
curl -X DELETE http://temporal-access-service:8080/api/v1/grants/GRANT_ID

# 4. Test account service access again
curl http://account-service:8080/accounts/acc_123 \
  -H "x-keycloak-id: user_auditor" \
  -H "X-Tenant-ID: bank_001"

# Expected: 403 Forbidden (grant revoked)
```

## Summary

**Key Points:**

1. **APISIX** - Handles JWT validation, extracts user context, adds headers
2. **Services** - Use headers + temporal access client for authorization
3. **Permify** - Provides base permission checks
4. **Temporal Access Service** - Adds time-limited + conditional access
5. **Result** = Base Permission AND Temporal Access = Final Decision

**Benefits:**

✅ **Centralized** - All temporal access logic in one service
✅ **Consistent** - Same authorization experience across all services
✅ **Flexible** - Services just add client library, no complex logic
✅ **Observable** - All access checks logged and metered
✅ **Secure** - Fail-closed behavior prevents bypass on errors
