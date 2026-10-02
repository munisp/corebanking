package otelkit

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/otel"
)

// GinMiddleware returns a gin middleware combining otelgin server spans with
// tenant.id attribution (SPEC §2.3/§2.5). The tenant id is stored in the
// request context before otelgin starts its span, so the tenant span processor
// stamps tenant.id on the server span and all child spans.
//
// When OTEL_SDK_DISABLED is truthy the returned middleware is a pass-through.
func GinMiddleware() gin.HandlerFunc {
	if SDKDisabled() {
		return func(c *gin.Context) { c.Next() }
	}
	otelHandler := otelgin.Middleware(resolveServiceName("gin"),
		otelgin.WithPropagators(otel.GetTextMapPropagator()),
	)
	return func(c *gin.Context) {
		if id := TenantID(c.Request); id != "" {
			c.Request = c.Request.WithContext(ContextWithTenantID(c.Request.Context(), id))
		}
		otelHandler(c)
	}
}
