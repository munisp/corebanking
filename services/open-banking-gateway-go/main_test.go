package main

import (
	"testing"
	"net/http"
	"net/http/httptest"
	"encoding/json"
)

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	handleHealthz(w, req)
	if w.Code != http.StatusOK { t.Errorf("health returned %d, want 200", w.Code) }
	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["status"] != "healthy" { t.Errorf("status = %v, want healthy", body["status"]) }
}

func TestCircuitBreakerAllow(t *testing.T) {
	cbState = cbClosed
	if !cbAllow() { t.Error("closed breaker should allow") }
}

func TestCircuitBreakerOpens(t *testing.T) {
	cbState = cbClosed
	for i := uint64(0); i < cbThreshold; i++ {
		cbRecordFailure()
	}
	if cbState != cbOpen { t.Error("breaker should be open after threshold failures") }
	cbRecordSuccess()
	if cbState != cbClosed { t.Error("breaker should close after success") }
}
