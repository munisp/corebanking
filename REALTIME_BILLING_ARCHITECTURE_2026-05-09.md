# 54Bank Real-Time Billing Architecture and Schema

## Executive Summary

The current 54Bank project already persists operational records such as workflows, operator actions, audit entries, export jobs, customer bill payments, and partner commercial metadata, but it does not yet contain a **true event-driven billing engine** with usage-event metering, rate-card-based rating, accrued-charge computation, invoice preparation, or billing-period controls.[1] [2] This document defines the target architecture for a next-generation billing engine that captures billable platform activity in real time, rates it against tenant-specific contracts, computes accrued charges continuously, and exposes an operator-grade billing dashboard inside the 54Bank admin experience.

The design intentionally separates **event capture**, **rating**, **accrual**, **invoice preparation**, **settlement**, and **analytics** into distinct service boundaries. That separation supports both immediate operator visibility and future scale-out into a polyglot service estate. TypeScript remains the primary language for the current web application and dashboard surfaces, while **Go** is designated for high-throughput ingestion and gateway adapters, **Rust** is designated for deterministic rating and accrual workers, and **Python** is designated for analytics, anomaly detection, reconciliation intelligence, and lakehouse pipelines.

## Current-State Constraint Summary

| Area | Current project state | Architectural implication |
| --- | --- | --- |
| Billing UI | The current billing screen is an archive-style operational workspace driven by export jobs, audit entries, actions, and workflow records.[3] | Existing UI can be extended, but it is not yet a billing engine. |
| Pricing | The pricing model is a client-side scenario calculator with no live platform usage linkage.[4] [5] | Proposal pricing can seed rate cards, but it is not an operational billing source of truth. |
| Persistence | The schema currently contains customer transaction/support tables, workflow/audit/export tables, and partner commercial metadata, but no usage-event, rate-card, or invoice tables.[1] | New billing-specific tables are required. |
| Runtime data | The platform persistence layer already supports list/create/update/hydrate/sync patterns against the database-backed runtime.[2] | Billing engine tables and APIs can follow the same extension pattern. |
| Middleware posture | The server already models middleware-aware routes and service contracts for Kafka-like publication, ledger, reconciliation, and partner onboarding workflows.[3] | Billing services can be introduced without changing the entire operating model. |

## Architectural Principles

The billing engine should be designed around immutable usage evidence, deterministic rating, auditability, and replay safety. The platform must be able to answer four questions at any time: **what happened, why it is billable, which contract governed the charge, and how the accrued amount was computed**. To achieve that, every business event must be stored before rating, every rated event must preserve the applied pricing rule, and every accrual summary must remain traceable back to individual usage events.

A second principle is that billing is not only an invoice function. It is also a **control function**. The same billing engine must support operations, finance, compliance, settlement, revenue assurance, and customer success. For that reason, the dashboard must expose not only totals, but also ingestion lag, unrated events, disputed charges, threshold alerts, and tenant-level contract drift.

## Target Service Topology

| Service | Primary language | Core responsibility | Key middleware and infrastructure |
| --- | --- | --- | --- |
| Billing Gateway | TypeScript | Admin APIs, dashboard queries, rate-card CRUD, invoice preparation endpoints | PostgreSQL, Redis, Keycloak, Permify, APISIX, OpenAppSec |
| Usage Ingestor | Go | High-throughput ingestion of billing events from services and gateways | Kafka, Dapr pub/sub, APISIX, Redis |
| Rating Worker | Rust | Deterministic rating of raw usage events against rate-card lines | Kafka or Fluvio, PostgreSQL, Redis |
| Accrual Orchestrator | Rust | Incremental accrued-charge updates, threshold checks, period close preparation | Temporal, PostgreSQL, Redis |
| Analytics and Revenue Intelligence | Python | Forecasting, anomaly detection, cost-to-serve analytics, lakehouse exports | Lakehouse, OpenSearch, PostgreSQL |
| Settlement and Ledger Bridge | Go | Posting invoice-ready journals and settlement movements into downstream finance and ledger rails | TigerBeetle, Mojaloop, Kafka, PostgreSQL |
| Admin Dashboard | TypeScript | Operator UI for usage, rate cards, accruals, disputes, and invoice status | Existing React admin shell, platform APIs |

## End-to-End Data Flow

The target runtime sequence is as follows. A billable action occurs in a domain service such as customer onboarding, payments, cards, statements, branch provisioning, API access, or user administration. That domain emits a structured billing event using Dapr pub/sub or a direct Kafka-compatible publish path. The Go Usage Ingestor validates and normalizes the payload, enforces idempotency, enriches the event with tenant and contract context, and persists it as an immutable usage event.

The Rust Rating Worker then consumes unrated events, matches each event to the active billing account, subscription, and applicable rate-card line, and produces one or more rated usage records. The Accrual Orchestrator updates period-to-date accrued balances and overage counters in near real time. Threshold breaches, contract anomalies, or unusual pricing drift are pushed to Redis-backed hot views and OpenSearch-backed observability indexes. The TypeScript admin dashboard reads from billing summaries and drill-down tables for operator visibility. Finally, scheduled bill runs and settlement handoffs are orchestrated through Temporal.

## Middleware Integration Model

| Middleware / platform | Billing-engine role |
| --- | --- |
| **Kafka** | Main event backbone for usage-event ingress, rating completion events, accrual updates, invoice-ready signals, and finance handoff events. |
| **Dapr** | Standardized publish/subscribe, secrets, service invocation, and retry envelopes for internal billing service integration. |
| **Fluvio** | Optional high-throughput stream path for isolated billing-rating workloads where lower operational friction is preferred for event replay and consumer partitioning. |
| **Temporal** | Billing-period close orchestration, rerating flows, dispute workflows, invoice issuance workflows, and backfill/replay jobs. |
| **PostgreSQL** | System of record for billing accounts, rate cards, usage events, rated events, accruals, invoices, adjustments, and billing periods. |
| **Keycloak** | Authentication and operator identity for billing admin APIs and service-to-service identity where required. |
| **Permify** | Fine-grained authorization for commercial, finance, compliance, and operations roles over rate cards, invoices, disputes, and billing accounts. |
| **Redis** | Hot cache for tenant accrual dashboards, threshold counters, ingestion lag indicators, and active contract lookup. |
| **Mojaloop** | Settlement and payout bridge for invoice settlement or partner revenue-sharing disbursement where external movement is required. |
| **OpenSearch** | Event observability, billing anomaly traces, dispute search, and operational debugging across the billing service estate. |
| **OpenAppSec** | API protection for ingestion and admin billing endpoints, especially external or partner-facing event submission paths. |
| **APISIX** | API gateway, routing, rate-limiting, authentication policy enforcement, and external exposure of billing APIs. |
| **TigerBeetle** | High-integrity posting rail for charge ledger entries, settlement staging, and downstream financial posting consistency. |
| **Lakehouse** | Historical revenue analytics, cost analysis, cohort monetization views, backtesting, and pricing optimization workloads. |

## Billing Domain Model

The billing engine should introduce the following persistent entities.

| Entity | Purpose | Cardinality / notes |
| --- | --- | --- |
| `billing_accounts` | Top-level tenant billing identity and contract binding | One per tenant or contract segment |
| `billing_subscriptions` | Active commercial subscription or plan per billing account | One or many per billing account |
| `billing_rate_cards` | Versioned rate-card header controlling pricing model applicability | Versioned and date-effective |
| `billing_rate_card_lines` | Detailed unit pricing, bands, minimums, and formulas | Many per rate card |
| `billing_usage_events` | Immutable raw usage signals received from platform services | High-volume append-only table |
| `billing_rated_events` | Rated output derived from raw events and active pricing rules | One or many per usage event |
| `billing_accrual_snapshots` | Aggregated current accrued balances by tenant/period/metric | Continuously updated |
| `billing_periods` | Explicit billing-cycle control rows, close state, and rerun markers | Monthly or custom periods |
| `billing_invoice_headers` | Draft/final invoice records per tenant and billing period | One per bill run / tenant / currency |
| `billing_invoice_lines` | Invoice line items sourced from rated events or adjustments | Many per invoice |
| `billing_adjustments` | Credits, waivers, manual corrections, rerate deltas | Independent and traceable |
| `billing_balance_ledger` | Running balance, payment allocation, write-off, and settlement state | Optional if finance needs full subledger visibility |
| `billing_contract_overrides` | Tenant-specific pricing overrides, discounts, free tiers, caps | Applied during rating |
| `billing_threshold_alerts` | Threshold and anomaly events for operator visibility | Generated from accrual engine |

## Recommended Schema Additions

### `billing_accounts`

| Column | Type | Description |
| --- | --- | --- |
| `billingAccountId` | varchar(64) | Stable business identifier |
| `tenantId` | varchar(64) | Owning tenant |
| `accountName` | varchar(191) | Display name |
| `billingModel` | enum | Subscription, usage, hybrid, revenue share |
| `currency` | varchar(3) | ISO currency |
| `status` | enum | Draft, active, suspended, closed |
| `contractStartAt` | timestamp | Contract start |
| `contractEndAt` | timestamp nullable | Contract end |
| `defaultRateCardId` | varchar(64) | Active rate-card reference |
| `minimumCommitAmount` | double | Monthly or period minimum commit |
| `createdAt` / `updatedAt` | timestamp | Audit timestamps |

### `billing_rate_cards`

| Column | Type | Description |
| --- | --- | --- |
| `rateCardId` | varchar(64) | Stable identifier |
| `billingAccountId` | varchar(64) nullable | Tenant-specific or global |
| `name` | varchar(191) | Human-readable name |
| `version` | int | Monotonic version |
| `status` | enum | Draft, approved, active, retired |
| `effectiveFrom` / `effectiveTo` | timestamp | Pricing window |
| `pricingCurrency` | varchar(3) | Currency |
| `createdBy` | varchar(96) | Operator or service actor |
| `approvalState` | enum | Pending, approved, rejected |
| `createdAt` / `updatedAt` | timestamp | Audit timestamps |

### `billing_rate_card_lines`

| Column | Type | Description |
| --- | --- | --- |
| `rateCardLineId` | varchar(64) | Stable identifier |
| `rateCardId` | varchar(64) | Parent rate card |
| `meterKey` | varchar(96) | Billable metric such as `api_call`, `active_customer`, `seat`, `transfer_posted` |
| `productKey` | varchar(96) | Domain such as payments, customer, cards |
| `chargeType` | enum | Flat, per-unit, tiered, percentage, minimum, cap |
| `unitPrice` | double | Primary unit amount |
| `includedUnits` | bigint | Included allowance |
| `tierStart` / `tierEnd` | bigint nullable | Tier boundaries |
| `minimumCharge` | double nullable | Minimum charge floor |
| `maximumCharge` | double nullable | Optional cap |
| `pricingFormula` | json | Structured rule payload for complex rating |
| `settlementLedgerCode` | varchar(96) nullable | Finance posting mapping |
| `createdAt` / `updatedAt` | timestamp | Audit timestamps |

### `billing_usage_events`

| Column | Type | Description |
| --- | --- | --- |
| `usageEventId` | varchar(64) | Stable event identifier |
| `idempotencyKey` | varchar(128) | Duplicate protection |
| `tenantId` | varchar(64) | Owning tenant |
| `billingAccountId` | varchar(64) nullable | Bound billing account |
| `sourceService` | varchar(96) | Producer service |
| `sourceEventType` | varchar(96) | Domain event type |
| `meterKey` | varchar(96) | Billing meter |
| `productKey` | varchar(96) | Product domain |
| `quantity` | bigint | Usage amount |
| `unitAmount` | double nullable | Monetary basis from source if any |
| `currency` | varchar(3) | Currency |
| `eventTimestamp` | timestamp | Business event time |
| `ingestedAt` | timestamp | Ingestion time |
| `correlationId` | varchar(128) nullable | End-to-end trace linkage |
| `actorId` | varchar(96) nullable | User, operator, or system actor |
| `resourceId` | varchar(96) nullable | Object billed |
| `payload` | json | Source payload snapshot |
| `status` | enum | Pending, rated, ignored, failed |

### `billing_rated_events`

| Column | Type | Description |
| --- | --- | --- |
| `ratedEventId` | varchar(64) | Stable rating output identifier |
| `usageEventId` | varchar(64) | Parent usage event |
| `rateCardId` | varchar(64) | Applied rate-card version |
| `rateCardLineId` | varchar(64) | Applied pricing rule |
| `billingPeriodKey` | varchar(32) | Such as `2026-05` |
| `quantityRated` | bigint | Rated quantity |
| `billableUnits` | double | Units after allowance treatment |
| `amountAccrued` | double | Rated monetary amount |
| `currency` | varchar(3) | Currency |
| `ratingExplanation` | json | Why the amount was computed |
| `ratedAt` | timestamp | Rating timestamp |
| `reversalOfRatedEventId` | varchar(64) nullable | Supports reversals and rerates |

### `billing_accrual_snapshots`

| Column | Type | Description |
| --- | --- | --- |
| `accrualSnapshotId` | varchar(64) | Stable identifier |
| `tenantId` | varchar(64) | Tenant |
| `billingAccountId` | varchar(64) | Billing account |
| `billingPeriodKey` | varchar(32) | Billing period |
| `meterKey` | varchar(96) | Metric or rollup scope |
| `productKey` | varchar(96) | Product or cross-product summary |
| `ratedEventCount` | bigint | Count of rated events |
| `usageQuantity` | bigint | Total usage |
| `accruedAmount` | double | Current accrued charge |
| `unratedEventCount` | bigint | Pending rating backlog |
| `lastUsageAt` | timestamp nullable | Last business event seen |
| `lastRatedAt` | timestamp nullable | Last successful rating |
| `snapshotStatus` | enum | Healthy, lagging, review |
| `createdAt` / `updatedAt` | timestamp | Audit timestamps |

## Core Event Types

| Event type | Meter key | Typical rating basis |
| --- | --- | --- |
| `customer.activated` | `active_customer` | Per active customer band or included allowance |
| `seat.assigned` | `named_user` | Per named seat or seat block |
| `branch.activated` | `branch` | Per branch above included baseline |
| `environment.provisioned` | `environment` | Per non-production environment |
| `transfer.posted` | `transaction_posted` | Per transaction or by value band |
| `statement.generated` | `statement_export` | Per statement export or bundle |
| `card.issued` | `card_issued` | Per physical or virtual card issuance |
| `api.call.completed` | `api_call` | Per 1,000 calls or by endpoint class |
| `merchant.settlement.completed` | `merchant_settlement` | Percentage or flat settlement charge |
| `partner.launch.ready` | `tenant_launch` | One-time provisioning or implementation milestone |

## Real-Time Rating Lifecycle

When a usage event arrives, the ingestor first authenticates and authorizes the producer path using APISIX, OpenAppSec, Keycloak-issued tokens where appropriate, and service-level metadata. It then validates the event schema, computes a canonical idempotency key, writes the event to PostgreSQL, and publishes an `usage_event.accepted` signal.

The rating worker consumes accepted events and resolves the active billing account. It then loads the applicable rate-card version from Redis or PostgreSQL, evaluates matching rules, computes allowance offsets and tier boundaries, and writes a rated event. A follow-up accrual update event is emitted, allowing the accrual service to maintain near-live billing totals without performing expensive full-period reaggregation on every dashboard request.

## Temporal Workflows

Temporal should orchestrate the workflows that require coordination, retries, and clear state progression.

| Workflow | Purpose |
| --- | --- |
| `BillingPeriodOpenWorkflow` | Open a new billing period and preload tenant accrual ledgers |
| `UsageReplayWorkflow` | Reprocess historical events after pricing changes or source outage |
| `ReratingWorkflow` | Reverse and recompute rated events when rate-card changes are approved retroactively |
| `InvoicePreparationWorkflow` | Freeze period scope, summarize rated events, and build draft invoices |
| `InvoiceApprovalWorkflow` | Route invoices through commercial, finance, and compliance approvals |
| `SettlementPostingWorkflow` | Post approved invoice and settlement entries into TigerBeetle and downstream systems |
| `ThresholdEscalationWorkflow` | Raise threshold alerts and operator tasks for unusual billing spikes |

## Security and Governance Model

The billing engine must treat pricing rules and accrual outputs as privileged operational data. Rate cards should only be editable by commercial administrators and approvers. Invoice approval should require explicit finance role membership. Usage-event ingestion should be service-authenticated and never rely on browser-submitted payloads for authoritative charges.

| Control area | Recommended approach |
| --- | --- |
| Authentication | Keycloak for operators and service identities |
| Authorization | Permify policies for rate-card edits, invoice approvals, disputes, and write-off actions |
| API perimeter | APISIX plus OpenAppSec for external and admin billing APIs |
| Event integrity | Idempotency keys, correlation IDs, append-only usage-event storage |
| Auditability | Mirror all billing mutations into auditable events and operator audit trails |
| Data protection | Encrypt secrets at rest, enforce TLS in transit, redact sensitive payload fields |

## Dashboard Requirements

The accrued-charge dashboard should provide both executive and operator depth. Executive views should show current accrued revenue, top revenue meters, top tenants by accrued value, unrated-event backlog, and invoice readiness. Operator views should expose event ingestion lag, failed rating attempts, threshold breaches, recent adjustments, and drill-down from accrual total to rated event to raw usage event.

| Dashboard section | Purpose |
| --- | --- |
| Current accrued totals | Show period-to-date revenue and variance against forecast |
| Meter composition | Show which products and meters are driving charges |
| Tenant exposure | Show highest-accruing tenants and those near thresholds |
| Event pipeline health | Show ingestion lag, failed ratings, and unrated backlog |
| Contract and rate-card state | Show active contracts, pending approvals, and override risks |
| Adjustment and dispute lane | Show credits, manual changes, and exceptions |

## Implementation Strategy for This Project

The practical implementation path inside the current 54Bank codebase should be staged.

| Stage | Scope |
| --- | --- |
| Stage 1 | Add schema and runtime support for billing accounts, rate cards, usage events, and accrual snapshots |
| Stage 2 | Expose TypeScript platform APIs for usage-event creation, rate-card retrieval, and accrued-charge dashboards |
| Stage 3 | Add an operator dashboard page and billing-engine workspace in the React admin shell |
| Stage 4 | Add service stubs and reference adapters for Go ingestion, Rust rating, and Python analytics pipelines |
| Stage 5 | Introduce Temporal-driven period-close and rerating workflows |

## Polyglot Service Responsibilities

### Go Services

Go should own the **ingress and connectivity-heavy services**. That includes APISIX-facing ingestion endpoints, Dapr service invocation adapters, Kafka producers or consumers where low-latency throughput is important, and finance-settlement handoff bridges to TigerBeetle or Mojaloop.

### Rust Services

Rust should own the **rating and accrual-critical services** where determinism, performance, and memory safety matter most. The rating worker should be able to replay large event ranges, apply complex tier logic, and keep billing computations stable under high throughput.

### Python Services

Python should own **analytics and intelligence services**, especially revenue anomaly detection, customer monetization segmentation, expected-versus-actual charge monitoring, and lakehouse pipelines that export long-horizon data for finance and product teams.

### TypeScript Services

TypeScript should continue to own **admin APIs, operator dashboards, configuration UX, and integration surfaces already embedded in the current 54Bank web application**. The immediate project implementation should therefore begin in TypeScript while exposing clean integration seams for Go, Rust, and Python services.

## Design Notes on Scheduling

The requested project guidance file for scheduled workloads was not present in the repository, and the bootstrap command referenced by the project instructions was unavailable in the current sandbox session. For that reason, the architecture in this document defines Temporal-based billing-period and rerating workflows conceptually, while keeping the initial code implementation focused on **real-time event capture, rate-card management, and accrued-charge views** rather than scheduled bill-run automation.

## Immediate Build Scope

The initial implementation following this design should therefore deliver three production-shaped foundations inside the active project:

| Priority | Deliverable |
| --- | --- |
| 1 | Usage-event capture APIs and persisted event records |
| 2 | Rate-card and rate-card-line data structures with active pricing lookup |
| 3 | Accrued-charge dashboard APIs and admin UI |

These foundations create the minimal viable next-generation billing engine while preserving an upgrade path toward invoices, disputes, rerating, settlement, and lakehouse-backed revenue intelligence.

## References

[1] `file:///home/ubuntu/54bank-ui/drizzle/schema.ts` — *Current persisted schema showing billing-adjacent records and missing billing-engine entities*  
[2] `file:///home/ubuntu/54bank-ui/server/platformPersistence.ts` — *Runtime persistence patterns available for extending the billing engine*  
[3] `file:///home/ubuntu/54bank-ui/server/index.ts` — *Current platform runtime services, middleware-aware routes, and billing-adjacent control-room implementation*  
[4] `file:///home/ubuntu/54bank-ui/client/src/components/PricingModelTool.tsx` — *Client-side dynamic pricing calculator*  
[5] `file:///home/ubuntu/54bank-ui/shared/pricingModel.ts` — *Shared scenario-based pricing model engine* 
