#!/bin/bash

# Test Payment Event Handler
echo "Testing Payment Event Handler..."

curl -X POST http://localhost:8080/events/payment \
  -H "Content-Type: application/json" \
  -d '{
  "id": "test-event-001",
  "source": "test",
  "type": "payment.event",
  "specversion": "1.0",
  "datacontenttype": "application/json",
  "data": {
    "type": "payment.processing.transaction",
    "payment_id": "test-pmt-12345",
    "tenant_id": "test-tenant",
    "customer_id": "test-customer",
    "amount": 1000.00,
    "currency": "NGN",
    "status": "completed",
    "payment_method": "bank_transfer",
    "timestamp": "2026-02-04T13:45:00Z"
  }
}'

echo -e "\n\nTesting Savings Event Handler..."

curl -X POST http://localhost:8080/events/savings \
  -H "Content-Type: application/json" \
  -d '{
  "id": "test-event-002",
  "source": "test",
  "type": "savings.event",
  "specversion": "1.0",
  "datacontenttype": "application/json",
  "data": {
    "type": "goal.created",
    "goal_id": "test-goal-789",
    "tenant_id": "test-tenant",
    "customer_id": "test-customer",
    "amount": 5000.00,
    "balance": 0.0,
    "status": "active",
    "timestamp": "2026-02-04T13:45:00Z"
  }
}'

echo -e "\n\nTesting Mortgage Event Handler..."

curl -X POST http://localhost:8080/events/mortgage \
  -H "Content-Type: application/json" \
  -d '{
  "id": "test-event-003",
  "source": "test",
  "type": "mortgage.event",
  "specversion": "1.0",
  "datacontenttype": "application/json",
  "data": {
    "type": "mortgage.payment",
    "mortgage_id": "test-mtg-001",
    "tenant_id": "test-tenant",
    "customer_id": "test-customer",
    "status": "paid",
    "amount": 25000.00,
    "timestamp": "2026-02-04T13:45:00Z"
  }
}'

echo -e "\n\nTesting LPO Event Handler..."

curl -X POST http://localhost:8080/events/lpo \
  -H "Content-Type: application/json" \
  -d '{
  "id": "test-event-004",
  "source": "test",
  "type": "lpo.event",
  "specversion": "1.0",
  "datacontenttype": "application/json",
  "data": {
    "type": "lpo.disbursed",
    "lpo_id": "test-lpo-001",
    "tenant_id": "test-tenant",
    "customer_id": "test-customer",
    "amount": 100000.00,
    "status": "disbursed",
    "timestamp": "2026-02-04T13:45:00Z"
  }
}'

echo -e "\n\n✅ All test events sent!"
echo "Check the service logs in the other terminal for processing results."
