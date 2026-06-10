package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthz(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	handleHealthz(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "scratch") {
		t.Error("expected service name in health response")
	}
}

func TestReadyz(t *testing.T) {
	req := httptest.NewRequest("GET", "/readyz", nil)
	w := httptest.NewRecorder()
	readyzHandler(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestMetrics(t *testing.T) {
	req := httptest.NewRequest("GET", "/metrics", nil)
	w := httptest.NewRecorder()
	metricsHandler(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "requests_total") {
		t.Error("expected requests_total metric")
	}
}

func TestHandleList(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/scratch-card-pin/list", nil)
	w := httptest.NewRecorder()
	handleList(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandleStats(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/scratch-card-pin/stats", nil)
	w := httptest.NewRecorder()
	handleStats(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandleAudit(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/scratch-card-pin/audit", nil)
	w := httptest.NewRecorder()
	handleAudit(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

