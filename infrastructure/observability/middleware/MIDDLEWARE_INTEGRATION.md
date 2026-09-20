# Middleware OpenTelemetry Integration Index (B7 — wave 9)

Scope: SPEC §3 middleware rows owned by B7. All artifacts under
`infrastructure/observability/middleware/<name>/` (this directory tree mirrors
the repo layout for the lead to apply). The OTel Collector scrape jobs are
B1's; every config here targets the §3 contract job names/ports:
`kafka-jmx :5556`, `postgres :9187`, `redis :9121`, `keycloak :9000`,
`permify :2112`, `opensearch :9600`, `apisix :9091`, `temporal :8000`,
`fluvio :9110`, `tigerbeetle-sidecar :9090`, `spark-jmx :8090`.

## Tree provenance / spot-check

- `/tmp/tf2/tree` bootstrapped from codeload @ `1c9134e2f0201e574d1e70ce5227691cb8236d23`
  per w8/TREE_BOOTSTRAP.md step 2.
- **Spot-check result: 30/30 files verified** via `git hash-object` against
  `w8-tree-manifest-1c9134e2.txt` (25 random + the 5 files this work depends
  on: lakehouse/server.py, kafka-cluster.yaml, dapr/config.yaml,
  apisix plugin-configmap.yaml, new/k8s/otel-collector.yaml). 0 mismatches.
- The earlier mirror at `/mnt/agents/output/work/repo` (stale commit fa5999aa)
  was used only for initial scouting; all dependency files were re-confirmed
  byte-identical to the pinned tree except `otel-collector.yaml` (YAML key
  ordering only — substantively identical).

## Collector DNS note (applies to several configs below)

The collector Service is in namespace `observability`
(`infrastructure/new/k8s/otel-collector.yaml`, ports 4317/4318/8889 —
verified-static). Middleware running in `54bank`/`kafka`/etc. cannot resolve
the short name `otel-collector`; configs here use the FQDN
`otel-collector.observability.svc.cluster.local`. If B1 ships the collector in
the same namespace as the workloads, adjust accordingly.

## Per-middleware summary

| # | Middleware | Mechanism | Native vs manual | Files | Requires deployment | Key limitations (honest) |
|---|---|---|---|---|---|---|
| 1 | Kafka | `jmx_prometheus_javaagent` rules; Strimzi ConfigMap (matches in-tree CR `metricsConfig` ref) + standalone sidecar variant | Native (metrics); tracing via kit interceptors (B3/B4/B5) | `kafka/kafka-metrics-configmap.yaml`, `kafka/jmx-exporter-standalone.yaml` | Rolling broker restart; jar pin; port reconciliation | Strimzi exporter publishes on 9404, contract is 5556 — pick Service remap or standalone sidecar |
| 2 | Dapr | `Configuration` CRD tracing → OTLP gRPC | Native | `dapr/dapr-configuration.yaml` (drop-in replacement for `infrastructure/new/dapr/config.yaml`) | Dapr CP ≥ 1.11; sidecar restarts | **`isReversed` is not a Dapr schema field** — mapped to `isSecure: false`; Zipkin removed |
| 3 | Temporal | Static server config `global.metrics.prometheus.listenAddress=:8000` (helm values) | Native metrics; traces manual via kit interceptors (B3/B4) | `temporal/helm-values.yaml` | No Temporal server manifest in-tree — deploy method must be confirmed | dynamicconfig cannot enable metrics; metric names depend on server version |
| 4 | Keycloak | Env vars `KC_TRACING_*`, `KC_METRICS_ENABLED`, mgmt port 9000 | Native (v25+/Quarkus) | `keycloak/keycloak-otel-patch.yaml` | **BLOCKED: in-tree image is keycloak:24.0** — tracing silently ignored, metrics on :8080 not :9000 until upgrade | Requires Keycloak ≥ 25 (recommend 26.x); no tenant.id on auth spans |
| 5 | Permify | `tracer.exporter=otlp` + `meter.exporter=prometheus :2112` (env patch preferred; config yaml equivalent) | Native (v1.x) | `permify/permify-otel-env-patch.yaml`, `permify/permify-config.yaml` | Two permify deployments exist (ns `54bank` + ns `permify`) — patch whichever is live | resource attrs (namespace/env) attached by collector, not Permify; pre-existing inline `CHANGE_ME` DB credential in `54bank` manifest flagged |
| 6 | APISIX | `ApisixGlobalRule` enabling `opentelemetry` (OTLP/HTTP :4318) + `prometheus` plugins | Native | `apisix/apisix-global-rule-otel.yaml` | Requires apisix-ingress-controller watching ns `54link-dev` (not in-tree; only standalone APISIX deploy exists) | If APISIX runs static-config mode, plugins must go into `apisix.yaml` instead; no per-request tenant.id at gateway |
| 7 | OpenSearch | Aiven prometheus-exporter plugin (initContainer install) + Service remap 9600→9200 | Plugin (not built-in) | `opensearch/opensearch-prometheus-exporter.yaml` | Plugin must match OS 2.12.0 exactly; egress or pre-staged zip | Port 9600 is Performance Analyzer (non-Prometheus format) — **B1 must set `metrics_path: /_prometheus/metrics` on the opensearch job** |
| 8 | OpenAppSec | Syslog/JSON → Vector → Loki → Grafana alert rules | **No OTel support at all** — log forwarding only | `openappsec/vector-openappsec.yaml` | Agent-side syslog target config (version-dependent); no agent deployment in-tree | No traces/metrics; tenant labels best-effort; Vector pin is an example |
| 9 | Fluvio | Scrape wiring :9110 + annotations | Metrics: requires verification; tracing: manual via kits | `fluvio/fluvio-scrape.yaml` | Verify the all-in-one 0.11.9 image actually serves :9110/metrics | If not, honest fallback is client-side telemetry only; no native OTel in Fluvio |
| 10 | TigerBeetle | StatsD (DogStatsD) → Telegraf sidecar → Prometheus :9090 | Native StatsD emitter (flag-gated) + kit spans (B3/B5) | `tigerbeetle/tigerbeetle-metrics-sidecar.yaml` | Confirm 0.16.11 supports `--experimental --statsd` (`tigerbeetle inspect metrics`); else upgrade TB | No HTTP /metrics in TB; StatsD bridging loses histogram fidelity; `--experimental` may change |
| 11 | Apache Sedona | Spark metrics (PrometheusServlet or JMX exporter :8090) | Inherits Spark only — Sedona has no telemetry | `sedona/metrics.properties`, `sedona/spark-jmx-exporter-configmap.yaml` | No Spark/Sedona deployment in-tree — `ADJUST` markers on target names | Servlet option serves on UI port, not 8090; executor cardinality |
| 12 | GeoLibre | Python wrapper snippet around calls | Manual only — no native OTel; GeoLibre absent from repo | `geolibre/geolibre_otel_wrapper.py` | Needs an actual caller service (none exists in-tree) | Illustrative; not wired anywhere |
| 13 | Lakehouse | Code patch on `infrastructure/new/lakehouse/server.py` | Manual in-process (plain http.server) | `patches/py-lakehouse.diff` + `lakehouse/README.md` | Needs B4 kit importable at runtime (no-op until then) | 500-path errors not recorded on spans (handler swallows exceptions; "no logic change" constraint); no metrics endpoint added |
| 14 | Mojaloop (upstream stack) | Prometheus scrape fragment for B1's `mojaloop` job (k8s SD on ns `mojaloop` + static fallback) | Native metrics in upstream services (`@mojaloop/central-services-metrics`, `/metrics` on admin port); tracing only at our connector (B6) | `mojaloop/mojaloop-upstream-scrape.yaml` | **Upstream stack not deployed in-tree** — expected in ns `mojaloop` per connector chart env refs; admin ports (typical :4007/:4008) require live verification | All targets ADJUST-marked stubs; collector needs RBAC for ns `mojaloop`; zero targets if upstream ships without metrics annotations |

## Cross-cutting notes

- **Mojaloop**: covered (row 14). The in-tree `mojaloop-connector` chart
  (app port 9489, dapr metrics 9099) is B6's instrumentation target; B7
  supplies the upstream-stack scrape fragment consistent with B1's commented
  `mojaloop` collector job.
- **tenant.id**: set only where a request/header is visible to the middleware
  (kits at ingress per SPEC §2.3). Broker/DB-level exporters cannot mint it.
- **No secrets** were added anywhere; two pre-existing `CHANGE_ME` placeholders
  in `infrastructure/new/k8s/infrastructure.yaml` (postgres/permify/keycloak/
  apisix admin key) were left untouched and flagged in the relevant READMEs.
- **healthz/metrics fiction (W8 F15)**: not fixed by this wave; middleware
  telemetry above will surface such gaps once deployed.
