//! Kit initialization: OTLP gRPC (tonic) span exporter, resource attributes,
//! sampler, propagator, and the tracing subscriber wiring.

use std::env;
use std::error::Error;
use std::fmt;

use opentelemetry::{global, trace::TracerProvider as _, KeyValue};
use opentelemetry_otlp::{SpanExporter, WithExportConfig as _};
use opentelemetry_sdk::{
    trace::{Sampler, SdkTracerProvider},
    Resource,
};
use tracing_subscriber::{layer::SubscriberExt as _, util::SubscriberInitExt as _, EnvFilter};

use crate::propagation::CompositePropagator;

/// Default OTLP gRPC endpoint (SPEC §2.1).
pub const DEFAULT_OTLP_ENDPOINT: &str = "http://otel-collector:4317";

/// Errors returned by [`init`].
#[derive(Debug)]
pub enum InitError {
    /// The OTLP tonic exporter could not be built (bad endpoint URI, TLS
    /// configuration failure, missing runtime, ...).
    Exporter(opentelemetry_otlp::ExporterBuildError),
}

impl fmt::Display for InitError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            InitError::Exporter(e) => write!(f, "failed to build OTLP gRPC exporter: {e}"),
        }
    }
}

impl Error for InitError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            InitError::Exporter(e) => Some(e),
        }
    }
}

/// RAII guard returned by [`init`]. Dropping the guard flushes pending spans
/// and shuts the tracer provider down (SPEC §2.5: "drop flushes").
///
/// Keep this guard alive in `main` for the whole process lifetime, e.g.
/// `let _otel_guard = otelkit::init("my-service")?;`.
#[must_use = "dropping OtelGuard immediately shuts down and flushes the tracer provider"]
pub struct OtelGuard {
    provider: Option<SdkTracerProvider>,
}

impl Drop for OtelGuard {
    fn drop(&mut self) {
        if let Some(provider) = self.provider.take() {
            // Best effort: report but never panic from a destructor.
            if let Err(e) = provider.shutdown() {
                eprintln!("otelkit: tracer provider shutdown failed: {e}");
            }
        }
    }
}

fn env_or(key: &str, default: &str) -> String {
    env::var(key).ok().filter(|v| !v.is_empty()).unwrap_or_else(|| default.to_string())
}

/// Resolve the effective service name: `OTEL_SERVICE_NAME` → `SERVICE_NAME` →
/// the caller-provided fallback (SPEC §2.1).
fn resolve_service_name(fallback: &str) -> String {
    env::var("OTEL_SERVICE_NAME")
        .ok()
        .filter(|v| !v.is_empty())
        .or_else(|| env::var("SERVICE_NAME").ok().filter(|v| !v.is_empty()))
        .unwrap_or_else(|| fallback.to_string())
}

/// Resource attributes required on every span (SPEC §2.2).
fn build_resource(service_name: &str) -> Resource {
    Resource::builder()
        .with_service_name(service_name.to_string())
        .with_attribute(KeyValue::new("service.namespace", "corebanking"))
        .with_attribute(KeyValue::new(
            "deployment.environment",
            env_or("DEPLOY_ENV", "dev"),
        ))
        .build()
}

/// Parent-based trace-id-ratio sampler; `OTEL_TRACES_SAMPLER_ARG` defaults to
/// `1.0` (money services always sample everything, SPEC §2.1). Unparseable or
/// out-of-range values are clamped to `[0, 1]`.
fn build_sampler() -> Sampler {
    let ratio = env::var("OTEL_TRACES_SAMPLER_ARG")
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(1.0)
        .clamp(0.0, 1.0);
    Sampler::ParentBased(Box::new(Sampler::TraceIdRatioBased(ratio)))
}

fn env_filter() -> EnvFilter {
    EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"))
}

/// Initialize telemetry for a corebanking Rust service.
///
/// When `OTEL_SDK_DISABLED` is truthy no exporter is created: only a local
/// fmt subscriber + the W3C propagator are installed and the returned guard
/// is a no-op. This keeps every other kit function callable without cfg
/// gymnastics at the call site.
pub fn init(service_name: &str) -> Result<OtelGuard, InitError> {
    // W3C tracecontext + baggage propagation regardless of SDK state (§2.4):
    // header extraction/injection must keep working so trace context flows
    // through services even when local export is disabled.
    global::set_text_map_propagator(CompositePropagator::new());

    let service_name = resolve_service_name(service_name);

    if crate::sdk_disabled() {
        tracing_subscriber::fmt()
            .with_env_filter(env_filter())
            .try_init()
            .ok();
        return Ok(OtelGuard { provider: None });
    }

    let endpoint = env_or("OTEL_EXPORTER_OTLP_ENDPOINT", DEFAULT_OTLP_ENDPOINT);
    let exporter = SpanExporter::builder()
        .with_tonic()
        .with_endpoint(endpoint)
        .build()
        .map_err(InitError::Exporter)?;

    let provider = SdkTracerProvider::builder()
        .with_batch_exporter(exporter)
        .with_sampler(build_sampler())
        .with_resource(build_resource(&service_name))
        .build();

    global::set_tracer_provider(provider.clone());

    let tracer = provider.tracer(service_name.clone());
    let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);

    tracing_subscriber::registry()
        .with(env_filter())
        .with(tracing_subscriber::fmt::layer())
        .with(otel_layer)
        .try_init()
        .ok(); // a subscriber may already be installed (tests, embedding)

    Ok(OtelGuard {
        provider: Some(provider),
    })
}
