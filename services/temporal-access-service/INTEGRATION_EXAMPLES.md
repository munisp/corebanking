# Temporal Access Service - Example Usage

This document shows how to integrate the temporal access service into other services.

## 1. Add Client Library Dependency

In your service's `go.mod`:

```go
require (
    temporal-access-service/client v0.0.0
)
```

Replace the module path with:

```bash
go mod edit -replace temporal-access-service/client=../temporal-access-service/client
```

## 2. Initialize Client

```go
package main

import (
    "time"
    temporal "temporal-access-service/client"
)

func main() {
    // Initialize temporal access client
    temporalClient := temporal.NewClient(temporal.Config{
        BaseURL:     "http://temporal-access-service.banking.svc.cluster.local:8080",
        ServiceName: "account-service",
        FailOpen:    false, // Fail-closed: deny access if service unavailable
        Timeout:     5 * time.Second,
    })
    
    // Use in your handlers
    http.HandleFunc("/accounts/{id}", makeAccountHandler(temporalClient))
}
```

## 3. Use in Request Handlers

### Example: Account Service

```go
package handlers

import (
    "encoding/json"
    "net/http"
    
    "github.com/gorilla/mux"
    temporal "temporal-access-service/client"
)

type AccountHandler struct {
    temporalClient *temporal.Client
    // ... other dependencies
}

func (h *AccountHandler) GetAccount(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    vars := mux.Vars(r)
    accountID := vars["id"]
    
    // Extract user info from headers (set by APISIX)
    tenantID := r.Header.Get("X-Tenant-ID")
    userID := r.Header.Get("x-keycloak-id")
    
    // Extract access context
    accessCtx := temporal.ExtractContextFromHTTPRequest(r)
    
    // Check temporal access
    accessResp, err := h.temporalClient.CheckAccountAccess(
        ctx,
        tenantID,
        userID,
        "view",
        accountID,
        accessCtx,
    )
    
    if err != nil {
        http.Error(w, "access check failed", http.StatusInternalServerError)
        return
    }
    
    if !accessResp.Allowed {
        http.Error(w, accessResp.Reason, http.StatusForbidden)
        return
    }
    
    // Access granted - proceed with business logic
    account, err := h.getAccountFromDB(accountID)
    if err != nil {
        http.Error(w, "account not found", http.StatusNotFound)
        return
    }
    
    json.NewEncoder(w).Encode(account)
}
```

### Example: Transaction Service (with Amount Threshold)

```go
func (h *TransactionHandler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    
    var req CreateTransactionRequest
    json.NewDecoder(r.Body).Decode(&req)
    
    tenantID := r.Header.Get("X-Tenant-ID")
    userID := r.Header.Get("x-keycloak-id")
    
    // Extract access context with amount
    accessCtx := temporal.ExtractContextFromHTTPRequest(r)
    accessCtx.Amount = &req.Amount
    
    // Check temporal access
    accessResp, err := h.temporalClient.CheckTransactionAccess(
        ctx,
        tenantID,
        userID,
        "create",
        req.AccountID,
        accessCtx,
    )
    
    if err != nil {
        http.Error(w, "access check failed", http.StatusInternalServerError)
        return
    }
    
    // Handle MFA requirement
    if accessResp.RequiresMFA {
        json.NewEncoder(w).Encode(map[string]interface{}{
            "requires_mfa": true,
            "message": "Please complete MFA verification",
        })
        return
    }
    
    // Handle approval requirement
    if accessResp.RequiresApproval {
        // Save as pending transaction
        h.savePendingTransaction(req)
        json.NewEncoder(w).Encode(map[string]interface{}{
            "requires_approval": true,
            "message": "Transaction requires approval",
            "approver_roles": accessResp.ApproverRoles,
        })
        return
    }
    
    if !accessResp.Allowed {
        http.Error(w, accessResp.Reason, http.StatusForbidden)
        return
    }
    
    // Process transaction
    tx, err := h.createTransaction(req)
    if err != nil {
        http.Error(w, "transaction failed", http.StatusInternalServerError)
        return
    }
    
    json.NewEncoder(w).Encode(tx)
}
```

## 4. Admin API Usage Examples

### Create Temporal Grant

```bash
curl -X POST http://temporal-access-service:8080/api/v1/grants \
  -H "Authorization: Bearer <admin-token>" \
  -H "x-keycloak-id: admin_001" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "bank_001",
    "subject_id": "user_123",
    "subject_type": "user",
    "permission": "view",
    "resource_type": "account",
    "resource_id": "acc_456",
    "duration": "4h",
    "reason": "Customer support investigation",
    "max_usage": 10,
    "conditions": {
      "require_mfa": true,
      "ip_whitelist": ["10.0.1.0/24", "192.168.1.100"],
      "device_ids": ["device_abc123"],
      "time_windows": [{
        "start_time": "09:00",
        "end_time": "17:00",
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "timezone": "Africa/Lagos"
      }]
    }
  }'
```

### Check Access

```bash
curl -X POST http://temporal-access-service:8080/api/v1/check \
  -H "Content-Type: application/json" \
  -d '{
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
      "timestamp": "2026-02-12T14:30:00Z"
    }
  }'
```

### List Grants

```bash
curl -X GET "http://temporal-access-service:8080/api/v1/grants?tenant_id=bank_001" \
  -H "Authorization: Bearer <admin-token>" \
  -H "x-keycloak-id: admin_001"
```

### Revoke Grant

```bash
curl -X DELETE http://temporal-access-service:8080/api/v1/grants/grant_123 \
  -H "Authorization: Bearer <admin-token>" \
  -H "x-keycloak-id: admin_001"
```

### Extend Grant

```bash
curl -X POST http://temporal-access-service:8080/api/v1/grants/grant_123/extend \
  -H "Authorization: Bearer <admin-token>" \
  -H "x-keycloak-id: admin_001" \
  -H "Content-Type: application/json" \
  -d '{
    "duration": "2h",
    "reason": "Investigation requires more time"
  }'
```

## 5. Common Patterns

### Pattern 1: Always Check Temporal Access

```go
func (h *Handler) protectedEndpoint(w http.ResponseWriter, r *http.Request) {
    // 1. Extract context
    tenantID := r.Header.Get("X-Tenant-ID")
    userID := r.Header.Get("x-keycloak-id")
    accessCtx := temporal.ExtractContextFromHTTPRequest(r)
    
    // 2. Check access
    resp, err := h.temporalClient.CheckAccess(ctx, temporal.AccessCheckRequest{
        TenantID:     tenantID,
        SubjectID:    userID,
        SubjectType:  "user",
        Permission:   "view",
        ResourceType: "account",
        ResourceID:   accountID,
        Context:      accessCtx,
    })
    
    // 3. Handle response
    if err != nil || !resp.Allowed {
        http.Error(w, "access denied", http.StatusForbidden)
        return
    }
    
    // 4. Proceed with business logic
    // ...
}
```

### Pattern 2: Handle MFA Requirements

```go
if accessResp.RequiresMFA && !accessCtx.MFAVerified {
    w.WriteHeader(http.StatusPreconditionRequired)
    json.NewEncoder(w).Encode(map[string]interface{}{
        "error": "mfa_required",
        "message": "MFA verification required",
    })
    return
}
```

### Pattern 3: Fail-Open for Non-Critical Operations

```go
// For read-only operations that can tolerate service failures
temporalClient := temporal.NewClient(temporal.Config{
    BaseURL:  "http://temporal-access-service:8080",
    FailOpen: true, // Allow access if service is down
})
```

## 6. Metrics

Monitor temporal access checks:

```promql
# Total checks
temporal_access_client_checks_total{service="account-service",result="allowed"}

# Check latency
temporal_access_client_check_duration_seconds{service="account-service"}

# Error rate
rate(temporal_access_client_checks_total{result="error"}[5m])
```

## 7. Testing

```go
func TestAccountAccess(t *testing.T) {
    // Mock temporal client
    mockClient := &MockTemporalClient{
        CheckAccessFunc: func(ctx context.Context, req temporal.AccessCheckRequest) (*temporal.AccessCheckResponse, error) {
            return &temporal.AccessCheckResponse{
                Allowed: true,
                Reason:  "test grant",
            }, nil
        },
    }
    
    handler := &AccountHandler{
        temporalClient: mockClient,
    }
    
    // Test your handler
    // ...
}
```
