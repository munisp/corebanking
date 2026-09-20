# Kafka — JMX exporter integration

**Mechanism:** `jmx_prometheus_javaagent` rules for Kafka broker MBeans, scraped
by the OTel Collector job **`kafka-jmx` (:5556)** (job owned by B1 — SPEC §3).

## Files

| File | Purpose | Status |
|---|---|---|
| `kafka-metrics-configmap.yaml` | ConfigMap `kafka-metrics` (ns `kafka`), key `kafka-metrics-config.yml` — satisfies the `metricsConfig` reference in the deployed Strimzi Kafka CR `infrastructure/kafka/kafka-cluster.yaml` | verified-static (matches CR reference) |
| `jmx-exporter-standalone.yaml` | Non-Strimzi fallback: same rules + Deployment patch running the javaagent on **:5556** + scrape Service | requires-deployment |

## Port contract reconciliation

- SPEC §3 fixes the collector scrape job as `kafka-jmx` on **:5556**.
- The Strimzi `jmxPrometheusExporter` sidecar (used by the deployed cluster,
  verified-static) publishes on **:9404** by default.
- Reconcile ONE of:
  1. Point B1's `kafka-jmx` job at the Strimzi metrics Service (`link54-kafka-cluster-kafka-metrics:9404`), or
  2. Use `jmx-exporter-standalone.yaml`, which exposes exactly `:5556`.

## Tracing note

Broker-side JMX gives metrics only. Producer/consumer **trace spans** come from
the shared kits (`KafkaProducerInterceptor`/`KafkaConsumerInterceptor` in Go,
`instrument_kafka()` in Python) which inject/extract W3C `tracecontext` in
message headers per SPEC §2.4. Kafka itself does not propagate trace context.

## Requires deployment

- The JMX exporter jar version must be pinned by the platform team (not in repo).
- Strimzi rolls brokers when `kafka-metrics` ConfigMap changes — plan a rolling
  restart window.
