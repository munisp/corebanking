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
	if body["status"] != "ok" { t.Errorf("status = %v, want ok", body["status"]) }
}
