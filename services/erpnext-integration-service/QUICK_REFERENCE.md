# ERP Integration Quick Reference Guide

## 🎯 Quick Start

### API Endpoint Structure

```
Base URL: /erp/api/v1
Headers:
  X-Tenant-ID: your-tenant-id
  X-Customer-ID: your-customer-id
```

## 📋 All Available Endpoints

### Core ERP Operations (Existing)

```
✅ GET    /connections                    - List ERP connections
✅ POST   /connections                    - Create new connection
✅ GET    /connections/{id}               - Get connection details
✅ PUT    /connections/{id}               - Update connection
✅ DELETE /connections/{id}               - Delete connection
✅ POST   /connections/{id}/test          - Test connection
✅ POST   /connections/{id}/sync          - Trigger manual sync

✅ GET    /bank-accounts                  - List bank accounts
✅ GET    /bank-accounts/{id}/transactions - Get account transactions
✅ GET    /bank-accounts/{id}/balance     - Get account balance

✅ POST   /reconciliation/auto            - Auto reconcile transactions
✅ POST   /reconciliation/manual          - Manual reconciliation
✅ GET    /reconciliation/status          - Get reconciliation status
✅ GET    /reconciliation/unmatched       - List unmatched transactions

✅ GET    /payments                       - List payments
✅ POST   /payments                       - Initiate payment
✅ GET    /payments/{id}                  - Get payment details
✅ GET    /payments/{id}/status           - Get payment status
✅ POST   /payments/bulk                  - Bulk payment processing

✅ GET    /invoices                       - List invoices
✅ POST   /invoices/{id}/match            - Match invoice to payment
✅ POST   /invoices/auto-match            - Auto-match invoices

✅ GET    /loans                          - List loans
✅ GET    /loans/{id}                     - Get loan details
✅ GET    /loans/{id}/schedule            - Get payment schedule
✅ POST   /loans/{id}/payment             - Make loan payment

✅ GET    /cash-position                  - Get cash position
✅ GET    /cash-forecast                  - Get cash forecast

✅ POST   /sync/accounts                  - Sync accounts
✅ POST   /sync/transactions              - Sync transactions
✅ POST   /sync/invoices                  - Sync invoices
✅ GET    /sync/status                    - Get sync status
✅ GET    /sync/history                   - Get sync history

✅ GET    /mappings/accounts              - List account mappings
✅ POST   /mappings/accounts              - Create mapping
✅ PUT    /mappings/accounts/{id}         - Update mapping
✅ DELETE /mappings/accounts/{id}         - Delete mapping

✅ GET    /webhooks                       - List webhooks
✅ POST   /webhooks                       - Create webhook
✅ DELETE /webhooks/{id}                  - Delete webhook

✅ GET    /reports/reconciliation         - Reconciliation report
✅ GET    /reports/cash-flow              - Cash flow report
✅ GET    /reports/payment-summary        - Payment summary report
```

### New Enterprise Features

```
🆕 GET    /config/sync                    - Get sync configuration
🆕 PUT    /config/sync                    - Update sync settings
🆕 GET    /config/retry-policy            - Get retry policy
🆕 PUT    /config/retry-policy            - Update retry policy
🆕 GET    /config/notifications           - Get notification settings
🆕 PUT    /config/notifications           - Update notifications
🆕 GET    /config/security                - Get security config
🆕 PUT    /config/security                - Update security settings

🆕 GET    /dashboard/metrics?period=week  - Get KPIs and metrics
🆕 GET    /audit-logs                     - Get audit logs
🆕 GET    /exceptions                     - List exceptions
🆕 PUT    /exceptions/{id}                - Update exception
```

## 🔧 Configuration Reference

### Sync Frequencies

- `realtime` - Immediate synchronization
- `5min` - Every 5 minutes
- `15min` - Every 15 minutes
- `30min` - Every 30 minutes
- `hourly` - Once per hour
- `daily` - Once per day

### Exception Types

- `sync_failure` - ERP sync errors
- `reconciliation_mismatch` - Matching discrepancies
- `payment_failure` - Payment processing errors
- `validation_error` - Data validation issues

### Exception Severity

- `critical` - Immediate action required
- `high` - Urgent attention needed
- `medium` - Normal priority
- `low` - Informational

### Exception Status

- `open` - New exception
- `investigating` - Being investigated
- `resolved` - Fixed
- `ignored` - Acknowledged but not fixed

## 📊 Dashboard Metrics Periods

- `today` - Last 24 hours
- `week` - Last 7 days
- `month` - Last 30 days
- `year` - Last 365 days

## 🔐 Security Features

### IP Whitelist Format

```json
["10.0.0.0/8", "192.168.1.0/24", "172.16.0.0/12"]
```

### Approval Thresholds

- Payments above threshold require approval
- Configuration changes can require approval
- Default payment threshold: $5,000

### Session Management

- Configurable timeout (default: 30 minutes)
- Auto-logout on timeout
- MFA support available

## 📝 Audit Log Actions

Common actions logged:

- `update_sync_config`
- `update_retry_policy`
- `update_notification_config`
- `update_security_config`
- `create_connection`
- `update_connection`
- `delete_connection`
- `initiate_payment`
- `update_exception`
- `create_webhook`
- `delete_webhook`

## 🎨 UI Tabs

1. **Overview** - Dashboard with KPIs
2. **Connections** - ERP system connections
3. **Bank Accounts** - Connected accounts
4. **Reconciliation** - Transaction matching
5. **Payments** - Payment processing
6. **Invoices** - Invoice management
7. **Loans** - Loan tracking
8. **Cash Position** - Liquidity management
9. **Sync Operations** - Data synchronization
10. **Account Mappings** - ERP-Bank mappings
11. **Webhooks** - Event notifications
12. **Reports** - Analytics and reports
13. **Exceptions** - Error management
14. **Audit Log** - Activity tracking
15. **Settings** - System configuration

## 🚀 Common Tasks

### Enable Auto-Sync

```typescript
await erpIntegrationApi.updateSyncConfig(tenantId, customerId, {
  auto_sync_enabled: true,
  sync_frequency: "hourly",
});
```

### Configure Notifications

```typescript
await erpIntegrationApi.updateNotificationConfig(tenantId, customerId, {
  email_notifications_enabled: true,
  notification_emails: ["ops@bank.com"],
  notify_on_sync_failure: true,
});
```

### View Metrics

```typescript
const metrics = await erpIntegrationApi.getDashboardMetrics(
  tenantId,
  customerId,
  "week",
);
```

### Query Audit Logs

```typescript
const { logs } = await erpIntegrationApi.getAuditLogs(tenantId, customerId, {
  action: "update_sync_config",
  limit: 50,
});
```

### Update Exception

```typescript
await erpIntegrationApi.updateException(tenantId, customerId, exceptionId, {
  status: "resolved",
  resolution_notes: "Fixed by restarting sync",
});
```

## 📖 Documentation Files

- `ENTERPRISE_ERP_INTEGRATION.md` - Complete technical documentation
- `ENTERPRISE_ERP_IMPLEMENTATION_SUMMARY.md` - Implementation overview
- `migrations/002_enterprise_features.sql` - Database schema

## 🎯 Support

For issues or questions:

1. Check audit logs for error details
2. Review exception management for open issues
3. Consult dashboard metrics for system health
4. Contact development team for assistance
