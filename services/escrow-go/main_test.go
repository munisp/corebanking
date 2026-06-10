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
	if !strings.Contains(w.Body.String(), "escrow") {
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
	req := httptest.NewRequest("GET", "/v1/escrow/list", nil)
	w := httptest.NewRecorder()
	handleList(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandleCreate(t *testing.T) {
	body := `{"id":"test","type":"property","amount":100000}`
	req := httptest.NewRequest("POST", "/v1/escrow/create", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleCreate(w, req)
	if w.Code < 200 || w.Code >= 300 {
		t.Fatalf("expected 2xx, got %d", w.Code)
	}
}

func TestHandleStats(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/stats", nil)
	w := httptest.NewRecorder()
	handleStats(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestValidateAmount(t *testing.T) {
	if err := validateAmount(100); err != nil {
		t.Errorf("100 should be valid: %v", err)
	}
	if err := validateAmount(-1); err == nil {
		t.Error("negative should be invalid")
	}
}

func TestRoundNaira(t *testing.T) {
	got := roundNaira(100.005)
	if got != 100.01 {
		t.Errorf("roundNaira(100.005) = %f, want 100.01", got)
	}
}
