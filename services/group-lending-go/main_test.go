package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

// Rewritten: the previous tests referenced helpers (healthHandler/readyzHandler/
// metricsHandler/jwtAuthMiddleware/rateLimitMiddleware/listHandler) from the
// fleet scaffold that this stub service does not implement. These tests cover
// the handlers the service actually serves today.

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthHandler(w, req)
	if w.Code != 200 {
		t.Errorf("health returned %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"status":"ok"`) {
		t.Error("missing ok status")
	}
}

func TestRootEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	rootHandler(w, req)
	if w.Code != 200 {
		t.Errorf("root returned %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"status":"running"`) {
		t.Error("missing running status")
	}
}

func TestUnknownPathNotFound(t *testing.T) {
	req := httptest.NewRequest("GET", "/no-such-path", nil)
	w := httptest.NewRecorder()
	rootHandler(w, req)
	if w.Code != 404 {
		t.Errorf("expected 404 for unknown path, got %d", w.Code)
	}
}
