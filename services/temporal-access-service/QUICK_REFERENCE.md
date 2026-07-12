# Temporal Access Control - Quick Reference

## Admin Dashboard Integration

Add these routes to your admin dashboard router:

```typescript
// In your routing configuration
import TemporalAccessDashboard from '@/components/TemporalAccessDashboard';

const routes = [
  // ... existing routes
  {
    path: '/temporal-access',
    element: <TemporalAccessDashboard />,
    name: 'Temporal Access Control',
    icon: Clock,
  },
];
```

## Quick Actions

### Create a 30-Minute Grant

**Via Dashboard:**

1. Navigate to "Temporal Access" → "Temporal Grants" tab
2. Click "Create Grant"
3. Fill form:
   - Subject ID: `user_123`
   - Resource: `account` / `acc_456`
   - Permission: `view`
   - Duration: `30m`
   - Conditions: Enable MFA, add IP whitelist
4. Click "Create Grant"

**Via API:**

```bash
curl -X POST https://api.54link.com/api/temporal-access/grants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "54link",
    "subject_id": "user_123",
    "subject_type": "user",
    "permission": "view",
    "resource_type": "account",
    "resource_id": "acc_456",
    "duration": "30m",
    "reason": "Temporary access for audit",
    "conditions": {
      "require_mfa": true,
      "ip_whitelist": ["192.168.1.0/24"]
    }
  }'
```

### Revoke a Grant

**Via Dashboard:**

1. Find grant in table
2. Click "Revoke" button
3. Confirm action

**Via API:**

```bash
curl -X DELETE https://api.54link.com/api/temporal-access/grants/GRANT_ID?tenant_id=54link \
  -H "Authorization: Bearer $TOKEN"
```

### Extend a Grant

**Via Dashboard:**

1. Find grant in table
2. Click "Extend" button
3. Grant extended by 1 hour

**Via API:**

```bash
curl -X POST https://api.54link.com/api/temporal-access/grants/GRANT_ID/extend?tenant_id=54link \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"additional_duration": "1h", "reason": "Extension needed"}'
```

## Duration Presets

- `15m` - 15 minutes
- `30m` - 30 minutes (default)
- `1h` - 1 hour
- `4h` - 4 hours
- `8h` - 8 hours (business day)
- `24h` - 24 hours
- `7d` - 7 days (1 week)
- `30d` - 30 days (1 month)

## Condition Types

### IP Whitelist

```json
{
  "ip_whitelist": [
    "192.168.1.0/24", // CIDR notation
    "10.0.0.1" // Single IP
  ]
}
```

### Device IDs

```json
{
  "device_ids": ["device_abc123", "device_xyz789"]
}
```

### MFA Requirement

```json
{
  "require_mfa": true
}
```

### Time Windows

```json
{
  "time_windows": [
    {
      "start_time": "09:00",
      "end_time": "17:00",
      "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
      "timezone": "Africa/Lagos"
    }
  ]
}
```

### Usage Limits

```json
{
  "max_usage": 10 // Grant can be used max 10 times
}
```

## Common Use Cases

### 1. Auditor - Temporary Account Access

```
Duration: 8h
Permission: audit
Resource: specific account
Conditions: MFA + IP whitelist + business hours
```

### 2. Manager Vacation Delegation

```
Duration: 7d
Permission: approve
Resource: all loans
Conditions: MFA + business hours
```

### 3. Emergency Access

```
Duration: 15m
Permission: manage
Resource: specific account
Max Usage: 1
Conditions: MFA + Liveness + IP
```

### 4. Third-Party Contractor

```
Duration: 30d
Permission: view
Resource: all accounts
Conditions: IP whitelist + device ID + business hours
```

## Monitoring Dashboard

View metrics at: `https://grafana.54link.com/d/temporal-access`

**Key Metrics:**

- Active grants count
- Grant creation rate
- Failed condition checks (security alerts!)
- Permify circuit breaker status
- Access check latency

## Troubleshooting

**Grant not working:**

1. Check grant status (active/expired/revoked)
2. Verify conditions are met (IP, MFA, time)
3. Check usage count vs. max_usage
4. View audit log for failed checks

**Service unavailable:**

1. Check Kubernetes pods: `kubectl get pods -l app=temporal-access-service -n banking`
2. Check Permify status: `kubectl get pods -l app=permify -n banking`
3. Check Redis: `kubectl get statefulset redis-master -n banking`
4. View service logs: `kubectl logs -l app=temporal-access-service -n banking`

## Support

- **Slack:** #temporal-access-support
- **Docs:** https://docs.54link.com/temporal-access
- **Runbook:** See INTEGRATION_GUIDE.md

## Security Best Practices

1. ✅ Use shortest duration possible
2. ✅ Always require MFA for sensitive operations
3. ✅ Combine multiple conditions (IP + MFA + time)
4. ✅ Set max_usage for one-time operations
5. ✅ Review active grants weekly
6. ✅ Revoke grants immediately when no longer needed
7. ✅ Monitor audit logs daily
8. ✅ Alert on unusual grant creation patterns
