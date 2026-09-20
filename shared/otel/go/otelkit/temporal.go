package otelkit

import (
	"go.opentelemetry.io/otel"
	temporalotel "go.temporal.io/sdk/contrib/opentelemetry"
	"go.temporal.io/sdk/interceptor"
)

// TemporalInterceptors returns the Temporal worker tracing interceptor from
// go.temporal.io/sdk/contrib/opentelemetry (SPEC §2.5). Wire it via
// worker.Options{Interceptors: []interceptor.WorkerInterceptor{...}}.
//
// Note: the SPEC names the return type interceptor.WorkerInterceptors
// (plural); no such type exists in go.temporal.io/sdk v1.16–v1.33 — the
// worker-consumable interface is interceptor.WorkerInterceptor, which the
// tracing interceptor satisfies (interceptor.Interceptor embeds it).
//
// The interceptor uses the ambient tracer provider and W3C propagator, so it
// is automatically a no-op when OTEL_SDK_DISABLED left the default no-op
// providers in place. If interceptor construction fails (invalid options),
// nil is returned and the worker runs untraced.
func TemporalInterceptors() interceptor.WorkerInterceptor {
	ti, err := temporalotel.NewTracingInterceptor(temporalotel.TracerOptions{
		Tracer:            otel.Tracer(tracerName + "/temporal"),
		TextMapPropagator: otel.GetTextMapPropagator(),
	})
	if err != nil {
		return nil
	}
	return ti
}
