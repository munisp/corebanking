# Temporal — server Prometheus metrics + SDK interceptors

**Mechanism:**
1. Server-side metrics: Prometheus listener on **:8000** (SPEC §3 job
   `temporal`), enabled via Temporal **static** server config
   (`global.metrics.prometheus.listenAddress`) — see `helm-values.yaml`.
2. Workflow/activity **traces**: NOT from the server config — they come from
   SDK interceptors in the shared kits (SPEC §2.5):
   - Go: `otelkit.TemporalInterceptors()` (worker interceptors)
   - Python: `otelkit.temporal_interceptor()` (temporalio contrib opentelemetry)
   Those kits are owned by B3/B4; this directory only covers the server side.

## File

| File | Purpose | Status |
|---|---|---|
| `helm-values.yaml` | Helm values fragment for `temporalio/temporal` chart enabling the Prometheus listener on 0.0.0.0:8000 + Service port; chart-bundled Prometheus/Grafana disabled (platform stack owns them) | requires-deployment |

## Verified-static findings

- W14-B2: the Temporal server manifest now exists at
  `infrastructure/new/k8s/infra/temporal.yaml` (server + UI + namespace
  registration Job, namespace `temporal`, Service
  `temporal-frontend.temporal.svc.cluster.local:7233`, metrics on :8000).
  The Helm-values fragment below remains valid for Helm-chart-based deploys;
  pick one deploy method, not both.
- dynamicconfig cannot enable the metrics listener; it is static config. The
  dynamicconfig stub in `helm-values.yaml` is intentionally minimal.

## Apply (once server deploy method is confirmed)

```bash
helm upgrade temporal temporalio/temporal -n temporal -f helm-values.yaml
# verify: kubectl -n temporal port-forward svc/temporal-frontend 8000:8000
#         curl localhost:8000/metrics | grep ^temporal_
```

## Limitations

- requires-deployment: exact metric names/labels depend on the Temporal server
  version deployed; not verifiable from this tree.
- End-to-end workflow trace correlation additionally requires the kit
  interceptors on every worker and on workflow starters (out of scope here).
