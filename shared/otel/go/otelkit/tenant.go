package otelkit

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// Tenant attribution convention (SPEC §2.3).
const (
	// TenantHeader is the ingress header carrying the tenant id.
	TenantHeader = "x-tenant-id"
	// TenantIDAttribute is the span/metric attribute key.
	TenantIDAttribute = "tenant.id"
	// tenantJWTClaim is the JWT claim used as fallback source.
	tenantJWTClaim = "tenant_id"
)

type tenantIDContextKey struct{}

// ContextWithTenantID returns a context carrying the tenant id. Spans started
// from this context (or its children) automatically get the tenant.id
// attribute via the span processor installed by Init.
func ContextWithTenantID(ctx context.Context, tenantID string) context.Context {
	if tenantID == "" {
		return ctx
	}
	return context.WithValue(ctx, tenantIDContextKey{}, tenantID)
}

// TenantIDFromContext extracts a tenant id previously stored with
// ContextWithTenantID.
func TenantIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(tenantIDContextKey{}).(string)
	return id, ok && id != ""
}

// TenantIDAttributeKV returns the tenant.id attribute for explicit
// attribution (e.g. metrics labels on money-path services).
func TenantIDAttributeKV(tenantID string) attribute.KeyValue {
	return attribute.String(TenantIDAttribute, tenantID)
}

// TenantID extracts the tenant id from an HTTP request. Source priority per
// SPEC §2.3: x-tenant-id header → JWT tenant_id claim → none ("").
func TenantID(r *http.Request) string {
	if id := strings.TrimSpace(r.Header.Get(TenantHeader)); id != "" {
		return id
	}
	return tenantIDFromJWT(r)
}

// tenantIDFromJWT reads the tenant_id claim from the bearer token WITHOUT
// signature verification. It is used purely for telemetry attribution when the
// trusted header is absent; authentication remains the responsibility of the
// service's auth middleware.
func tenantIDFromJWT(r *http.Request) string {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(auth) < 8 || !strings.EqualFold(auth[:7], "Bearer ") {
		return ""
	}
	parts := strings.Split(strings.TrimSpace(auth[7:]), ".")
	if len(parts) != 3 {
		return ""
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return ""
	}
	var claims map[string]json.RawMessage
	if err := json.Unmarshal(payload, &claims); err != nil {
		return ""
	}
	raw, ok := claims[tenantJWTClaim]
	if !ok {
		return ""
	}
	var id string
	if err := json.Unmarshal(raw, &id); err != nil {
		return ""
	}
	return id
}

// tenantSpanProcessor stamps tenant.id on every span started under a context
// that carries a tenant id (SPEC §2.3). Registered by Init.
type tenantSpanProcessor struct{}

func (tenantSpanProcessor) OnStart(parent context.Context, s sdktrace.ReadWriteSpan) {
	if id, ok := TenantIDFromContext(parent); ok {
		s.SetAttributes(TenantIDAttributeKV(id))
	}
}

func (tenantSpanProcessor) OnEnd(sdktrace.ReadOnlySpan)      {}
func (tenantSpanProcessor) Shutdown(context.Context) error   { return nil }
func (tenantSpanProcessor) ForceFlush(context.Context) error { return nil }
