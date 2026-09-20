# Permify — OTLP traces + Prometheus metrics

**Mechanism (native):** Permify v1.x has built-in OpenTelemetry support —
`tracer.exporter: otlp` (gRPC) and `meter.exporter: prometheus` exposing
`/metrics` on **:2112** (SPEC §3 job `permify`).

## Files

| File | Purpose | Status |
|---|---|---|
| `permify-config.yaml` | Reference server config (mount + `serve --config`) | requires-deployment |
| `permify-otel-env-patch.yaml` | Strategic-merge env patch for `Deployment/permify` (ns `54bank`) + scrape Service `permify-metrics:2112` — **preferred**, matches repo's env-driven style | requires-deployment |

## Verified-static findings

- Two Permify deployments exist: `Deployment/permify` ns `54bank`
  (`ghcr.io/permify/permify:v1.1.4`, env-configured) and a second copy in
  ns `permify` (`infrastructure/integration/permify-postgres.yaml`).
  Apply the patch to whichever is live (or both, with `-n permify`).
- The `54bank` copy contains `PERMIFY_DATABASE_URI` with an inline
  `CHANGE_ME` credential in the Deployment manifest — pre-existing issue, NOT
  introduced or worsened here; the ns-`permify` copy correctly uses a Secret.
  Flag for the platform team.
- `PERMIFY_PROFILER_ENABLED=true` (pprof :6060) is set in the integration copy;
  this patch disables it.

## Contracts

- OTLP gRPC → `otel-collector.observability.svc.cluster.local:4317` (SPEC §2.1).
- Prometheus `/metrics` on `:2112` → collector job `permify` (SPEC §3).
- `service.namespace=corebanking` / `deployment.environment` are attached by
  the Collector's resource processor (B1), since Permify does not expose a
  resource-attribute config knob.

## Limitations

- requires-deployment: exact OTLP exporter semantics (insecure flag name,
  meter address format) follow Permify v1.x config schema; v1.1.4 is the
  verified image tag in-tree.
- Permify traces cover its own check/expand APIs; end-to-end correlation still
  requires callers (e.g. `permify-authz-go`) to propagate `tracecontext` via
  the shared kits.
