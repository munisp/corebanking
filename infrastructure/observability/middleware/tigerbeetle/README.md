# TigerBeetle — StatsD sidecar metrics + client-side tracing

## Verification of the deployed version (the honest answer)

- **Verified-static:** `StatefulSet/tigerbeetle`, ns `54bank`, image
  `ghcr.io/tigerbeetle/tigerbeetle:0.16.11`, command
  `start --addresses=0.0.0.0:3001 --cluster-id=0`. No metrics flags in-tree.
- **TigerBeetle does NOT expose an HTTP `/metrics` endpoint.** Per the vendor
  monitoring docs, TB emits metrics via **StatsD/DogStatsD** only:
  `start --experimental --statsd=IP:Port`; metrics are namespaced `tb.` and
  tagged `cluster`/`replica` (`tigerbeetle inspect metrics` lists them).
- **requires-deployment:** confirm the pinned **0.16.11** supports the flags
  before rolling the StatefulSet:
  ```bash
  kubectl -n 54bank exec sts/tigerbeetle -- tigerbeetle start --help | grep -i statsd
  kubectl -n 54bank exec sts/tigerbeetle -- tigerbeetle inspect metrics | head
  ```
  If unsupported, upgrade TigerBeetle first; do NOT silently drop metrics.

## Sidecar pattern (what the stub provides)

| File | Purpose | Status |
|---|---|---|
| `tigerbeetle-metrics-sidecar.yaml` | Telegraf sidecar (`statsd` input :8125 UDP → `prometheus_client` output **:9090**) + TB command patch adding `--experimental --statsd=127.0.0.1:8125` + scrape Service `tigerbeetle-metrics:9090` | requires-deployment |

Matches the SPEC §3 scrape job **`tigerbeetle-sidecar` (:9090)**.

Key alertable metrics (vendor-documented): `tb.replica_status` (≠0 = alert),
`tb.replica_sync_stage` (≠0 = alert), `tb.replica_request` (timing, tagged by
operation). These back B2's `TigerBeetleUnavailable` alert.

## Client-side spans (from the shared kits, B3/B5)

TigerBeetle has no trace surface; end-to-end latency attribution is client-side
per SPEC §2.5:

- Go: `otelkit.TigerBeetleSpan(ctx, op, fn)`
- Rust: `otelkit::tigerbeetle_span(op)`

In-tree TB clients to be covered by the kit patches: `tigerbeetle-adapter-rs`,
`tigerbeetle-ledger-rs`, `tigerbeetle-batch-engine-rs`,
`tigerbeetle-multicurrency-rs`, `tigerbeetle-protocol-rs`,
`tigerbeetle-sync-go` (verified-static from `infrastructure/new/**`).

## Limitations

- StatsD→Prometheus bridging loses histogram fidelity (Telegraf aggregates
  timings; TB timings become summaries, not native histograms).
- `--experimental` gates the statsd feature — it may change/remove flags on
  upgrade; re-verify after every TB bump.
- Telegraf image tag `1.30-alpine` is an example pin; platform team re-pins.
