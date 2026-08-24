package main

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthz(w, req)
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
	handler := jwtAuthMiddleware(http.HandlerFunc(lcLifecycleGL))
	handler.ServeHTTP(w, req)
	if w.Code != 401 {
		t.Errorf("expected 401 without JWT, got %d", w.Code)
	}
}

func TestRateLimiting(t *testing.T) {
	for i := 0; i < 200; i++ {
		req := httptest.NewRequest("GET", "/healthz", nil)
		w := httptest.NewRecorder()
		rateLimitMiddleware(http.HandlerFunc(healthz)).ServeHTTP(w, req)
	}
}

func TestJWTForgedTokenRejected(t *testing.T) {
	// A structurally valid RS256-shaped token with a forged signature must be
	// rejected: the middleware performs real JWKS signature verification and
	// never trusts token structure or claims without a valid signature.
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","kid":"forged-key"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"attacker","exp":9999999999}`))
	sig := base64.RawURLEncoding.EncodeToString([]byte("forged-signature"))
	req := httptest.NewRequest("GET", "/api/list", nil)
	req.Header.Set("Authorization", "Bearer "+header+"."+payload+"."+sig)
	w := httptest.NewRecorder()
	handler := jwtAuthMiddleware(http.HandlerFunc(lcLifecycleGL))
	handler.ServeHTTP(w, req)
	if w.Code != 401 {
		t.Errorf("expected 401 for forged JWT, got %d", w.Code)
	}
}
