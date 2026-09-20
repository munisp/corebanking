# Fluvio — metrics scrape + manual producer/consumer tracing

## Metrics

| File | Purpose | Status |
|---|---|---|
| `fluvio-scrape.yaml` | StatefulSet patch adding scrape annotations + metrics port **:9110**, and Service `fluvio-metrics:9110` (SPEC §3 job `fluvio`) | requires-deployment |

**Verified-static:** the in-tree Fluvio (`StatefulSet/fluvio`, ns `54bank`,
`infinyon/fluvio:0.11.9`) is a simplified all-in-one container exposing only
:9003. No metrics port is configured. Whether this image serves `/metrics` on
:9110 **must be verified against the running pod** before wiring the collector
job; if it does not, the honest fallback is *no broker metrics* (client-side
only) rather than a fabricated exporter.

## Producer/consumer tracing — MANUAL (no native OTel in Fluvio)

Fluvio has no native OpenTelemetry support. Trace propagation across Fluvio
topics is the responsibility of the services, using the shared kits
(SPEC §2.4/§2.5):

- **Rust** (`fluvio-streams-rs`, `fluvio-wasm-transform-rs` — in-tree users):
  create a span per produce/consume with `otelkit` (e.g.
  `tracing::info_span!("fluvio.produce", topic = %topic)`), inject the W3C
  `traceparent` into the record headers on produce, extract on consume, and
  set the extracted context as the span parent.
- **Go/Python/TS** services publishing to Fluvio topics follow the same
  inject/extract pattern as the Kafka interceptors (`KafkaProducerInterceptor`
  / `instrument_kafka()`), adapted to the Fluvio client API.

Recommended span conventions: `messaging.system=fluvio`,
`messaging.destination.name=<topic>`, `messaging.operation=publish|receive`,
plus `tenant.id` per SPEC §2.3.

## Limitations

- All Fluvio tracing is manual via kits — there is no sidecar/interceptor
  auto-wiring.
- Metrics coverage depends entirely on what the deployed image exposes;
  unverified (requires-deployment).
