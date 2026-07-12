# Using Temporal Access Service for ALL Permissions

## Architecture

Every service in the 54link platform should route **all permission checks** through the temporal-access-service. This provides:

✅ **Centralized authorization**  
✅ **Temporal grants** (temporary elevated access)  
✅ **Conditional access** (IP, MFA, time windows, device restrictions)  
✅ **Access policies** (amount thresholds, risk scores)  
✅ **Delegation** (user-to-user permission sharing)  
✅ **Complete audit trail**  
✅ **Base permissions** (Permify ReBAC)  

## Permission Check Flow

```
┌─────────────────┐
│  Your Service   │
│ (Account/Loan)  │
└────────┬────────┘
         │
         │ POST /api/v1/check
         ▼
┌─────────────────────────────────┐
│  Temporal Access Service        │
│                                 │
│  1. Temporal Grants ────────┐  │
│  2. Delegations ────────────┤  │
│  3. Access Policies ────────┤  │
│  4. Base Permissions ───────┤  │
│     (Permify)               │  │
│                             │  │
│  5. Apply Conditions ←──────┘  │
│     - MFA required?            │
│     - IP whitelisted?          │
│     - Time window OK?          │
│     - Device authorized?       │
│                                 │
│  6. Return Decision             │
└─────────────────────────────────┘
         │
         ▼
   Allow / Deny
```

## Integration Pattern

### Every Protected Endpoint Should:

```go
func (h *Handler) GetAccount(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    accountID := mux.Vars(r)["id"]
    
    // 1. Extract request context
    tenantID := r.Header.Get("X-Tenant-ID")
    userID := r.Header.Get("x-keycloak-id")
    accessCtx := temporal.ExtractContextFromHTTPRequest(r)
    
    // 2. Check permission via temporal-access-service
    resp, err := h.temporalClient.CheckAccountAccess(
        ctx, tenantID, userID, "view", accountID, accessCtx,
    )
    
    // 3. Handle the response
    if err != nil {
        http.Error(w, "authorization service unavailable", http.StatusServiceUnavailable)
        return
    }
    
    if !resp.Allowed {
        http.Error(w, resp.Reason, http.StatusForbidden)
        return
    }
    
    // 4. If allowed, proceed with business logic
    account := h.getAccountFromDB(accountID)
    json.NewEncoder(w).Encode(account)
}
```

## Permissions Are Checked In Priority Order

### 1. **Temporal Grants** (Highest Priority)
Temporary permissions override everything. Used for:
- Customer support investigations
- Emergency access
- Time-limited elevated privileges
- Temporary delegation

```bash
# Admin grants support agent 2-hour access to view account
curl -X POST /api/v1/grants \
  -d '{"subject_id": "agent_42", "permission": "view", 
       "resource_id": "acc_123", "duration": "2h"}'
```

### 2. **Delegations**
User-to-user permission sharing:
- Account owner delegates to accountant
- Manager delegates approval rights
- Co-borrower permissions

### 3. **Access Policies**
Conditional rules that apply globally:
- Transactions > $10,000 require MFA
- Transfers > $50,000 require dual approval
- High-risk operations require liveness check

```go
// Policy: Large withdrawals need MFA
{
  "rule": {
    "type": "amount",
    "operator": "gt",
    "value": 10000,
    "action": "require_mfa"
  }
}
```

### 4. **Base Permissions** (Permify)
Permanent role-based permissions:
- Account owners
- Bank admins
- Loan officers
- Managers

```bash
# Make user_123 owner of account acc_456 (permanent)
curl -X POST http://permify:3476/v1/tenants/bank_001/relationships/write \
  -d '{"tuples": [{
    "entity": {"type": "account", "id": "acc_456"},
    "relation": "owner",
    "subject": {"type": "user", "id": "user_123"}
  }]}'
```

## Example: Account Service Integration

```go
package main

import (
    "net/http"
    temporal "temporal-access-service/client"
)

type AccountService struct {
    temporalClient *temporal.Client
}

func main() {
    // Initialize temporal access client
    temporalClient := temporal.NewClient(temporal.Config{
        BaseURL:     "http://temporal-access-service:8080",
        ServiceName: "account-service",
        FailOpen:    false, // Fail-closed: deny if service down
    })
    
    svc := &AccountService{temporalClient: temporalClient}
    
    // All endpoints protected
    http.HandleFunc("/accounts/{id}", svc.GetAccount)
    http.HandleFunc("/accounts/{id}/withdraw", svc.Withdraw)
    http.HandleFunc("/accounts/{id}/transfer", svc.Transfer)
    
    http.ListenAndServe(":8080", nil)
}

func (s *AccountService) Withdraw(w http.ResponseWriter, r *http.Request) {
    var req WithdrawRequest
    json.NewDecoder(r.Body).Decode(&req)
    
    // Build access context with amount
    accessCtx := temporal.ExtractContextFromHTTPRequest(r)
    accessCtx.Amount = &req.Amount
    
    // Check permission
    resp, err := s.temporalClient.CheckAccountAccess(
        r.Context(),
        r.Header.Get("X-Tenant-ID"),
        r.Header.Get("x-keycloak-id"),
        "withdraw",
        mux.Vars(r)["id"],
        accessCtx,
    )
    
    if err != nil {
        http.Error(w, "authorization failed", http.StatusInternalServerError)
        return
    }
    
    // Handle conditional requirements
    if resp.RequiresMFA && !accessCtx.MFAVerified {
        json.NewEncoder(w).Encode(map[string]interface{}{
            "requires_mfa": true,
            "message": "Large withdrawal requires MFA",
        })
        return
    }
    
    if resp.RequiresApproval {
        // Save as pending, send to approvers
        s.createPendingWithdrawal(req, resp.ApproverRoles)
        json.NewEncoder(w).Encode(map[string]interface{}{
            "requires_approval": true,
            "approvers": resp.ApproverRoles,
        })
        return
    }
    
    if !resp.Allowed {
        http.Error(w, resp.Reason, http.StatusForbidden)
        return
    }
    
    // Process withdrawal
    s.processWithdrawal(req)
}
```

## Benefits of Central Authorization

### 🔒 **Security**
- Single point of enforcement
- Consistent permission checks across all services
- No permission logic scattered in business code

### 📊 **Audit & Compliance**
- Every permission check logged
- Track who accessed what, when, from where
- Identify suspicious access patterns

### ⚡ **Flexibility**
- Add conditional access without changing services
- Grant temporary elevated access instantly
- Apply new policies system-wide

### 🎯 **Developer Experience**
- Simple client library
- One line to check permissions
- Services focus on business logic, not authorization

## Setting Up Base Permissions

When a user/resource is created, write base permissions to Permify:

```go
// When creating account
func (s *AccountService) CreateAccount(userID, accountID string) {
    // 1. Create account in database
    s.db.CreateAccount(accountID, userID)
    
    // 2. Set base permissions in Permify
    s.permifyClient.WriteRelationship(ctx, permify.WriteRelationshipRequest{
        TenantID: tenantID,
        Tuples: []permify.RelationshipTuple{{
            Entity:   permify.Entity{Type: "account", ID: accountID},
            Relation: "owner",
            Subject:  permify.Subject{Type: "user", ID: userID},
        }},
    })
}
```

## Next Steps

1. **Add temporal client to each service**
2. **Replace direct Permify calls** with temporal-access-service calls
3. **Remove permission logic** from business code
4. **Set up base permissions** in Permify during resource creation
5. **Use temporal grants** for temporary elevated access
6. **Configure policies** for conditional access rules

---

**Result:** All services check permissions the same way, with temporal grants, conditions, and audit logging built in! 🚀
