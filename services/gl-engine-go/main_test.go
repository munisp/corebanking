package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
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
	if w.Code != 503 {
		t.Errorf("readyz with nil db returned %d, expected 503 (fail-closed)", w.Code)
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

// H-40 remediation: the previous TestRateLimiting fired 200 requests with no
// assertions — it passed even if the limiter never limited anything. The
// limiter grants a 100-token bucket refilled once per second; these tests
// assert the bucket is enforced (429 + Retry-After once exhausted) and that
// within-budget requests pass through.
func TestRateLimiting(t *testing.T) {
	// Reset the bucket to a known state: 100 tokens, no pending refill.
	atomic.StoreInt64(&_rlTokens, 100)
	atomic.StoreInt64(&_rlLastRefill, time.Now().UnixMilli())

	handler := rateLimitMiddleware(http.HandlerFunc(healthHandler))

	// The first 100 requests (the full bucket) must pass.
	for i := 0; i < 100; i++ {
		req := httptest.NewRequest("GET", "/healthz", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != 200 {
			t.Fatalf("request %d within the 100-token budget was rejected with %d", i+1, w.Code)
		}
	}

	// The 101st request must be rejected with 429 and a Retry-After hint.
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != 429 {
		t.Fatalf("expected 429 once the token bucket is exhausted, got %d", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Error("429 response must carry a Retry-After header")
	}
	if !strings.Contains(w.Body.String(), "rate_limit_exceeded") {
		t.Errorf("429 body must identify the rate-limit error, got %q", w.Body.String())
	}
}

// TestRateLimiterRefill proves the bucket refills after the 1s window so a
// rejected client is not banned forever.
func TestRateLimiterRefill(t *testing.T) {
	atomic.StoreInt64(&_rlTokens, 0)
	// Simulate a last refill far in the past so the next call refills.
	atomic.StoreInt64(&_rlLastRefill, time.Now().UnixMilli()-2000)

	if !rlAllow() {
		t.Fatal("bucket must refill after the 1s window elapses")
	}
}
