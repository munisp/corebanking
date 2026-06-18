# Runbook: Payment Processing Failure
## Severity: P0
## Trigger: `PaymentProcessingFailure` or `NIPGatewayDown` alert

### Immediate Actions (First 5 minutes)
1. Check NIBSS NIP gateway status: health endpoint on nip-gateway-go
2. Verify payment-hub-go is healthy: `curl payments-hub-go:8080/healthz`
3. Check DLQ for queued payments: `curl payments-hub-go:8080/dlq`
4. Verify TigerBeetle ledger connectivity

### Diagnosis
- If NIP is down: Enable fallback routing (NEFT batch mode)
- If ledger is down: CRITICAL — halt all transactions, engage DBA
- If Kafka is down: Payments will queue, check broker health

### Recovery
1. Replay DLQ messages: `curl -X POST payments-hub-go:8080/dlq/replay`
2. Verify balances reconcile after recovery
3. Generate reconciliation report: check internal vs NIBSS records

### Communication
- Notify operations team immediately
- Update status page within 10 minutes
- Regulatory notification if >1 hour downtime (CBN requirement)
