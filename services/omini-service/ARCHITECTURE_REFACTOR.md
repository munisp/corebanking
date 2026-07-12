# Omini-Service Architecture Refactor

## Overview

The omini-service has been refactored to follow proper microservices architecture principles. The services now act as **channel handlers** that route requests to core banking services instead of directly accessing the ledger.

## Changes Made

### 1. **Removed Direct TigerBeetle Access**

**Before:**

- Each channel service (USSD, SMS, Telegram) had direct TigerBeetle client connections
- Services were calling `CreateTransfers()` directly on the ledger
- This violated separation of concerns and created tight coupling

**After:**

- All TigerBeetle references removed from omini services
- Transaction handling delegated to `transaction-service` via Dapr
- Omini services are now pure channel handlers

### 2. **Service-to-Service Communication via Dapr**

All omini services now use Dapr service invocation to call core banking services:

```go
// Example: USSD service calling transaction-service
func (m *USSDMiddlewareIntegration) CreateTransaction(ctx context.Context,
    fromAccountID, toAccountID, amount string, reference, description string) error {

    payload := map[string]interface{}{
        "from_account_id": fromAccountID,
        "to_account_id":   toAccountID,
        "amount":          amount,
        "currency":        "NGN",
        "reference":       reference,
        "description":     description,
        "channel":         "ussd",
        "tenant_id":       m.config.TenantID,
    }

    // Call via Dapr
    resp, err := m.InvokeServiceViaDapr(ctx, "transaction-service",
        "api/v1/transactions", payload)
    // ...
}
```

### 3. **Core Service Integration Functions**

Added helper functions for common operations:

**Account Service:**

- `GetAccountBalance(accountID)` - Get current balance
- `GetAccountDetails(accountID)` - Get full account information

**User Service:**

- `GetUserByPhone(phoneNumber)` - Lookup user by phone

**Transaction Service:**

- `CreateTransaction(from, to, amount, ref)` - Execute transfers

### 4. **Configuration Updates**

**Removed:**

```go
TigerBeetleAddr string
LakehouseURL    string  // Moved to analytics layer
FluvioURL       string  // Moved to event streaming
TemporalHost    string  // Moved to workflow service
```

**Added:**

```go
DaprURL               string
TransactionServiceURL string
AccountServiceURL     string
UserServiceURL        string
```

## Service Responsibilities

### **Communication Hub**

- **Purpose:** Central message router
- **Responsibilities:**
  - Route messages between channels
  - Store message history in PostgreSQL
  - Cache conversations in Redis
  - Publish events to Kafka
- **Does NOT:** Handle transactions, access TigerBeetle

### **Channel Services (USSD, SMS, Telegram, WhatsApp)**

- **Purpose:** Channel-specific protocol handlers
- **Responsibilities:**
  - Parse channel-specific messages
  - Manage session state
  - Call core banking services via Dapr
  - Publish channel events to Kafka
- **Does NOT:** Direct ledger access, business logic

### **Integration Pattern**

```
┌─────────────┐
│   Customer  │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ Channel Service  │ (USSD/SMS/Telegram)
│  - Parse message │
│  - Session mgmt  │
└────────┬─────────┘
         │ Dapr Service Invocation
         ▼
┌─────────────────────┐
│  Core Services      │
│  - account-service  │
│  - transaction-svc  │
│  - user-service     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   TigerBeetle       │ (Ledger)
└─────────────────────┘
```

## Benefits

1. **Separation of Concerns:** Channel services focus on channel logic, not business logic
2. **Single Source of Truth:** Only transaction-service accesses TigerBeetle
3. **Easier Testing:** Can mock core service calls
4. **Better Scalability:** Services can scale independently
5. **Audit Trail:** All transactions go through transaction-service
6. **Security:** Ledger access centralized and controlled

## Migration Checklist

- [x] Remove TigerBeetle client from communication-hub
- [x] Remove TigerBeetle client from ussd-service
- [x] Remove TigerBeetle client from sms-banking
- [x] Remove TigerBeetle client from telegram-service
- [x] Add transaction-service integration via Dapr
- [x] Add account-service integration functions
- [x] Add user-service integration functions
- [x] Update configuration structs
- [ ] Update environment files (.env)
- [ ] Update Helm charts with new config
- [ ] Update integration tests
- [ ] Document API contracts with core services

## Next Steps

1. **WhatsApp Service:** Apply same refactoring pattern
2. **Environment Configuration:** Update all `.env` files
3. **Helm Charts:** Update service configurations
4. **Testing:** Create integration tests with mock core services
5. **Documentation:** Document core service API contracts
6. **Monitoring:** Add metrics for inter-service calls

## Core Service Dependencies

Each omini service now depends on:

| Service           | Dependencies                                       |
| ----------------- | -------------------------------------------------- |
| communication-hub | Kafka, PostgreSQL, Redis                           |
| ussd-service      | user-service, account-service, transaction-service |
| sms-banking       | user-service, account-service, transaction-service |
| telegram-service  | user-service, account-service, transaction-service |
| whatsapp-service  | user-service, account-service, transaction-service |

All communication happens via **Dapr service invocation** for:

- Service discovery
- Retry policies
- Circuit breaking
- Distributed tracing
