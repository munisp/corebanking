# Alerting — Grafana OSS provisioning (B2)

Target tree path: `infrastructure/observability/grafana/provisioning/alerting/`
(corebanking @ 1c9134e2). Implements SPEC.md §4.

## Contents

| File | Purpose |
|---|---|
| `contactpoints.yaml` | Email (SMTP, env placeholders), generic webhook, Slack webhook, tenant webhook receivers |
| `policies.yaml` | Root policy, per-tenant route, money-path critical route, maintenance mute timing |
| `rules/availability.yaml` | ServiceDown, TigerBeetleUnavailable, IdempotencyStoreUnavailable, CollectorQueueBackpressure |
| `rules/money-path.yaml` | MoneyPathLatencyP95, DoubleDisburseGuard, EODRunFailed |
| `rules/integrity.yaml` | HighErrorRate, AuditShipFailureRate, SanctionsScreenErrorRate, FraudPrecheckErrorRate, TenantTrafficAnomaly |

## Channel configuration (no secrets inline)

Grafana provisioning expands `$VAR`/`${VAR}` at load time. Set these on the Grafana
container/environment; **nothing is committed**:

| Env var | Used by |
|---|---|
| `ALERT_EMAIL_TO` | `platform-email` receiver (comma-separated addresses; SMTP server itself is configured in `grafana.ini` `[smtp]`, also env-driven) |
| `ALERT_WEBHOOK_URL` / `ALERT_WEBHOOK_TOKEN` | `generic-webhook` receiver (optional Bearer auth) |
| `SLACK_WEBHOOK_URL` | `slack-alerts` receiver |
| `TENANT_WEBHOOK_URL` | `tenant-webhook` receiver (per-tenant fan-out, e.g. a tenant-router service) |

## Notification policies (`policies.yaml`)

Root policy groups by `service_name` + `severity` (repeat 4h, receiver `platform-email`):

1. **Per-tenant route** — matcher `tenant_id =~ ".+"` ("tenant_id exists"), groups by
   `tenant_id` + `alertname`, receiver `tenant-webhook`, `continue: true` so alerts also
   reach severity routes below. Carries the maintenance mute timing example
   (`maintenance-window-weekend`: Saturdays 02:00–06:00 UTC — edit to your change calendar).
2. **Money-path critical route** — `severity=critical` **and** `money_path=true`, tighter
   cadence (group_wait 15s, repeat 30m) to `slack-alerts`.
3. **All other criticals** → `slack-alerts` (repeat 1h).
4. **Warnings** → `generic-webhook` (repeat 12h).

### Per-tenant routing model

Per SPEC §2.3 the kits attach metric attribute `tenant.id` (source: `x-tenant-id` header,
then JWT `tenant_id` claim) **only on money-path services** (cardinality guard). The
collector's prometheus exporter must not drop it; Prometheus sanitizes the dot, so alerts
carry label **`tenant_id`**. The tenant route matches on that label's existence and groups
by it, so each tenant's alerts arrive as a separate notification group to
`tenant-webhook`. Services without tenant attribution fall through to the root/severity
routes unchanged. `tenant.id` is never minted by the collector — if the label is absent,
there is nothing to route per-tenant.

## Alert rules

12 rules across 3 groups, 1m evaluation interval, Prometheus datasource uid `prometheus`,
stable uids (`cb-*`, ≤40 chars). Every rule has `severity` + `team` labels and `summary` +
`runbook_hint` annotations. Audit context encoded:

| Rule | Audit finding it watches |
|---|---|
| AuditShipFailureRate | F15-1/F15-2 (22 services ship audit to an unauthenticated, unreachable audit-service, errors swallowed) |
| EODRunFailed | F15-13 / F2-01 (EOD hard-aborts at step 2 every night) |
| IdempotencyStoreUnavailable | F12-04 (fail-open idempotency store) |
| SanctionsScreenErrorRate | F12-01 (screen errors return "proceed") |
| FraudPrecheckErrorRate | F15-15 (fraud precheck fail-open against nonexistent `fraud-engine` host) |
| DoubleDisburseGuard | F11-07 / F4-5 (non-atomic loan disbursement; no idempotency on withdraw/deposit) |
| TigerBeetleUnavailable | F16-1 (adapter image unbuildable) + ledger criticality (money map TOP 20) |
| ServiceDown / HighErrorRate | F15-9/F15-14 (`up` is trusted precisely because /healthz lies) |
| MoneyPathLatencyP95, CollectorQueueBackpressure, TenantTrafficAnomaly | platform hygiene per SPEC §4 |

`finding` labels on money/compliance rules point back to the audit ledger.

## Honesty statement (SPEC §5) — VERIFIED vs REQUIRES-DEPLOYMENT

**Verified now:** all five YAML files parse with `yaml.safe_load` (checked in CI of this
wave); no secrets inline; rule uids stable; expressions are syntactically valid PromQL to
the extent checkable without a live Prometheus.

**NOT executed — requires the deployed observability stack.** These rules have not been
loaded by a running Grafana and have never fired. Specifically, the following depend on
other builders' artifacts or kit instrumentation landing first:

- `http_server_request_duration_seconds_{bucket,count}` with `service_name`, `tenant_id`,
  `http_route`, `http_response_status_code` labels — assumes OTel HTTP semconv histograms
  via the collector prometheus exporter/remote-write with `tenant.id` preserved (SPEC §2.3).
- Custom counters `audit_ship_failures_total`, `sanctions_screen_errors_total`,
  `fraud_precheck_errors_total`, `loan_disbursement_events_total`, `eod_run_failures_total`
  are emitted by the shared kits / service patches (B3–B6). Until they exist, those rules
  sit in NoData/OK — they are honest absence, not proof of health.
- `redis_up` covers **both** metric shapes: the IdempotencyStoreUnavailable selector is
  `(redis_up{job=~".*(idempotency|redis).*"} == 0) or (redis_up{service_name=~".*redis.*"} == 0)`
  because the collector's native `redis` receiver metrics carry `service_name` labels but
  **no** `job` label (B1 consistency finding), while a standalone redis-exporter scrape
  carries `job`. `up{job=~"tigerbeetle.*"}` assumes a TigerBeetle scrape
  target exists (sidecar per SPEC §3 if no native metrics endpoint).
- `otelcol_queue_size / otelcol_queue_capacity` assumes collector self-telemetry scrape.
- TenantTrafficAnomaly's z-score uses `avg_over_time`/`stddev_over_time` over a 24h
  `[24h:5m]` subquery — needs ≥24h of history before it can fire meaningfully.

Alert thresholds (5% 5xx, p95 > 2s, z > 3, queue > 80%) are starting defaults, tuned for
a banking money path; expect adjustment after first production baseline.

**This wave does not fix the underlying fiction** (audit F15/F16): healthz/metrics lies
(F15-9/10/12) remain; these rules watch `up` and kit-emitted counters precisely because the
services' own /healthz and /metrics cannot be trusted.
