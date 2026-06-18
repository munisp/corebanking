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
	handleHealthz(w, req)
	if w.Code != 200 { t.Errorf("readyz returned %d", w.Code) }
}

func TestMetricsEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/metrics", nil)
	w := httptest.NewRecorder()
	handleMetrics(w, req)
	if w.Code != 200 { t.Errorf("metrics returned %d", w.Code) }
	if !strings.Contains(w.Body.String(), "requests_total") { t.Error("missing requests_total metric") }
}

func TestSecretPathValidation(t *testing.T) {
	valid, _ := validateSecretPath("secret/banking/api-keys")
	if !valid { t.Error("expected valid path") }
	valid2, _ := validateSecretPath("")
	if valid2 { t.Error("expected empty path to be invalid") }
}

func TestSecretListEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/secrets/list", nil)
	w := httptest.NewRecorder()
	handleSecretList(w, req)
	if w.Code != http.StatusOK { t.Errorf("list returned %d", w.Code) }
}
