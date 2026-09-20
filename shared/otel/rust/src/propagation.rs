//! W3C `tracecontext` + `baggage` composite propagator (SPEC §2.4).
//!
//! `opentelemetry_sdk` ships `TraceContextPropagator` and `BaggagePropagator`
//! separately, but `global::set_text_map_propagator` accepts only one
//! propagator, so the kit composes them here.

use opentelemetry::{
    propagation::{text_map_propagator::FieldIter, Extractor, Injector, TextMapPropagator},
    Context,
};
use opentelemetry_sdk::propagation::{BaggagePropagator, TraceContextPropagator};

/// Composite W3C propagator: `traceparent`/`tracestate` + `baggage`.
pub(crate) struct CompositePropagator {
    trace_context: TraceContextPropagator,
    baggage: BaggagePropagator,
    fields: Vec<String>,
}

impl CompositePropagator {
    pub(crate) fn new() -> Self {
        CompositePropagator {
            trace_context: TraceContextPropagator::new(),
            baggage: BaggagePropagator::new(),
            fields: vec![
                "traceparent".to_string(),
                "tracestate".to_string(),
                "baggage".to_string(),
            ],
        }
    }
}

impl TextMapPropagator for CompositePropagator {
    fn inject_context(&self, cx: &Context, injector: &mut dyn Injector) {
        self.trace_context.inject_context(cx, injector);
        self.baggage.inject_context(cx, injector);
    }

    fn extract_with_context(&self, cx: &Context, extractor: &dyn Extractor) -> Context {
        let cx = self.trace_context.extract_with_context(cx, extractor);
        self.baggage.extract_with_context(&cx, extractor)
    }

    fn fields(&self) -> FieldIter<'_> {
        FieldIter::new(&self.fields)
    }
}

/// Extract the remote parent context from a header carrier using the global
/// propagator installed by [`crate::init`].
pub(crate) fn extract_context<E: Extractor>(extractor: &E) -> Context {
    opentelemetry::global::get_text_map_propagator(|propagator| propagator.extract(extractor))
}
