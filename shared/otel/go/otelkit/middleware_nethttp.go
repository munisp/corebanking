package otelkit

import (
	"net/http"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
)

// HTTPMiddleware wraps a net/http handler with an otelhttp server span and
// tenant.id attribution (SPEC §2.3/§2.5). The tenant id is placed in the
// request context before the server span starts so the tenant span processor
// can stamp tenant.id on the server span and all its children.
//
// When OTEL_SDK_DISABLED is truthy the handler is returned unchanged.
func HTTPMiddleware(next http.Handler) http.Handler {
	if SDKDisabled() {
		return next
	}
	otelHandler := otelhttp.NewHandler(next, "http.server",
		otelhttp.WithPropagators(otel.GetTextMapPropagator()),
		otelhttp.WithSpanNameFormatter(func(_ string, r *http.Request) string {
			// Method-only span names bound cardinality (http.Request.Pattern
			// is not available on the pinned go1.22 toolchain in use).
			return r.Method
		}),
	)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if id := TenantID(r); id != "" {
			r = r.WithContext(ContextWithTenantID(r.Context(), id))
		}
		otelHandler.ServeHTTP(w, r)
	})
}
