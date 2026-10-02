# OpenSearch — Prometheus exporter

**Mechanism (plugin, requires install):** OpenSearch has **no built-in
Prometheus exporter**. The community Aiven
`prometheus-exporter-plugin-for-opensearch` serves `/_prometheus/metrics` on
the node HTTP port (9200).

## File

| File | Purpose | Status |
|---|---|---|
| `opensearch-prometheus-exporter.yaml` | (a) plugin settings fragment, (b) scrape Service `opensearch-metrics:9600` → pod :9200 (SPEC §3 contract port), (c) StatefulSet patch installing the plugin via initContainer | requires-deployment |

## Verified-static findings

- `StatefulSet/opensearch`, ns `54bank`, image `opensearchproject/opensearch:2.12.0`,
  single-node, `DISABLE_SECURITY_PLUGIN=true` → metrics reachable without auth
  in-cluster.
- No exporter plugin is installed in the in-tree image/config.

## Port contract caveat (:9600)

- SPEC §3 fixes job `opensearch` at **:9600**. On OpenSearch 2.12.0, port 9600
  belongs to **Performance Analyzer**, whose output is **not** Prometheus
  format and which is deprecated in later 2.x — it is NOT a usable scrape
  target for the collector.
- Reconciliation chosen here: Service `opensearch-metrics` exposes **9600**
  (contract) and remaps to pod **9200**, where the Aiven plugin serves
  `/_prometheus/metrics`.
- **Action for B1:** the `opensearch` scrape job must set
  `metrics_path: /_prometheus/metrics` (default `/metrics` will 404).

## Plugin install requirement

- Plugin version must match OpenSearch exactly: `2.12.0.0` for OS 2.12.0
  (pinned in the initContainer URL). Upgrade both in lockstep.
- Plugin install requires a node restart/rollout; the initContainer pattern in
  the patch avoids baking a custom image but needs egress to github.com at pod
  start — pre-stage the zip in an internal registry if egress is restricted.

## Limitations

- requires-deployment: plugin availability per OpenSearch version is
  community-maintained (Aiven project); if a matching release is missing for a
  future OS upgrade, metrics fall back to client-side instrumentation (B4) only.
- No tracing path: OpenSearch client spans come from service instrumentation
  (e.g. `opensearch-analytics-py` via otelkit), not from the server.
