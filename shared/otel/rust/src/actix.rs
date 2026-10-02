//! actix-web ingress middleware (feature `actix-web`, SPEC §2.5).
//!
//! Registers as a standard `Transform`:
//!
//! ```ignore
//! App::new()
//!     .wrap(otelkit::actix::TenantMiddleware) // register last = runs first
//!     .route(...);
//! ```
//!
//! Per request it starts a server span that (a) continues the incoming W3C
//! `tracecontext`/`baggage` parent and (b) records `tenant.id` from the
//! `x-tenant-id` header. When the header is absent the attribute is absent
//! (SPEC §2.3).

use std::future::{ready, Ready};

use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    http::header::HeaderMap,
    Error,
};
use futures_util::future::LocalBoxFuture;
use tracing::Instrument as _;
use tracing_opentelemetry::OpenTelemetrySpanExt as _;

/// actix header-carrier adapter for the global text-map propagator.
struct ActixExtractor<'a>(&'a HeaderMap);

impl opentelemetry::propagation::Extractor for ActixExtractor<'_> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).and_then(|v| v.to_str().ok())
    }

    fn keys(&self) -> Vec<&str> {
        self.0.keys().map(|k| k.as_str()).collect()
    }
}

/// actix-web middleware: W3C parent extraction + `tenant.id` attribution.
///
/// Register it last in the `App::wrap` chain so it runs first and every
/// downstream span (DB, TigerBeetle, outbound HTTP) is parented to the
/// request span it creates.
#[derive(Debug, Default, Clone, Copy)]
pub struct TenantMiddleware;

impl<S, B> Transform<S, ServiceRequest> for TenantMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = TenantMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(TenantMiddlewareService { service }))
    }
}

#[derive(Debug)]
pub struct TenantMiddlewareService<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for TenantMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let parent_cx = crate::propagation::extract_context(&ActixExtractor(req.headers()));
        let tenant_id = req
            .headers()
            .get("x-tenant-id")
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);
        let method = req.method().as_str().to_owned();
        let path = req.path().to_owned();

        // tenant.id starts Empty so it is omitted entirely when no
        // x-tenant-id header is present (SPEC §2.3: "attribute absent").
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

        let fut = self.service.call(req);
        Box::pin(
            async move {
                let res = fut.await?;
                status_span.record(
                    "http.response.status_code",
                    i64::from(res.status().as_u16()),
                );
                if res.status().is_server_error() {
                    status_span.record("otel.status_code", "ERROR");
                } else {
                    status_span.record("otel.status_code", "OK");
                }
                Ok(res)
            }
            .instrument(span),
        )
    }
}
