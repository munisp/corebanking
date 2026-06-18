# Incident: DLQ-002 — Exhausted NIP Payment (₦1,500,000)

**Severity:** CRITICAL  
**Status:** REQUIRES IMMEDIATE MANUAL RESOLUTION  
**Detected:** 2026-05-09  
**Last Updated:** 2026-05-14

---

## Incident Summary

A ₦1,500,000 NIP (Nigeria Interbank Payment) transfer entered the Dead Letter Queue
after 5 failed retry attempts. The payment is in an indeterminate state: neither
completed at NIBSS nor reversed in the internal ledger.

**Customer funds are at risk.**

---

## Technical Details

| Field | Value |
|-------|-------|
| DLQ Entry ID | DLQ-002 |
| Original Topic | `banking.payments.nip.processed` |
| NIBSS Session ID | `000015260509120000000001` |
| Amount | ₦1,500,000 (150,000,000 kobo) |
| Sender Bank Code | 054 (54link-dev) |
| Receiver Bank Code | 058 (GTBank) |
| Failure Reason | NIBSS timeout after 30s |
| Retry Count | 5/5 (exhausted) |

---

## Required Investigation Steps

### Step 1: Query NIBSS for transaction status
```bash
# Call NIBSS status inquiry endpoint
curl -X POST https://api.nibss-plc.com.ng/nip/v2/statusenquiry \
  -H "Authorization: Bearer $NIBSS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionID": "000015260509120000000001",
    "destinationInstitutionCode": "058",
    "channelCode": "1",
    "authorizationCode": ""
  }'
```

**Expected response codes:**
- `00` — Transaction successful at NIBSS → funds already credited to receiver → mark resolved
- `26` — No transaction found → transaction never reached NIBSS → safe to reverse and refund
- `91` — Timeout/system malfunction → escalate to NIBSS helpdesk

### Step 2: Check internal ledger state
```bash
# Verify whether internal debit was already posted
curl -X GET "http://gl-engine-rs:8251/v1/gl/journals?tenant_id=..." \
  -H "x-tenant-id: <TENANT_ID>"
# Search for journal entries referencing NIBSS session 000015260509120000000001
```

### Step 3: Resolution based on NIBSS response

#### Scenario A: NIBSS confirms success (response code 00)
The money reached the receiver. Update internal records to reflect completion.
```bash
# Mark DLQ resolved with no compensation needed
curl -X POST http://kafka-broker-go:8201/v1/dlq/DLQ-002/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "action": "resolved",
    "operatorId": "<OPERATOR_KEYCLOAK_ID>",
    "notes": "NIBSS confirmed success (RC=00). Internal records updated."
  }'
```

#### Scenario B: NIBSS confirms failure (response code 26 — not found)
The transaction never reached NIBSS. Reverse the customer debit.
```bash
# 1. Post reversal journal entry in GL
curl -X POST http://gl-engine-rs:8251/v1/gl/journals \
  -H "x-tenant-id: <TENANT_ID>" \
  -H "x-keycloak-id: <OPERATOR_KEYCLOAK_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Reversal: DLQ-002 NIP payment — session 000015260509120000000001",
    "reference": "REV-DLQ-002",
    "lines": [
      {"accountCode": "2001001", "description": "Customer account credit (reversal)", "debitKobo": 0, "creditKobo": 150000000},
      {"accountCode": "2001002", "description": "Suspense debit (reversal)", "debitKobo": 150000000, "creditKobo": 0}
    ]
  }'

# 2. Mark DLQ resolved with compensation
curl -X POST http://kafka-broker-go:8201/v1/dlq/DLQ-002/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "action": "compensate",
    "operatorId": "<OPERATOR_KEYCLOAK_ID>",
    "notes": "NIBSS confirmed not found (RC=26). Customer refunded via journal REV-DLQ-002."
  }'

# 3. Notify customer
# Trigger notification service with SMS/email confirming refund
```

#### Scenario C: NIBSS system error (response code 91)
Escalate to NIBSS helpdesk immediately. Do not reverse until status is confirmed.
- Contact NIBSS Operations: ops@nibss-plc.com.ng
- Reference: Session ID 000015260509120000000001, Bank Code 054
- Hold funds in suspense account pending NIBSS response

---

## Post-Resolution Checklist

- [ ] NIBSS status confirmed and documented
- [ ] Internal GL entries match external reality
- [ ] Customer notified of outcome (completion or refund)
- [ ] DLQ-002 marked resolved in kafka-broker (`/v1/dlq/DLQ-002/resolve`)
- [ ] Incident report filed with CBN (if required — NIP failures > 24h)
- [ ] Root cause analysis: why did NIBSS timeout? Network issue? API key expiry?
- [ ] Retry logic reviewed: 5 retries in what timeframe? May need exponential backoff

---

## DLQ Resolution API Reference

```bash
# List all DLQ entries
GET http://kafka-broker-go:8201/v1/dlq

# Resolve a DLQ entry (actions: resolved, compensate, replay)
POST http://kafka-broker-go:8201/v1/dlq/{id}/resolve
Body: {"action": "resolved|compensate|replay", "operatorId": "...", "notes": "..."}

# View resolution audit log
GET http://kafka-broker-go:8201/v1/dlq/audit
```

---

## Prevention

1. **Add NIBSS status enquiry to NIP payment flow**: Before marking a NIP payment as failed, always query NIBSS status enquiry to confirm whether funds moved
2. **Increase retry backoff**: Current retry strategy (5 × immediate) should become exponential (5s, 30s, 2m, 10m, 30m)
3. **Add suspense account posting**: When a NIP payment enters DLQ, immediately credit a suspense GL account so funds are traceable
4. **Alert on DLQ exhaustion**: PagerDuty/OpsGenie alert should fire when any DLQ entry reaches max retries
