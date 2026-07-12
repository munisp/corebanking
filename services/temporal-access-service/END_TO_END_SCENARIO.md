# End-to-End Scenario: How It All Works Together

## Scenario: External Auditor Needs Temporary Account Access

### Context

- **User:** External auditor (`user_auditor_ext_123`)
- **Bank:** First National Bank (`bank_001`)
- **Need:** View specific customer account for 4-hour audit
- **Conditions:** Must use office IP, MFA required, business hours only

---

## Step 1: Tenant Admin Creates Temporal Grant

**Admin Dashboard Action:**

Tenant admin Jane (`admin_bank_001`) logs into the admin dashboard and creates a temporal grant:

```
From: Admin Dashboard → Temporal Access Tab → Create Grant

Fields:
- Subject: user_auditor_ext_123
- Resource: account / acc_customer_456
- Permission: audit
- Duration: 4h
- Conditions:
  ✓ Require MFA
  ✓ IP Whitelist: 203.0.113.0/24 (auditor's office)
  ✓ Time Window: 09:00-17:00 Mon-Fri (Africa/Lagos)
```

**Behind the Scenes (API Call):**

```http
POST /api/temporal-access/grants
Host: api.54link.com
Authorization: Bearer eyJhbGc... (Jane's JWT token)
Content-Type: application/json

{
  "tenant_id": "bank_001",
  "subject_id": "user_auditor_ext_123",
  "subject_type": "user",
  "permission": "audit",
  "resource_type": "account",
  "resource_id": "acc_customer_456",
  "duration": "4h",
  "reason": "Q1 2026 compliance audit - external auditor",
  "conditions": {
    "require_mfa": true,
    "ip_whitelist": ["203.0.113.0/24"],
    "time_windows": [{
      "start_time": "09:00",
      "end_time": "17:00",
      "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
      "timezone": "Africa/Lagos"
    }]
  }
}
```

**Temporal Access Service Processing:**

```
┌─────────────────────────────────────────────────────────────┐
│ Temporal Access Service                                     │
├─────────────────────────────────────────────────────────────┤
│ 1. Validate: Is Jane a tenant admin of bank_001?           │
│    → Call Permify: CheckPermission(bank_001, admin, Jane)  │
│    → Result: ✓ Yes, Jane has bank.admin permission         │
│                                                             │
│ 2. Create grant:                                            │
│    ID: grant_xyz789                                         │
│    Created: 2026-02-12 10:00:00                            │
│    Expires: 2026-02-12 14:00:00 (4 hours)                  │
│    Status: active                                           │
│                                                             │
│ 3. Store in Redis:                                          │
│    Key: grant:bank_001:grant_xyz789                        │
│    TTL: 4 hours (14400 seconds)                            │
│                                                             │
│ 4. Write to Permify:                                        │
│    Relationship:                                            │
│      temporal_grant:grant_xyz789#grantee@user:auditor_123  │
│      temporal_grant:grant_xyz789#resource@account:acc_456  │
│                                                             │
│ 5. Audit log:                                               │
│    Event: grant_created                                     │
│    Actor: admin_bank_001                                    │
│    Subject: user_auditor_ext_123                           │
│    Resource: account/acc_customer_456                       │
│    Timestamp: 2026-02-12 10:00:00                          │
│                                                             │
│ 6. Prometheus metric:                                       │
│    temporal_access_grants_created_total{                    │
│      tenant_id="bank_001",                                  │
│      permission="audit"                                     │
│    } += 1                                                   │
└─────────────────────────────────────────────────────────────┘
```

**Response to Jane:**

```json
{
  "id": "grant_xyz789",
  "tenant_id": "bank_001",
  "subject_id": "user_auditor_ext_123",
  "permission": "audit",
  "resource_type": "account",
  "resource_id": "acc_customer_456",
  "expires_at": "2026-02-12T14:00:00Z",
  "status": "active",
  "created_by": "admin_bank_001",
  "conditions": {
    "require_mfa": true,
    "ip_whitelist": ["203.0.113.0/24"],
    "time_windows": [...]
  }
}
```

Jane sees notification: **"✓ Grant created successfully. Auditor has access until 2:00 PM"**

---

## Step 2: Auditor Logs In (10:30 AM)

**Auditor's Login Flow:**

```
┌──────────────────────────────────────────────────────────┐
│ 1. Auditor opens: https://app.54link.com                │
│    From IP: 203.0.113.45 (office network)              │
│                                                          │
│ 2. Enters credentials:                                  │
│    Username: auditor_ext_123                            │
│    Password: ********                                   │
│                                                          │
│ 3. MFA Challenge:                                       │
│    Enter code from authenticator app                    │
│    Code: 123456                                         │
│    → MFA verified ✓                                     │
│                                                          │
│ 4. Auth Service creates JWT:                            │
│    {                                                     │
│      "user_id": "user_auditor_ext_123",                │
│      "tenant_id": "bank_001",                           │
│      "role": "auditor",                                 │
│      "mfa_verified": true,                              │
│      "mfa_verified_at": "2026-02-12T10:30:00Z",        │
│      "session_id": "sess_abc123"                        │
│    }                                                     │
│                                                          │
│ 5. Token returned to client                             │
│    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI... │
└──────────────────────────────────────────────────────────┘
```

---

## Step 3: Auditor Requests Account Data (10:35 AM)

**Client Request:**

```http
GET /api/accounts/acc_customer_456
Host: api.54link.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)
```

**Complete Flow:**

```
┌──────────────────────────────────────────────────────────────┐
│ APISIX Gateway                                               │
├──────────────────────────────────────────────────────────────┤
│ 1. Receive request from IP: 203.0.113.45                    │
│                                                              │
│ 2. Validate JWT token:                                      │
│    → Signature: ✓ Valid                                     │
│    → Expiration: ✓ Not expired                              │
│    → Extract payload:                                        │
│      user_id = user_auditor_ext_123                         │
│      tenant_id = bank_001                                   │
│      mfa_verified = true                                    │
│                                                              │
│ 3. Add headers and forward to account-service:              │
│    x-keycloak-id: user_auditor_ext_123                          │
│    X-Tenant-ID: bank_001                                    │
│    X-MFA-Verified: true                                     │
│    X-Client-IP: 203.0.113.45                                │
│    X-Device-ID: device_laptop_789                           │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ Account Service (Port 8080)                                  │
├──────────────────────────────────────────────────────────────┤
│ func getAccount(w http.ResponseWriter, r *http.Request) {   │
│                                                              │
│   // Extract from headers                                   │
│   userID = "user_auditor_ext_123"                           │
│   tenantID = "bank_001"                                     │
│   accountID = "acc_customer_456"                            │
│                                                              │
│   // STEP 1: Check base permission with Permify            │
│   baseAllowed = permifyClient.CheckPermission(              │
│     tenantID: "bank_001",                                   │
│     subject: "user:user_auditor_ext_123",                   │
│     permission: "audit",                                    │
│     object: "account:acc_customer_456"                      │
│   )                                                          │
│   // → Result: ❌ DENIED (auditor has no permanent access)  │
│   //                                                         │
│   // Note: This is OK! Auditor doesn't need permanent       │
│   // permission - they have a temporary grant               │
│                                                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ Base permission denied, but continue
                     │ to check temporal access...
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ Account Service (continued)                                  │
├──────────────────────────────────────────────────────────────┤
│   // STEP 2: Check temporal access                          │
│   accessCtx = ExtractAccessContext(                          │
│     request: r,                                              │
│     mfa_verified: true,                                      │
│     liveness_verified: false                                 │
│   )                                                          │
│   // → accessCtx = {                                         │
│   //     ip_address: "203.0.113.45",                         │
│   //     device_id: "device_laptop_789",                     │
│   //     mfa_verified: true,                                 │
│   //     timestamp: "2026-02-12T10:35:00Z"                   │
│   //   }                                                     │
│                                                              │
│   accessResp = temporalClient.CheckAccountAccess(            │
│     tenantID: "bank_001",                                   │
│     userID: "user_auditor_ext_123",                         │
│     permission: "audit",                                    │
│     accountID: "acc_customer_456",                          │
│     context: accessCtx                                      │
│   )                                                          │
│                                                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ POST /api/v1/check
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ Temporal Access Service                                      │
├──────────────────────────────────────────────────────────────┤
│ 1. Lookup active grants in Redis:                           │
│    pattern: grant:bank_001:*                                │
│    → Found: grant_xyz789                                    │
│                                                              │
│ 2. Grant Details:                                            │
│    {                                                         │
│      "id": "grant_xyz789",                                  │
│      "subject_id": "user_auditor_ext_123", ✓                │
│      "permission": "audit", ✓                               │
│      "resource_id": "acc_customer_456", ✓                   │
│      "expires_at": "2026-02-12T14:00:00Z",                  │
│      "status": "active",                                    │
│      "conditions": {...}                                     │
│    }                                                         │
│                                                              │
│ 3. Check if expired:                                         │
│    Current time: 10:35:00                                   │
│    Expires at: 14:00:00                                     │
│    → ✓ Not expired (3h 25m remaining)                       │
│                                                              │
│ 4. Evaluate conditions:                                      │
│                                                              │
│    a) IP Whitelist:                                          │
│       Required: 203.0.113.0/24                              │
│       Actual: 203.0.113.45                                  │
│       → ✓ IP in CIDR range                                  │
│                                                              │
│    b) MFA Required:                                          │
│       Required: true                                         │
│       Actual: true                                           │
│       → ✓ MFA verified                                      │
│                                                              │
│    c) Time Window:                                           │
│       Required: 09:00-17:00 Mon-Fri Africa/Lagos            │
│       Current: 10:35 Wed (Africa/Lagos)                     │
│       → ✓ Within time window                                │
│                                                              │
│ 5. All conditions passed!                                    │
│                                                              │
│ 6. Usage tracking:                                           │
│    grant.usage_count += 1                                   │
│    (No max_usage set, so unlimited uses within 4h)          │
│                                                              │
│ 7. Audit log:                                                │
│    Event: grant_used                                         │
│    Grant: grant_xyz789                                      │
│    User: user_auditor_ext_123                               │
│    Resource: account/acc_customer_456                        │
│    Result: allowed                                           │
│    Timestamp: 2026-02-12 10:35:00                           │
│    IP: 203.0.113.45                                         │
│    Conditions checked: [ip, mfa, time_window]               │
│                                                              │
│ 8. Prometheus metrics:                                       │
│    temporal_access_grant_checks_total{                       │
│      tenant_id="bank_001",                                  │
│      result="allowed"                                       │
│    } += 1                                                   │
│                                                              │
│    temporal_access_condition_checks_total{                   │
│      condition_type="ip_whitelist",                         │
│      result="allowed"                                       │
│    } += 1                                                   │
│    ... (same for mfa, time_window)                          │
│                                                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ Response
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ Account Service receives response:                           │
│                                                              │
│ {                                                            │
│   "allowed": true,                                           │
│   "reason": "",                                              │
│   "matched_grant": {                                         │
│     "grant_id": "grant_xyz789",                             │
│     "expires_at": "2026-02-12T14:00:00Z"                    │
│   },                                                         │
│   "conditions_checked": [                                    │
│     "ip_whitelist",                                          │
│     "mfa_required",                                          │
│     "time_window"                                            │
│   ]                                                          │
│ }                                                            │
│                                                              │
│ // Both checks:                                              │
│ // - Base permission: DENIED (no permanent access)          │
│ // - Temporal access: ALLOWED (active grant)                │
│ //                                                           │
│ // Decision: ALLOW (temporal grant overrides)               │
│                                                              │
│ // Fetch account data from database                         │
│ account = db.GetAccount("acc_customer_456")                 │
│                                                              │
│ // Return to client                                          │
│ json.NewEncoder(w).Encode(account)                          │
│                                                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ 200 OK
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ Client receives account data:                                │
│                                                              │
│ {                                                            │
│   "account_id": "acc_customer_456",                         │
│   "customer_name": "John Doe",                              │
│   "balance": 125000.00,                                     │
│   "currency": "NGN",                                        │
│   "transactions": [...]                                      │
│ }                                                            │
│                                                              │
│ ✓ Auditor successfully accessed account                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Step 4: Attempted Access from Home (6:00 PM)

**Scenario:** Auditor tries to access same account from home after work

```http
GET /api/accounts/acc_customer_456
Host: api.54link.com
Authorization: Bearer eyJhbGc... (same token, fresh MFA)
From IP: 197.210.85.100 (home IP, NOT in whitelist)
Time: 18:00 (6 PM - outside business hours)
```

**Temporal Access Service Evaluation:**

```
1. Find grant: ✓ grant_xyz789 exists
2. Check expired: ✓ Not expired (still valid until 2 PM tomorrow if extended)
3. Evaluate conditions:

   a) IP Whitelist:
      Required: 203.0.113.0/24
      Actual: 197.210.85.100
      → ❌ DENIED: IP not in whitelist

   b) Time Window:
      Required: 09:00-17:00 Mon-Fri
      Current: 18:00 Wed
      → ❌ DENIED: Outside allowed time window

4. Result: ACCESS DENIED
```

**Response:**

```json
{
  "allowed": false,
  "reason": "Access denied: IP address 197.210.85.100 not in whitelist; Outside allowed time window (09:00-17:00)",
  "matched_grant": {
    "grant_id": "grant_xyz789"
  },
  "conditions_checked": ["ip_whitelist", "time_window"],
  "failed_conditions": ["ip_whitelist", "time_window"]
}
```

**Auditor sees:** **"❌ Access denied: Must be in office network during business hours"**

---

## Step 5: Admin Monitors Activity (Throughout the Day)

**Admin Dashboard - Audit Log:**

```
Time     | Event        | User                   | Resource           | Result  | IP           | Conditions
---------|--------------|------------------------|--------------------|---------|--------------|--------------
10:00 AM | grant_created| admin_bank_001        | acc_customer_456   | success | 192.168.1.10 | -
10:35 AM | grant_used   | user_auditor_ext_123  | acc_customer_456   | allowed | 203.0.113.45 | ip,mfa,time ✓
11:20 AM | grant_used   | user_auditor_ext_123  | acc_customer_456   | allowed | 203.0.113.45 | ip,mfa,time ✓
12:45 PM | grant_used   | user_auditor_ext_123  | acc_customer_456   | allowed | 203.0.113.45 | ip,mfa,time ✓
06:00 PM | grant_used   | user_auditor_ext_123  | acc_customer_456   | denied  | 197.210.85.100| ip ❌, time ❌
```

**Admin sees alert:**
🚨 **"Access denied for user_auditor_ext_123 - IP/time violation"**

---

## Step 6: Grant Expires (2:00 PM Next Day)

**Automatic Cleanup:**

```
┌──────────────────────────────────────────────────┐
│ Temporal Access Service (Cleanup Job)           │
│ Runs every 5 minutes                             │
├──────────────────────────────────────────────────┤
│ 1. Scan Redis for expired grants:                │
│    pattern: grant:*:*                            │
│    → Found grant_xyz789                          │
│                                                  │
│ 2. Check expiration:                             │
│    Current time: 2026-02-12 14:00:00            │
│    Expires at: 2026-02-12 14:00:00              │
│    → EXPIRED                                     │
│                                                  │
│ 3. Revoke in Permify:                            │
│    Delete relationships for grant_xyz789         │
│                                                  │
│ 4. Delete from Redis:                            │
│    DEL grant:bank_001:grant_xyz789              │
│                                                  │
│ 5. Audit log:                                    │
│    Event: grant_expired                          │
│    Grant: grant_xyz789                           │
│    Timestamp: 2026-02-12 14:00:00               │
│                                                  │
│ 6. Prometheus metric:                            │
│    temporal_access_grants_expired_total{         │
│      tenant_id="bank_001"                       │
│    } += 1                                       │
└──────────────────────────────────────────────────┘
```

**Auditor tries to access at 2:01 PM:**

```
→ Result: 403 Forbidden - No active grant found
```

---

## Summary: What Happened

1. **Admin Created Grant** (10:00 AM)
   - Jane granted 4-hour audit access
   - Conditions: Office IP, MFA, business hours
   - Stored in Redis with 4h TTL

2. **Auditor Accessed Account** (10:35 AM)
   - Request routed through APISIX → Account Service
   - Account Service checked Permify (base: denied)
   - Account Service checked Temporal Access (grant: allowed)
   - Final decision: ALLOWED (grant active + conditions met)

3. **Auditor Blocked from Home** (6:00 PM)
   - IP not in whitelist
   - Outside time window
   - Grant still active but conditions failed
   - Final decision: DENIED

4. **Grant Auto-Expired** (2:00 PM next day)
   - Cleanup job detected expiration
   - Removed from Redis and Permify
   - Future access attempts denied

**Key Takeaways:**

✅ **Layered Security:** Base permissions (Permify) + Temporal grants (Temporal Service)
✅ **Conditional Access:** IP, MFA, time windows enforced automatically
✅ **Fail-Closed:** Service errors = deny access
✅ **Full Audit Trail:** Every access attempt logged
✅ **Zero Trust:** Access verified on every request
✅ **Multi-Tenant:** Bank admins can only manage their own tenant's grants

This is how temporal access control integrates seamlessly with your existing microservices! 🎉
