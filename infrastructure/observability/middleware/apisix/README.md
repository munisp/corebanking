# APISIX — opentelemetry + prometheus global plugins

**Mechanism (native):** APISIX ≥ 2.13 ships an `opentelemetry` plugin
(OTLP/HTTP export) and a `prometheus` plugin (metrics export endpoint).
Applied cluster-wide via one `ApisixGlobalRule` — no per-route changes.

## File

| File | Purpose | Status |
|---|---|---|
| `apisix-global-rule-otel.yaml` | `ApisixGlobalRule` (ns `54link-dev`, ingressClassName `apisix`) enabling `opentelemetry` → `http://otel-collector:4318/v1/traces` and `prometheus` | requires-deployment |

## Contracts

- OTLP/HTTP: `collector.address: otel-collector...:4318` — the plugin appends
  `/v1/traces` itself; SPEC §3 collector endpoint is `...:4318/v1/traces`.
- Sampler `always_on` (1.0) per SPEC §2.1.
- Resource attrs `service.name=apisix-gateway`, `service.namespace=corebanking`
  (SPEC §2.2). `set_ngx_var: true` puts `trace_id` into nginx vars for access-
  log correlation.
- Metrics: the `prometheus` plugin serves its export endpoint (default
  `/apisix/prometheus/metrics`) on the **plugin server port 9091** — matches
  the SPEC §3 scrape job `apisix :9091`. The port/URI are set in APISIX's
  `config.yaml` under `plugin_attr.prometheus` (defaults are 9091 /
  `/apisix/prometheus/metrics`); verify the deployed `apisix-config` ConfigMap
  does not override them.

## Verified-static findings

- Routes (~600 `ApisixRoute` CRs) live in ns `54link-dev` with
  `ingressClassName: apisix` → the GlobalRule is placed there.
- The only APISIX Deployment in-tree (`infrastructure/new/k8s/infrastructure.yaml`,
  `apache/apisix:3.9.1-debian`, ns `54bank`) runs with a static `apisix.yaml`
  and no ingress-controller manifest was found — the CRD path therefore
  **requires-deployment** confirmation that `apisix-ingress-controller` is
  actually running and watching ns `54link-dev`. If APISIX runs in standalone/
  static-config mode, the equivalent plugins must instead be added to that
  static `apisix.yaml`/`config.yaml` (same plugin names and config keys).
- APISIX 3.9.1 supports both plugins (verified version from image tag).

## Propagation note

The plugin extracts/injects W3C `tracecontext` on the boundary, so gateway
spans join downstream service traces from the shared kits (SPEC §2.4). The
tenant header `x-tenant-id` is already passed through by routes (SPEC §2.3).

## Limitations

- `additional_attributes` are static strings; per-request `tenant.id` on
  gateway spans is not set here — tenant attribution stays with the kits
  (SPEC §2.3: the Collector does not mint tenant ids).
