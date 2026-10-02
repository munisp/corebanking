# Mojaloop upstream stack — Prometheus scrape

**Mechanism:** Prometheus scrape of the upstream Mojaloop hub services, fed to
B1's commented-out `mojaloop` collector job. This directory supplies the
**targets/discovery config**; B1 owns the receiver wiring.

## Scope boundary

- **In scope (B7, here):** upstream hub services — central-ledger,
  ml-api-adapter, quoting-service, account-lookup-service, bulk-api-adapter,
  transaction-requests-service — deployed from the upstream Mojaloop Helm
  charts.
- **Out of scope:** our `mojaloop-connector` and the in-tree
  `mojaloop-*-{go,rs,py}` satellite services — connector instrumentation is B6;
  the satellites are scraped through their own service configs.

## Verified-static findings

- **The upstream stack is NOT deployed in-tree.** No Deployment/StatefulSet or
  Helm chart for central-ledger/ml-api-adapter/quoting-service exists in the
  repo.
- The stack is *expected* at namespace `mojaloop` with standard upstream
  Service names, evidenced by `infrastructure/charts/mojaloop-connector/values.yaml`
  env: `ACCOUNT_LOOKUP_SERVICE=http://mojaloop-account-lookup-service.mojaloop.svc.cluster.local`,
  `QUOTES_SERVICE=...mojaloop-quoting-service.mojaloop...`,
  `TRANSFERS_SERVICE=...mojaloop-ml-api-adapter-service.mojaloop...`, plus
  configmap `mojaloop-hub-url: http://mojaloop-hub:4000`.
- Upstream Mojaloop services are Node.js apps built on
  `@mojaloop/central-services-metrics`; each exposes Prometheus `/metrics` on
  its **admin port** when instrumentation is enabled. The typical admin-port
  pattern in upstream charts is `:4007`/`:4008` per service — **requires-
  deployment verification**; do not hardcode without checking the live release.

## File

| File | Purpose | Status |
|---|---|---|
| `mojaloop-upstream-scrape.yaml` | ConfigMap (ns `observability`) with scrape fragment `mojaloop-scrape.yaml`: Strategy 1 = kubernetes_sd on ns `mojaloop` honoring `prometheus.io/*` annotations (preferred, zero-hardcoding); Strategy 2 = commented static fallback with ADJUST-marked typical targets | requires-deployment (stub pending live-stack verification) |

## Handoff to B1

Merge `mojaloop-scrape.yaml` into the collector prometheus receiver's
additional scrape configs and uncomment the `mojaloop` job. The collector's
kubernetes SD needs RBAC to list/watch Services in ns `mojaloop` (or a
ClusterRole covering it).

## Verification once the stack is deployed (requires-deployment)

```bash
kubectl -n mojaloop get svc -o wide          # confirm service names/ports
kubectl -n mojaloop get svc mojaloop-central-ledger-service -o jsonpath='{.metadata.annotations}'   # prometheus.io/* present?
kubectl -n mojaloop port-forward svc/mojaloop-central-ledger-service 4008:4008
curl -s localhost:4008/metrics | head        # expect prom-client metrics (mojaloop_* / process_* / nodejs_*)
```

## Limitations

- All targets are stubs until the upstream helm release is confirmed; exact
  admin ports vary by chart version.
- Upstream services emit metrics only — no OTLP tracing; trace correlation
  across the hub relies on our connector (B6) propagating `tracecontext`
  through the FSPIOP headers on our side of the boundary.
- If upstream services are deployed without metrics annotations and without a
  documented admin port, Strategy 1 yields zero targets — fall back to
  Strategy 2 after manual port verification.
