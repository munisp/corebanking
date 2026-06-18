# 54Bank Platform — KYC/KYB Trigger Events

**Total trigger points:** 40 (12 Kafka events + 20 gateway gates + 8 onboarding stages)

---

## 1. Kafka Event Triggers (12 topics)

Consumed by `kyc-event-consumer-py` (port 9460). When a Kafka event is published, the consumer automatically triggers KYC/KYB verification workflows for the affected customer/company.

| # | Kafka Topic | Event | KYC Level | Condition | Services Affected | Cooldown |
|---|------------|-------|-----------|-----------|-------------------|----------|
| 1 | `account.opened` | Account Opened | standard | Tier ≥ 2 OR product is current/domiciliary/fixed_deposit | account-opening-go, customer-360-py | None |
| 2 | `loan.application.submitted` | Loan Application | enhanced | Amount ≥ ₦500K OR mortgage/corporate | loan-origination-go, credit-facility-go | 24h |
| 3 | `trade.lc.opened` | Trade Finance LC | full_edd + **KYB** | Amount ≥ ₦1M OR counterparty not in NG/US/UK | trade-finance-go, supply-chain-finance-go | 72h |
| 4 | `card.issuance.requested` | Card Issuance | basic (credit→enhanced) | Credit card requires enhanced, debit card basic | card-management-go | None |
| 5 | `payment.international.initiated` | International Payment | enhanced | Amount ≥ $1,000 USD OR high-risk destination | payments-hub-go, remittance-go, diaspora-banking-py | 48h |
| 6 | `fraud.alert.high_risk` | Fraud Alert | full_edd | Risk score ≥ 80 OR identity fraud/account takeover | fraud-detection-rs, risk-scoring-rs | None |
| 7 | `kyc.periodic_review.due` | Periodic Review | standard | Last KYC date + interval expired | temporal-sagas-go, cif-management-go | 1 year |
| 8 | `agent.onboarded` | Agent Onboarding | full_edd | All agents (super_agent, agent) | agent-banking-go | None |
| 9 | `cbn.circular.kyc_refresh_mandate` | CBN Mandate | enhanced | Affected tiers match customer tier | cbn-returns-py, regulatory-reporting-py | None |
| 10 | `wealth.client.onboarded` | Wealth Client | full_edd | AUM ≥ ₦50M OR PEP flag | wealth-mgmt-py, custody-service-go | None |
| 11 | `insurance.policy.bound` | Insurance Policy | enhanced | Sum assured ≥ ₦10M | insurance-py | 7 days |
| 12 | `virtual_account.created` | Virtual Account | standard | Corporate type OR limit ≥ ₦5M | virtual-accounts-go, escrow-go | 24h |

### KYC Level Hierarchy

```
basic (1) < standard (2) < enhanced (3) < full_edd (4)
```

### Cooldown Behavior

Cooldown prevents duplicate KYC triggers for the same customer/topic within the configured window. A cooldown of `0` means every event triggers immediately. A cooldown of `8760` hours (1 year) means periodic reviews trigger once annually.

---

## 2. Gateway Middleware Triggers (20 gate rules)

Enforced by `kycEnforcementMiddleware.ts` in the Express gateway. Every matching HTTP request (POST/PUT) is intercepted and KYC/KYB status is checked before the request is proxied to the backend service.

### Enforcement Modes

| Mode | Behavior |
|------|----------|
| `enforcing` | Block request with 403 if KYC/KYB not verified |
| `monitoring` | Allow request but log violation for audit |
| `disabled` | Pass through without check |

### Gate Rules

| # | Path Pattern | Service | KYC Level | KYB Required | Bypass Conditions |
|---|-------------|---------|-----------|:---:|-------------------|
| 1 | `/api/platform/accounts/applications` | account-opening-go | standard | No | Tier 1 basic savings |
| 2 | `/api/platform/loan-origination/*` | loan-origination-go | enhanced | No | — |
| 3 | `/api/platform/trade-finance/lcs\|guarantees` | trade-finance-go | full_edd | **Yes** | — |
| 4 | `/api/platform/card-management/cards/issue\|activate` | card-management-go | basic | No | Debit card Tier 1 |
| 5 | `/api/platform/payments/international\|bulk` | payments-hub-go | standard | No | Amount below ₦50K |
| 6 | `/api/platform/agent-banking/agents/register\|activate` | agent-banking-go | full_edd | No | — |
| 7 | `/api/platform/mortgage/applications\|disbursements` | mortgage-servicing-rs | full_edd | No | — |
| 8 | `/api/platform/escrow/accounts/create\|release` | escrow-go | enhanced | **Yes** | — |
| 9 | `/api/platform/supply-chain/programs\|invoices/finance` | supply-chain-finance-go | enhanced | **Yes** | — |
| 10 | `/api/platform/wealth-mgmt/clients\|portfolios` | wealth-mgmt-py | full_edd | No | — |
| 11 | `/api/platform/islamic-banking/murabaha\|sukuk` | islamic-banking-py | enhanced | No | — |
| 12 | `/api/platform/diaspora/accounts\|transfers` | diaspora-banking-py | enhanced | No | — |
| 13 | `/api/platform/remittance/transfers\|beneficiaries` | remittance-go | enhanced | No | — |
| 14 | `/api/platform/syndicated-loans/facilities\|participations` | syndicated-loans-go | full_edd | **Yes** | — |
| 15 | `/api/platform/factoring/agreements\|invoices/advance` | factoring-go | enhanced | **Yes** | — |
| 16 | `/api/platform/open-banking/consents\|payments/initiate` | open-banking-go | standard | No | Read-only consent |
| 17 | `/api/platform/insurance/policies/bind\|claims` | insurance-py | enhanced | No | Sum assured below ₦1M |
| 18 | `/api/platform/onboarding/validate-bvn\|validate-nin` | customer-onboarding | basic | No | BVN/NIN self-service |
| 19 | `/api/platform/customers` | customer-creation | basic | No | Tier 1 basic only |
| 20 | `/api/platform/custody/accounts\|assets/transfer` | custody-service-go | full_edd | **Yes** | — |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/platform/kyc-enforcement/status` | GET | Current enforcement mode, rule count, store sizes |
| `/api/platform/kyc-enforcement/mode` | PUT | Switch enforcement mode (enforcing/monitoring/disabled) |
| `/api/platform/kyc-enforcement/log` | GET | Decision log (allowed/blocked/monitored per request) |
| `/api/platform/kyc-enforcement/records` | GET | All KYC/KYB verification records |
| `/api/platform/kyc-enforcement/check` | POST | Manual KYC status check for a customer |
| `/api/platform/kyc-enforcement/rules` | GET | All 20 gate rules with patterns and conditions |

---

## 3. Customer Onboarding Stage Triggers (8 steps)

Enforced by `customerOnboarding.ts`. Each stage blocks progression until the KYC step passes. The onboarding workflow is a sequential state machine — no stage can be skipped.

### Onboarding Flow

```
draft → bvn_pending → bvn_verified → nin_pending → nin_verified →
liveness_pending → liveness_passed → documents_pending → under_review →
approved / rejected
```

### KYC Requirements by Tier

| Step | KYC Action | Tier 1 | Tier 2 | Tier 3 |
|------|-----------|:------:|:------:|:------:|
| 1 | BVN verification (NIBSS) | ✓ Required | ✓ Required | ✓ Required |
| 2 | NIN cross-check (NIMC) | — | ✓ Required | ✓ Required |
| 3 | Liveness check (passive + active) | — | ✓ Required | ✓ Required |
| 4 | Document upload + OCR (PaddleOCR/VLM) | — | — | ✓ Required |
| 5 | Sanctions screening (OFAC/EU/UN/CBN) | — | — | ✓ Required |
| 6 | PEP check | — | — | ✓ Required |
| 7 | Risk scoring | — | — | ✓ Required |
| 8 | Account creation | After step 1 | After step 3 | After step 7 |

### CBN Tier Limits

| Tier | KYC Level | Max Balance | Max Daily Transfer |
|------|-----------|-------------|-------------------|
| Tier 1 | basic (BVN only) | ₦300,000 | ₦50,000 |
| Tier 2 | standard (BVN + NIN + liveness) | ₦500,000 | ₦200,000 |
| Tier 3 | enhanced (full KYC + docs + sanctions + PEP) | Unlimited | Unlimited |

### Rejection Triggers

| Condition | Action |
|-----------|--------|
| Sanctions match (OFAC/EU/UN/CBN) | Immediate rejection + compliance escalation |
| PEP flag (no clearance) | Immediate rejection + EDD referral |
| Risk score ≥ 70 | Rejection + manual review required |
| BVN validation failure | Blocked at step 1 — cannot proceed |
| Liveness failure (after retry) | Blocked — manual video KYC referral |

### Onboarding Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/platform/onboarding/applications` | GET | List all onboarding applications |
| `/api/platform/onboarding/applications` | POST | Create new application (auto-starts KYC) |
| `/api/platform/onboarding/applications/:id` | GET | Get application with full kycGateLog |
| `/api/platform/onboarding/applications/:id/advance` | POST | Advance to next KYC stage |
| `/api/platform/onboarding/kyc-requirements/:tier` | GET | Required KYC steps for tier |
| `/api/platform/onboarding/stats` | GET | KYC completion funnel metrics |
| `/api/platform/onboarding/validate-bvn` | POST | BVN format validation |
| `/api/platform/onboarding/validate-nin` | POST | NIN format validation |

---

## 4. Service-Level KYC Checks (2 services)

In addition to gateway middleware, these services perform their own internal KYC verification before processing sensitive operations:

### account-opening-go

| Check | Condition | Action |
|-------|-----------|--------|
| Tier 1 bypass | Product is basic savings, Tier 1 | Allow — CBN mobile money rule |
| Tier 2 standard KYC | Tier 2 account | Call gateway `/api/platform/kyc-enforcement/check` — block if not verified |
| Tier 3 enhanced KYC | Tier 3 account | Call gateway — require enhanced level |
| KYC callback | `/v1/account-opening/kyc-verify` | Receive verification completion from KYC engine |

### loan-origination-go

| Check | Condition | Action |
|-------|-----------|--------|
| All loans | Any loan application | Require enhanced KYC minimum |
| Mortgage / ≥ ₦50M | Mortgage type OR amount ≥ ₦50M | Require full_edd |
| Corporate / ≥ ₦10M | SME/corporate OR amount ≥ ₦10M | Require enhanced |
| KYC callback | `/v1/loan-origination/kyc-callback` | Update pending_kyc loans to pending status |

---

## Summary

| Trigger Layer | Count | Enforcement |
|--------------|:-----:|-------------|
| Kafka event topics | 12 | Auto-trigger KYC/KYB workflows via event consumer |
| Gateway middleware rules | 20 | Intercept HTTP requests, block/log based on enforcement mode |
| Onboarding stage gates | 8 | Sequential state machine — each stage requires KYC step to pass |
| Service-level checks | 2 | Internal HTTP calls to gateway before processing |
| **Total** | **42** | Three-layer defense: gateway → service → event-driven |
