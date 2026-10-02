# otelkit (Rust) — shared OpenTelemetry kit

Wave-9 SPEC (`work/w9/SPEC.md`) §2.5 Rust contract. Repo path once landed:
`shared/otel/rust/`, crate name `otelkit`.

## API

- `otelkit::init(service_name: &str) -> Result<OtelGuard, InitError>` —
  tracing + tracing-opentelemetry with an OTLP gRPC (tonic) span exporter.
  Resource attributes per SPEC §2.2 (`service.name`,
  `service.namespace="corebanking"`, `deployment.environment`). The guard
  flushes and shuts down the provider on drop — bind it in `main`:
  `let _otel_guard = otelkit::init("my-service")?;`.
- `otelkit::axum::tenant_middleware` (feature `axum`) — axum `from_fn` layer.
- `otelkit::actix::TenantMiddleware` (feature `actix-web`) — actix-web
  `Transform`; register it **last** in the `App::wrap` chain so it runs first.
- `otelkit::pg_span(query: &str)` / `otelkit::tigerbeetle_span(op: &str)` —
  client-span helpers for Postgres and TigerBeetle call sites.

## Environment (SPEC §2.1)

| Var | Default | Notes |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4317` | OTLP gRPC |
| `OTEL_SERVICE_NAME` | — | falls back to `SERVICE_NAME`, then `init()` arg |
| `OTEL_TRACES_SAMPLER_ARG` | `1.0` | parent-based ratio, clamped to `[0,1]` |
| `OTEL_SDK_DISABLED` | unset | `true`/`1`/`yes` → no exporter, fmt-only |
| `DEPLOY_ENV` | `dev` | `deployment.environment` resource attr |

`tenant.id` is recorded at ingress from the `x-tenant-id` header; absent
header → attribute absent (SPEC §2.3). Propagation: W3C `tracecontext` +
`baggage` via a composite propagator (§2.4), installed even when the SDK is
disabled so context still flows through a disabled hop.

**Runtime requirement:** the batch span processor spawns its background
worker onto the ambient tokio runtime, so `init()` must be called from within
a tokio runtime context (every `#[actix_web::main]` / `#[tokio::main]` entry
point qualifies). Synchronous mains (e.g. raw-`TcpListener` services) must
build a runtime and `.enter()` it before calling `init()` — see the
`multicurrency-revaluation-rs` template patch. When `OTEL_SDK_DISABLED` is
set no runtime is required.

## MSRV and version pinning

- **MSRV: Rust 1.75** (`rust-version = "1.75"` in Cargo.toml). Determined by
  the dependency floor: `opentelemetry`/`opentelemetry_sdk` 0.27 declare
  MSRV 1.75, and `tonic` 0.12 (pulled by `opentelemetry-otlp/grpc-tonic`)
  requires ≥ 1.75 as well. Edition 2021.
- **Pinning rationale.** The OpenTelemetry Rust pre-1.0 line does breaking
  releases on minor bumps, and `opentelemetry` 0.27 / `opentelemetry_sdk`
  0.27 / `opentelemetry-otlp` 0.27 / `tracing-opentelemetry` 0.28 are one
  mutually compatible train — bumping any single crate across a minor
  boundary breaks compilation. The kit therefore pins `=`-compatible minor
  versions (`"0.27"` / `"0.28"`), and exact patch resolution is delegated to
  each consuming service's committed `Cargo.lock` (all in-scope services
  commit one). Bump the whole train together, in this crate, once.
- `tracing`/`tracing-subscriber` are stable 0.x and pinned loosely
  (`"0.1"`/`"0.3"`) per ecosystem convention.
- Framework deps (`axum` 0.7, `tower-http` 0.5, `actix-web` 4.9) are optional
  features matching the versions already used by the in-scope services;
  enabling a feature does not change the telemetry core.

## Consuming (actix example)

```toml
# services/<svc>/Cargo.toml
otelkit = { path = "../../shared/otel/rust", features = ["actix-web"] }
```

```rust
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let _otel_guard = match otelkit::init("my-service") {
        Ok(g) => Some(g),
        Err(e) => {
            eprintln!("otel init failed: {e}; continuing without telemetry");
            None
        }
    };
    // ...
    HttpServer::new(move || {
        App::new()
            // ... existing wraps ...
            .wrap(otelkit::actix::TenantMiddleware) // last registered = first run
            // ... routes ...
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
```

## Verification status

Compilation was **not** performed in the authoring environment (no Rust
toolchain available). Sources were verified by token-aware balanced-delimiter
scan and manual API review against opentelemetry-rust 0.27 /
tracing-opentelemetry 0.28 docs. First CI build of a consuming service is the
real compile gate.
