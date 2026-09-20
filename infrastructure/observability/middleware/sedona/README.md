# Apache Sedona — inherits Spark telemetry only

## Honest scope

**Apache Sedona has no telemetry surface of its own.** It is a Spark library
(geospatial UDFs/UDTs, no server process). Every metric or span attributed to
"Sedona" actually comes from the **Spark runtime** running the job, plus
app-level spans in the service that submits the job (via otelkit).

## Files

| File | Purpose | Status |
|---|---|---|
| `metrics.properties` | Spark's built-in `PrometheusServlet` sink (Spark ≥ 3.0) — served by the driver UI (`/metrics/prometheus`) | requires-deployment |
| `spark-jmx-exporter-configmap.yaml` | Option B: `jmx_prometheus_javaagent` rules + attach fragment exposing driver metrics on **:8090** — the exact SPEC §3 `spark-jmx` contract port | requires-deployment |

Pick ONE option per Spark deployment. Option A is simplest on Spark ≥ 3.0 but
serves on the UI port (:4040), not :8090 — if the collector job must hit :8090
literally (SPEC §3), use Option B or remap a Service 8090→4040 with
`metrics_path: /metrics/prometheus` (coordinate with B1).

## Verified-static findings

- **No Spark or Sedona Deployment/StatefulSet exists in the repo.** Sedona is
  referenced only in application code (`services/kpi-analytics-py/middleware.py`
  `SedonaLakehouseClient`, `services/gl-regulatory-pipeline-py`,
  `services/banking-operations-pipeline-py`) as part of the Lakehouse
  geospatial analytics path ("Iceberg + Sedona").
- The patch fragments therefore carry `ADJUST` markers for the driver
  Deployment name/labels.

## Tracing

Sedona job spans = spans created by the driving service around query
submission (e.g. `kpi-analytics-py` via `otelkit` — covered by the B4 Python
patches), not server-side spans. There is nothing to enable inside Sedona.

## Limitations

- requires-deployment: Spark version, deploy mode (standalone vs k8s-operator),
  and driver Service naming are unknown in-tree.
- Executor metrics cardinality scales with executor count; on large jobs
  consider scraping driver-only.
