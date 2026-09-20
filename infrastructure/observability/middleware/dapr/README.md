# Dapr — Configuration CRD with OpenTelemetry tracing

**Mechanism (native):** Dapr sidecars natively export traces via OTLP when the
`Configuration` CRD sets `spec.tracing.otel`. No application code changes.

## File

| File | Purpose | Status |
|---|---|---|
| `dapr-configuration.yaml` | Drop-in replacement for `infrastructure/new/dapr/config.yaml` (`54bank-config`, ns `54bank`) swapping Zipkin → OTLP gRPC to the collector | requires-deployment |

## Contract mapping

- `samplingRate: "1"` — SPEC §2.1 (money services always 1.0).
- OTLP endpoint `otel-collector.observability.svc.cluster.local:4317`
  (SPEC §2.1 default `http://otel-collector:4317`; FQDN because sidecars run in
  `54bank` and the collector Service is in `observability` — verified-static
  from `infrastructure/new/k8s/otel-collector.yaml`).
- **`isReversed` deviation:** the Dapr `tracing.otel` CRD schema has no
  `isReversed` field. Valid keys are `endpointAddress`, `isSecure`, `protocol`
  (Dapr ≥ 1.11). The requested "isReversed false" is realized as
  `isSecure: false` (plaintext in-cluster OTLP). Flagged to the lead.

## Apply

```bash
kubectl apply -f dapr-configuration.yaml
# Sidecars pick up the Configuration on pod restart:
kubectl -n 54bank rollout restart deployment -l dapr.io/enabled=true
```

## Limitations

- requires-deployment: Dapr control plane ≥ 1.11 must already be installed;
  not verified in this tree.
- Apps must propagate W3C `tracecontext` through Dapr pub/sub messages
  themselves if they bypass Dapr's header handling (SPEC §2.4).
- Zipkin endpoint in the old config (`localhost:9411`) is removed; nothing in
  the tree was verified to consume Zipkin.
