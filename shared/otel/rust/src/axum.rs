//! axum ingress layer (feature `axum`, SPEC §2.5).
//!
//! ```ignore
//! let app = Router::new()
//!     .route(...);
//!     .layer(axum::middleware::from_fn(otelkit::axum::tenant_middleware));
//! ```
//!
//! Same contract as the actix middleware: continue the incoming W3C
//! `tracecontext`/`baggage` parent and record `tenant.id` from the
//! `x-tenant-id` header; attribute absent when the header is absent
//! (SPEC §2.3).

use axum::{extract::Request, http::HeaderMap, middleware::Next, response::Response};
use tracing::Instrument as _;
use tracing_opentelemetry::OpenTelemetrySpanExt as _;

/// axum/http header-carrier adapter for the global text-map propagator.
struct AxumExtractor<'a>(&'a HeaderMap);

impl opentelemetry::propagation::Extractor for AxumExtractor<'_> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).and_then(|v| v.to_str().ok())
    }

    fn keys(&self) -> Vec<&str> {
        self.0.keys().map(|k| k.as_str()).collect()
    }
}

/// axum `from_fn` middleware: W3C parent extraction + `tenant.id` attribution.
pub async fn tenant_middleware(req: Request, next: Next) -> Response {
    let parent_cx = crate::propagation::extract_context(&AxumExtractor(req.headers()));
    let tenant_id = req
        .headers()
        .get("x-tenant-id")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let method = req.method().as_str().to_owned();
    let path = req.uri().path().to_owned();

    let span = tracing::info_span!(
        "http.request",
        otel.kind = "server",
        otel.status_code = tracing::field::Empty,
        http.request.method = %method,
        url.path = %path,
        http.response.status_code = tracing::field::Empty,
        tenant.id = tracing::field::Empty,
    );
    let _ = span.set_parent(parent_cx);
    if let Some(tenant) = &tenant_id {
        span.record("tenant.id", tenant.as_str());
    }
    let status_span = span.clone();

    let response = next.run(req).instrument(span).await;
    status_span.record(
        "http.response.status_code",
        i64::from(response.status().as_u16()),
    );
    if response.status().is_server_error() {
        status_span.record("otel.status_code", "ERROR");
    } else {
        status_span.record("otel.status_code", "OK");
    }
    response
}

/// Baseline HTTP trace layer (tower-http) for services that also want
/// request/response lifecycle logging through tracing. Optional convenience;
/// `tenant_middleware` alone satisfies the SPEC.
pub fn trace_layer(
) -> tower_http::trace::TraceLayer<
    tower_http::classify::SharedClassifier<tower_http::classify::ServerErrorsAsFailures>,
> {
    tower_http::trace::TraceLayer::new_for_http()
}
