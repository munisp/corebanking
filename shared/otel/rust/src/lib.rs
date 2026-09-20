//! otelkit — shared OpenTelemetry kit for corebanking Rust services.
//!
//! Implements the Wave-9 SPEC (work/w9/SPEC.md) §2.5 Rust contract:
//!
//! - [`init`]: tracing + tracing-opentelemetry with an OTLP gRPC (tonic)
//!   span exporter; resource attributes per SPEC §2.2; parent-based
//!   trace-id-ratio sampler (`OTEL_TRACES_SAMPLER_ARG`, default `1.0`);
//!   W3C `tracecontext` + `baggage` propagation; the returned [`OtelGuard`]
//!   flushes and shuts down the provider on drop.
//! - [`axum::tenant_middleware`] (feature `axum`): axum layer extracting
//!   `tenant.id` from the `x-tenant-id` header and continuing the incoming
//!   W3C trace context.
//! - [`actix::TenantMiddleware`] (feature `actix-web`): same contract as an
//!   actix-web `Transform` middleware.
//! - [`pg_span`] / [`tigerbeetle_span`]: client-span helpers for Postgres and
//!   TigerBeetle call sites.
//!
//! Environment (SPEC §2.1):
//!
//! - `OTEL_EXPORTER_OTLP_ENDPOINT` — OTLP gRPC endpoint
//!   (default `http://otel-collector:4317`).
//! - `OTEL_SERVICE_NAME` — service name; falls back to `SERVICE_NAME`, then
//!   the `service_name` argument passed to [`init`].
//! - `OTEL_TRACES_SAMPLER_ARG` — trace-id ratio in `[0,1]` (default `1.0`).
//! - `OTEL_SDK_DISABLED` — `true`/`1`/`yes` disables the SDK: no exporter is
//!   built, only a local fmt subscriber is installed, and all helpers become
//!   cheap in-process spans.
//! - `DEPLOY_ENV` — `deployment.environment` resource attribute
//!   (default `dev`).
//!
//! Tenant attribution (SPEC §2.3): the attribute key is `tenant.id`, sourced
//! at ingress from the `x-tenant-id` header only (JWT-claim fallback is the
//! caller's job: services that verify JWTs may record `tenant.id` from the
//! verified claim onto the current span). When no tenant is present the
//! attribute is absent, never empty.

mod helpers;
mod init;
mod propagation;

pub use helpers::{pg_span, tigerbeetle_span};
pub use init::{init, InitError, OtelGuard};

#[cfg(feature = "actix-web")]
pub mod actix;

#[cfg(feature = "axum")]
pub mod axum;

/// Returns true when `OTEL_SDK_DISABLED` requests a no-op SDK
/// (`true`, `1`, or `yes`, case-insensitive).
pub fn sdk_disabled() -> bool {
    std::env::var("OTEL_SDK_DISABLED")
        .map(|v| matches!(v.to_ascii_lowercase().as_str(), "true" | "1" | "yes"))
        .unwrap_or(false)
}
