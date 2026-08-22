package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthHandler(w, req)
	if w.Code != 200 {
		t.Errorf("health returned %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "healthy") {
		t.Error("missing healthy status")
	}
}

func TestReadyzEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/readyz", nil)
	w := httptest.NewRecorder()
	readyzHandler(w, req)
	if w.Code != 200 {
		t.Errorf("readyz returned %d", w.Code)
	}
}

func TestMetricsEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/metrics", nil)
	w := httptest.NewRecorder()
	metricsHandler(w, req)
	if w.Code != 200 {
		t.Errorf("metrics returned %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "requests_total") {
		t.Error("missing requests_total metric")
	}
}

func TestJWTRequired(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/list", nil)
	w := httptest.NewRecorder()
	handler := jwtAuthMiddleware(http.HandlerFunc(listHandler))
	handler.ServeHTTP(w, req)
	if w.Code != 401 {
		t.Errorf("expected 401 without JWT, got %d", w.Code)
	}
}

// H-40 remediation: the previous TestRateLimiting looped 200 requests through
// the middleware with zero assertions — it could never fail. The middleware
// named rateLimitMiddleware is in fact the CORS policy layer; these tests
// assert its actual, security-relevant behavior.
func TestCORSPreflightHandled(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.54bank.ng")
	req := httptest.NewRequest("OPTIONS", "/api/list", nil)
	req.Header.Set("Origin", "https://app.54bank.ng")
	w := httptest.NewRecorder()
	called := false
	handler := rateLimitMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called = true }))
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Errorf("OPTIONS preflight must return 204, got %d", w.Code)
	}
	if called {
		t.Error("preflight request must not reach the protected handler")
	}
}

func TestCORSAllowedOriginEchoed(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.54bank.ng")
	req := httptest.NewRequest("GET", "/healthz", nil)
	req.Header.Set("Origin", "https://app.54bank.ng")
	w := httptest.NewRecorder()
	rateLimitMiddleware(http.HandlerFunc(healthHandler)).ServeHTTP(w, req)
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://app.54bank.ng" {
		t.Errorf("allow-listed origin not echoed, got %q", got)
	}
	if w.Header().Get("Vary") != "Origin" {
		t.Error("Vary: Origin header missing for CORS response")
	}
}

func TestCORSDisallowedOriginNotReflected(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.54bank.ng")
	req := httptest.NewRequest("GET", "/healthz", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	w := httptest.NewRecorder()
	rateLimitMiddleware(http.HandlerFunc(healthHandler)).ServeHTTP(w, req)
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("non-allow-listed origin must not be reflected, got %q", got)
	}
}

func TestCORSNoOriginsConfiguredDeniesCrossOrigin(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	req := httptest.NewRequest("GET", "/healthz", nil)
	req.Header.Set("Origin", "https://app.54bank.ng")
	w := httptest.NewRecorder()
	rateLimitMiddleware(http.HandlerFunc(healthHandler)).ServeHTTP(w, req)
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("with empty allowlist, no origin may be allowed, got %q", got)
	}
}
