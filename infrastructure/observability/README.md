# Observability Infrastructure — corebanking (wave-9, builder B1)

Stack: **OTel Collector** (ingest + middleware scrape + fan-out) → **Tempo** (traces),
**Prometheus** (metrics, via collector federation), **Loki** (logs), **Grafana OSS**
(provisioned datasources + dashboards). Alerting (contact points, policies, rules)
is owned by builder B2 and is **not** in this directory.

Target repo layout (lead copies these files):

```
infrastructure/observability/            <- everything except k8s-observability/
  docker-compose.observability.yml
  otel-collector/config.yaml
  prometheus/prometheus.yml
  tempo/tempo.yaml
  loki/loki-config.yaml
  grafana/provisioning/datasources/datasources.yaml
  grafana/provisioning/dashboards/dashboards.yaml
  grafana/dashboards/platform-overview.json
  grafana/dashboards/money-path.json
infrastructure/new/k8s/observability/    <- k8s-observability/*.yaml
```

## Interface contracts implemented (SPEC §2)

- OTLP gRPC `:4317` / HTTP `:4318` ingest on the collector — matches
  `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317` default.
- Every pipeline upserts `service.namespace=corebanking` and
  `deployment.environment=${DEPLOY_ENV:-dev}`.
- `tenant.id` (and `k8s.*`) attributes are never dropped; the collector does not
  mint tenant ids. The attributes processor only deletes `user_agent`, `cookie`,
  and `authorization` request-header attributes (defense-in-depth).
- Prometheus exporter on `:8889` sanitizes attribute keys `.` → `_`:
  `tenant.id` → label `tenant_id`, `service.name` → `service_name` — the exact
  label names B2's per-tenant notification policies and the money-path
  dashboard key on. This is exporter behavior (config-level guarantee), not
  runtime-verified here.
- `resource_to_telemetry_conversion` promotes resource attributes onto every
  federated metric so queries keep service origin.
- W3C propagation, SDK samplers, middleware configs (Dapr/APISIX/Keycloak/…)
  are other builders' scope.

## Scrape job names (contract with B2 / dashboards)

| job | target | port/path |
|---|---|---|
| `kafka-jmx` | Strimzi Kafka CR JMX exporter (B7 ConfigMap; primary). Fallback: standalone JMX agent via `KAFKA_JMX_PORT=5556` | `:9404` (primary) / `:5556` (fallback) |
| `postgres-exporter` | postgres_exporter | `:9187` |
| `redis-exporter` | redis_exporter | `:9121` |
| `keycloak` | keycloak management port — **requires B7's keycloak:24.0→v25+ image bump** (v25 moves metrics to :9000) | `:9000/metrics` |
| `permify` | permify | `:2112` |
| `opensearch` | Aiven prometheus-exporter plugin on main HTTP port — **plugin must be installed, version-locked to OS 2.12.0** (B7 prerequisite). `:9600` is Performance Analyzer (non-Prometheus), not scraped | `:9200/_prometheus/metrics` |
| `apisix` | apisix prometheus plugin | `:9091` |
| `temporal` | temporal server | `:8000` |
| `fluvio` | fluvio | `:9110` |
| `tigerbeetle-sidecar` | TB metrics sidecar (documented by B7) | `:9090` |
| `spark-sedona-jmx` | Spark/Sedona JMX exporter | `:8090` |
| `mojaloop` | **commented-out stub** (SPEC §3 upstream scrape, owner B7): host/port/path are deployment-specific placeholders with ADJUST markers; enable only after B7's mojaloop scrape config lands | placeholder `:4004/metrics` — requires deployment |

Cross-checked against B2 alert-rule regexes: `tigerbeetle.*` matches
`tigerbeetle-sidecar`; `.*(idempotency|redis).*` matches `redis-exporter`.
Known gap (documented, needs a decision): metrics from the collector's native
`redis` receiver carry `service_name` labels but **no** `job` label — alert
rules keyed on `job=~.*redis.*` only see the `redis-exporter` scrape job.

## Tail-sampling policy (traces)

100% of error traces; 100% of spans carrying `tenant.id` on money routes
(regex: payment|payout|disburse|transfer|settlement|ledger|transaction); 10%
probabilistic baseline. Tradeoffs are documented inline in
`otel-collector/config.yaml` (memory cost of `decision_wait`, dependency on
kits attaching `tenant.id`, regex maintenance, degradation past
`num_traces=50000`).

## Secrets

None committed. Required at deploy time:

- compose: `GRAFANA_ADMIN_PASSWORD` (no default — compose fails fast without it).
- k8s: Secrets `grafana-admin` (keys `admin-user`, `admin-password`) and
  `otel-metrics-credentials` (keys `postgres-username`, `postgres-password`,
  `redis-password`) must be created out-of-band. They are referenced with
  required `secretKeyRef` (no `optional: true` anywhere); pods stay Pending
  until the Secrets exist.
- Collector postgres/redis receiver credentials are env-only with empty
  defaults; if unset the receivers fail and the collector logs it (fail
  visible, never silent).

## Verified vs requires live deployment

**Verified statically (this wave, in the build sandbox):**

- All 13 YAML files parse with `python3 yaml.safe_load_all` — PASS (13/13):
  collector config, prometheus.yml, tempo.yaml, loki-config.yaml, grafana
  datasources + dashboards provider, compose file, and 6 k8s manifests
  (17 objects total: Namespace, 7 ConfigMaps, 5 Deployments, 5 Services).
- Both dashboard JSONs parse with `json.load` — PASS (2/2; uids
  `cb-platform-overview` / `cb-money-path`, 8 and 6 panels).
- Collector pipeline wiring cross-check (every receiver/processor/exporter/
  extension referenced in `service.pipelines` is defined) — PASS.
- Env-var coverage cross-check: every `${env:VAR}` in the collector config
  either has a default or is wired in compose/k8s — PASS (no undeclared
  required vars).
- Job-name/label contract vs B2 regexes — PASS (see table above).
- No `:latest` tags; pinned images: otelcol-contrib `0.114.0`, prometheus
  `v2.55.1`, tempo `2.6.1`, loki `3.2.1`, grafana `11.3.1`.

**NOT verified — requires a live deployment (stated honestly; nothing here
has been run):**

- No `docker`, `kubectl`, or `otelcol` binary existed in the build sandbox, so
  configs were **not** validated against component schemas (`otelcol-contrib
  validate`, `promtool check config`, `docker compose config`, `kubectl
  apply --dry-run=server`). YAML parses, but a component could still reject a
  field name/value. First live bring-up must run those validators.
- Image tags were chosen as known-good release lines but not pull-verified.
- Compose healthchecks for tempo/loki/grafana/prometheus assume busybox
  `wget` exists in those images (true for current alpine/busybox-based
  builds; not verifiable here). The **collector** image is distroless (no
  shell/wget): its compose healthcheck re-runs `otelcol-contrib validate`,
  which checks binary+config integrity but is NOT a process liveness probe.
  The k8s collector Deployment uses proper kubelet HTTP probes on the
  health_check extension (`:13133`).
- Dashboard queries assume the OTel HTTP server metric schema
  (`http_server_request_duration_seconds_*`); if kits emit a different
  semconv version, panel queries need adjustment.
- `tempo.yaml` local storage uses a named volume (compose) / emptyDir (k8s).
  k8s emptyDir = **no durability across pod restarts**; swap in PVCs for any
  environment that matters.
- Middleware prerequisites owned by B7 that gate scrape jobs here:
  Keycloak v25+ image bump (in-tree is 24.0 → `keycloak` job DOWN until then),
  OpenSearch prometheus-exporter plugin install (version-locked to OS 2.12.0
  → `opensearch` job DOWN until then), Strimzi JMX ConfigMap for Kafka :9404
  (`kafka-jmx` falls back to :5556 standalone agent via env), and the
  commented-out `mojaloop` stub (deployment-specific endpoints, ADJUST
  markers — do not enable blindly).
- SPEC §5 note carried forward: pre-existing healthz/metrics fiction (W8 F15)
  is not fixed by this wave — this stack will surface it, not mask it.

## Bring-up

```bash
export GRAFANA_ADMIN_PASSWORD=...   # required
docker compose -f docker-compose.observability.yml up -d
# Grafana: http://localhost:3000  Prometheus: :9090  Tempo: :3200  Loki: :3100
```

k8s: `kubectl apply -f k8s-observability/` after creating the two Secrets
listed above (deployments use `resources` requests/limits, non-root
securityContexts, readOnlyRootFilesystem + emptyDir scratch volumes).
