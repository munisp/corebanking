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
    handleHealthz(w, req)
    if w.Code != 200 { t.Errorf("health returned %d", w.Code) }
    if !strings.Contains(w.Body.String(), "healthy") { t.Error("missing healthy status") }
}

func TestReadyzEndpoint(t *testing.T) {
    req := httptest.NewRequest("GET", "/readyz", nil)
    w := httptest.NewRecorder()
    readyzHandler(w, req)
    if w.Code != 200 { t.Errorf("readyz returned %d", w.Code) }
}

func TestMetricsEndpoint(t *testing.T) {
    req := httptest.NewRequest("GET", "/metrics", nil)
    w := httptest.NewRecorder()
    metricsHandler(w, req)
    if w.Code != 200 { t.Errorf("metrics returned %d", w.Code) }
    if !strings.Contains(w.Body.String(), "requests_total") { t.Error("missing requests_total metric") }
}

func TestJWTRequired(t *testing.T) {
    req := httptest.NewRequest("GET", "/api/verifications", nil)
    w := httptest.NewRecorder()
    handler := jwtAuthMiddleware(http.HandlerFunc(handleVerifications))
    handler.ServeHTTP(w, req)
    if w.Code != 401 { t.Errorf("expected 401 without JWT, got %d", w.Code) }
}

func TestRateLimiting(t *testing.T) {
    for i := 0; i < 200; i++ {
        req := httptest.NewRequest("GET", "/healthz", nil)
        w := httptest.NewRecorder()
        rateLimitMiddleware(http.HandlerFunc(handleHealthz)).ServeHTTP(w, req)
    }
}
