# Keycloak — OTLP tracing + Prometheus metrics

**Mechanism (native, Keycloak v25+/Quarkus):** Keycloak ships built-in OTel
support — no plugins, env-only:

| Env var | Value | Effect |
|---|---|---|
| `KC_TRACING_ENABLED` | `true` | Enables the OTel tracer (Quarkus OTel extension) |
| `KC_TRACING_ENDPOINT` | `http://otel-collector.observability.svc.cluster.local:4317` | OTLP gRPC target (SPEC §2.1) |
| `KC_TRACING_PROTOCOL` | `grpc` | Protocol |
| `KC_TRACING_SERVICE_NAME` | `keycloak` | `service.name` resource attr |
| `KC_TRACING_SAMPLER_RATIO` | `1.0` | Full sampling (SPEC §2.1) |
| `KC_TRACING_RESOURCE_ATTRIBUTES` | `service.namespace=corebanking,deployment.environment=$(DEPLOY_ENV)` | SPEC §2.2 |
| `KC_METRICS_ENABLED` | `true` | `/metrics` on the **management port :9000** (SPEC §3 job `keycloak`) |
| `KC_HTTP_MANAGEMENT_PORT` | `9000` | Pins the metrics/health listener |

## File

| File | Purpose | Status |
|---|---|---|
| `keycloak-otel-patch.yaml` | Strategic-merge Deployment patch + scrape Service `keycloak-metrics:9000` | requires-deployment (**blocked on Keycloak 24→25+ upgrade**) |

## Verified-static findings

- `infrastructure/new/k8s/infrastructure.yaml` deploys `Deployment/keycloak`
  (ns `54bank`, container `keycloak`, image **`quay.io/keycloak/keycloak:24.0`**).
  The patch targets that Deployment directly (no placeholders).
- **Blocker: v24.0 predates OTel support.** On Keycloak 24, `KC_TRACING_*` is
  silently ignored and `KC_METRICS_ENABLED` serves `/metrics` on the HTTP
  listener **:8080**, not the management port :9000 (the management interface
  was introduced in v25). The SPEC §3 scrape contract `keycloak:9000` therefore
  **requires upgrading Keycloak to ≥ 25 (recommend 26.x)** — the patch carries
  a commented image bump for that.

## Version caveat (requires-deployment)

- `KC_TRACING_*` requires **Keycloak ≥ 25** (Quarkus distro; preview in 25,
  stable in 26). Verify the image tag after upgrade:
  `kubectl -n 54bank get deploy keycloak -o jsonpath='{.spec.template.spec.containers[0].image}'`
- Metrics on v25+ are served by the management interface; `/metrics` is NOT on
  the HTTP port 8080.

## Apply

```bash
kubectl -n <ns> patch deployment keycloak --patch-file keycloak-otel-patch.yaml
kubectl apply -f keycloak-otel-patch.yaml   # for the Service
```

## Limitations

- requires-deployment throughout; nothing was executed against a live Keycloak.
- Login-event spans carry no `tenant.id` — per-tenant attribution for auth
  remains the responsibility of downstream services reading the JWT
  `tenant_id` claim (SPEC §2.3).
