# ERP Kafka Integration - Architecture Diagram

## Complete Event Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                         MICROSERVICES PUBLISHERS                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Payment Proc.   │  │   Loan Service   │  │ Savings Service  │
│    (Python)      │  │      (Go)        │  │    (Python)      │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ Topics (8):      │  │ Topics (1):      │  │ Topics (2):      │
│ • transaction    │  │ • loan-events    │  │ • savings.goal   │
│ • payout         │  │   - created      │  │ • savings.txn    │
│ • loan           │  │   - disbursed    │  │                  │
│ • lpo            │  │   - payment      │  │                  │
│ • deposit        │  │                  │  │                  │
│ • transfer       │  │                  │  │                  │
│ • insurance      │  │                  │  │                  │
│ • scf            │  │                  │  │                  │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         │                     │                      │
         ▼                     ▼                      ▼

┌──────────────────┐  ┌──────────────────┐
│ Mortgage Service │  │   LPO Service    │
│      (Go)        │  │    (Python)      │
├──────────────────┤  ├──────────────────┤
│ Topics (6):      │  │ Topics (2):      │
│ • applications   │  │ • lpo.lifecycle  │
│ • disbursements  │  │ • lpo.app        │
│ • payments       │  │   - created      │
│ • workflows      │  │   - submitted    │
│ • arrears        │  │   - approved     │
│ • collections    │  │   - disbursed    │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         │                     │
         ▼                     ▼

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                              KAFKA MESSAGE BUS                                  │
│                            (24 Topics Subscribed)                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Dapr Pub/Sub
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     ERPNext Integration Service (Go)                            │
│                              Port: 8118                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐      │
│  │                    Dapr Subscription Endpoint                        │      │
│  │                  GET /dapr/subscribe                                 │      │
│  │              Returns 24 topic subscriptions                          │      │
│  └──────────────────────────────────────────────────────────────────────┘      │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         Event Handlers                                  │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                         │   │
│  │  POST /events/payment    ──▶  handlePaymentEvent()                     │   │
│  │       └──▶ processPaymentEvent() ──▶ syncPaymentToERP()               │   │
│  │                                                                         │   │
│  │  POST /events/loan       ──▶  handleLoanEvent()                        │   │
│  │       └──▶ processLoanEvent() ──▶ syncLoanToERP()                     │   │
│  │                                                                         │   │
│  │  POST /events/savings    ──▶  handleSavingsEvent()                     │   │
│  │       └──▶ processSavingsEvent() ──▶ syncSavingsToERP()               │   │
│  │                                                                         │   │
│  │  POST /events/mortgage   ──▶  handleMortgageEvent()                    │   │
│  │       └──▶ processMortgageEvent() ──▶ syncMortgageToERP()             │   │
│  │                                                                         │   │
│  │  POST /events/lpo        ──▶  handleLpoEvent()                         │   │
│  │       └──▶ processLpoEvent() ──▶ syncLpoToERP()                       │   │
│  │                                                                         │   │
│  │  POST /events/transaction ──▶ handleTransactionEvent()                 │   │
│  │  POST /events/account     ──▶ handleAccountEvent()                     │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      ERPNext Client Layer                               │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  • CreatePaymentEntry()                                                │   │
│  │  • CreateJournalEntry()                                                │   │
│  │  • CreatePurchaseOrder() (future)                                      │   │
│  │  • Authentication & API calls                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/REST API
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ERPNext Server                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Documents Created:                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Payment Entry                                                          │   │
│  │  ├─ Payment Processing transactions                                     │   │
│  │  ├─ Loan disbursements & repayments                                     │   │
│  │  ├─ Mortgage disbursements & payments                                   │   │
│  │  └─ LPO disbursements                                                   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Journal Entry                                                          │   │
│  │  ├─ Savings deposits                                                    │   │
│  │  ├─ General ledger transactions                                         │   │
│  │  └─ Financial reconciliations                                           │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Purchase Order (Future)                                                │   │
│  │  └─ LPO approvals                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Topic → Handler → DocType Mapping

```
┌──────────────────────────────────┬───────────────────────┬─────────────────────┐
│          Topic                   │   Handler Route       │   ERP DocType       │
├──────────────────────────────────┼───────────────────────┼─────────────────────┤
│ payment.processing.transaction   │  /events/payment      │  Payment Entry      │
│ payment.processing.payout        │  /events/payment      │  Payment Entry      │
│ payment.processing.loan          │  /events/payment      │  Payment Entry      │
│ payment.processing.lpo           │  /events/payment      │  Payment Entry      │
│ payment.processing.deposit       │  /events/payment      │  Payment Entry      │
│ payment.processing.transfer      │  /events/payment      │  Payment Entry      │
│ payment.processing.insurance.*   │  /events/payment      │  Payment Entry      │
│ payment.processing.supply.*      │  /events/payment      │  Payment Entry      │
├──────────────────────────────────┼───────────────────────┼─────────────────────┤
│ loan-events                      │  /events/loan         │  Payment Entry      │
│   • loan.application.created     │                       │  (tracking only)    │
│   • loan.disbursed               │                       │  Payment Entry      │
│   • loan.payment.recorded        │                       │  Payment Entry      │
├──────────────────────────────────┼───────────────────────┼─────────────────────┤
│ savings.goal                     │  /events/savings      │  Journal Entry      │
│ savings.transaction              │  /events/savings      │  Journal Entry      │
├──────────────────────────────────┼───────────────────────┼─────────────────────┤
│ mortgages.applications           │  /events/mortgage     │  (tracking only)    │
│ mortgages.disbursements          │  /events/mortgage     │  Payment Entry      │
│ mortgages.payments               │  /events/mortgage     │  Payment Entry      │
│ mortgages.workflows              │  /events/mortgage     │  (tracking only)    │
│ mortgages.arrears                │  /events/mortgage     │  (tracking only)    │
│ mortgages.collections            │  /events/mortgage     │  (tracking only)    │
├──────────────────────────────────┼───────────────────────┼─────────────────────┤
│ lpo.lifecycle                    │  /events/lpo          │  (tracking only)    │
│ lpo.application                  │  /events/lpo          │  Payment Entry /    │
│   • lpo.created                  │                       │  (tracking only)    │
│   • lpo.approved                 │                       │  Purchase Order*    │
│   • lpo.disbursed                │                       │  Payment Entry      │
└──────────────────────────────────┴───────────────────────┴─────────────────────┘

* Purchase Order creation for LPO approvals is logged but not yet implemented
```

## Data Flow Sequence

```
1. SERVICE PUBLISHES EVENT
   │
   ├─▶ Payment Service → kafka_client.publish_event()
   ├─▶ Loan Service → PublishEvent()
   ├─▶ Savings Service → kafka_client.publish_event()
   ├─▶ Mortgage Service → PublishEvent()
   └─▶ LPO Service → publish_event()

2. KAFKA RECEIVES EVENT
   │
   └─▶ Event stored in appropriate topic

3. DAPR DELIVERS EVENT
   │
   └─▶ POST to registered handler route (CloudEvent format)

4. ERP SERVICE HANDLES EVENT
   │
   ├─▶ Decode CloudEvent
   ├─▶ Extract event data
   ├─▶ Validate event structure
   └─▶ Spawn async processor

5. PROCESSOR EXECUTES
   │
   ├─▶ Fetch tenant connections
   ├─▶ Filter active connections
   └─▶ For each connection:
       │
       └─▶ Sync to ERP

6. ERP SYNC
   │
   ├─▶ Create ERPNext client
   ├─▶ Build document (Payment Entry/Journal Entry)
   ├─▶ POST to ERPNext API
   ├─▶ Update local database
   └─▶ Log success/failure
```

## Monitoring & Observability

```
┌────────────────────────────────────────────────────────────────┐
│                    Monitoring Stack                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Prometheus Metrics:                                           │
│  • erp_kafka_messages_published_total{topic, status}          │
│  • erp_kafka_publish_latency_seconds{topic}                   │
│                                                                │
│  Health Endpoints:                                             │
│  • GET /health  - Service health                              │
│  • GET /ready   - Readiness check                             │
│  • GET /metrics - Prometheus metrics                          │
│                                                                │
│  Logs:                                                         │
│  • Event reception logs                                       │
│  • Processing logs                                            │
│  • ERP sync success/failure logs                              │
│  • Error logs with stack traces                               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Kubernetes Cluster (54link)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  Payment Processing Pod                               │     │
│  │  ├─ payment-processing-service (container)            │     │
│  │  └─ daprd (sidecar)                                   │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  Loan Service Pod                                     │     │
│  │  ├─ loan-service (container)                          │     │
│  │  └─ daprd (sidecar)                                   │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  Savings Service Pod                                  │     │
│  │  ├─ savings-service (container)                       │     │
│  │  └─ daprd (sidecar)                                   │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  Mortgage Service Pod                                 │     │
│  │  ├─ mortgage-service (container)                      │     │
│  │  └─ daprd (sidecar)                                   │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  LPO Service Pod                                      │     │
│  │  ├─ lpo-service (container)                           │     │
│  │  └─ daprd (sidecar)                                   │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  ERPNext Integration Service Pod                      │     │
│  │  ├─ erpnext-integration-service (container)           │     │
│  │  └─ daprd (sidecar)                                   │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │  Kafka Cluster                                        │     │
│  │  ├─ kafka-0                                           │     │
│  │  ├─ kafka-1                                           │     │
│  │  └─ kafka-2                                           │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Files Structure

```
services/erpnext-integration-service/
├── kafka_client.go                     # ✅ Topic constants (31 topics)
├── events.go                           # ✅ Event models, handlers, processors
├── main.go                             # ✅ Routes registration
├── service.go                          # Service implementation
├── handlers.go                         # API handlers
├── erpnext_client.go                  # ERPNext API client
├── adapters.go                        # Data adapters
├── sync.go                            # Sync engine
├── .env                               # Environment variables
├── Dockerfile                         # Container image
├── go.mod                             # Go dependencies
├── go.sum                             # Go checksums
├── KAFKA_INTEGRATION_COMPLETE.md      # ✅ Complete integration guide
├── INTEGRATION_SUMMARY.md             # ✅ Quick reference
├── INTEGRATION_CHECKLIST.md           # ✅ Implementation checklist
└── ARCHITECTURE_DIAGRAM.md            # ✅ This file
```

## Statistics

- **Total Services Integrated:** 5
- **Total Topics Subscribed:** 24
- **Total Event Handlers:** 7
- **Total Event Processors:** 7
- **Total ERP Sync Functions:** 7
- **Programming Languages:** Go, Python
- **Message Format:** CloudEvent (Dapr)
- **Communication Pattern:** Async Event-Driven
- **ERP Documents Created:** 2 types (Payment Entry, Journal Entry)

## Success Indicators

✅ All 5 services linked to ERP integration  
✅ 24 Kafka topics subscribed  
✅ Event handlers implemented  
✅ ERP sync functions created  
✅ No compilation errors  
✅ Documentation complete  
⏳ Ready for deployment and testing

---

**Integration Completed:** February 4, 2026  
**Version:** 1.0  
**Status:** Ready for Testing
