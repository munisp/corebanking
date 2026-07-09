package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

// These tests validate request validation, HTTP handlers, and response structure.
// Full persistence tests require a running PostgreSQL instance.

func TestPlaceLienValidation(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		wantCode int
	}{
		{"invalid json", `{bad`, 400},
		{"negative amount", `{"account_id":"A","amount_kobo":-1,"type":"judicial_hold","reason":"test","reference":"R","placed_by":"admin"}`, 400},
		{"zero amount", `{"account_id":"A","amount_kobo":0,"type":"judicial_hold","reason":"test","reference":"R","placed_by":"admin"}`, 400},
		{"invalid type", `{"account_id":"A","amount_kobo":5000,"type":"invalid_type","reason":"test","reference":"R","placed_by":"admin"}`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/v1/liens", bytes.NewBufferString(tt.body))
			w := httptest.NewRecorder()
			placeLien(w, req)
			if w.Code != tt.wantCode {
				t.Errorf("expected %d, got %d: %s", tt.wantCode, w.Code, w.Body.String())
			}
		})
	}
}

func TestPlaceLienNoDBReturnsLienID(t *testing.T) {
	// Without DB, service still generates lien ID and returns 201
	app.db = nil
	body := `{"account_id":"ACCT-001","amount_kobo":50000,"type":"judicial_hold","reason":"court_order","reference":"CO-2026","placed_by":"legal"}`
	req := httptest.NewRequest("POST", "/v1/liens", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	placeLien(w, req)
	if w.Code != 201 {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if resp["lien_id"] == nil || resp["lien_id"] == "" {
		t.Fatal("expected lien_id in response")
	}
	if resp["status"] != "active" {
		t.Fatalf("expected status=active, got %v", resp["status"])
	}
}

func TestReleaseLienNoDBReturns503(t *testing.T) {
	app.db = nil
	body := `{"lien_id":"LIEN-ABC123","released_by":"admin"}`
	req := httptest.NewRequest("POST", "/v1/liens/release", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	releaseLien(w, req)
	if w.Code != 503 {
		t.Fatalf("expected 503 (no DB), got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetAccountLiensNoDBReturns503(t *testing.T) {
	app.db = nil
	req := httptest.NewRequest("GET", "/v1/liens?account_id=ACCT-001", nil)
	w := httptest.NewRecorder()
	getAccountLiens(w, req)
	if w.Code != 503 {
		t.Fatalf("expected 503 (no DB), got %d", w.Code)
	}
}

func TestHealthz(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthz(w, req)
	if w.Code != 200 {
		t.Fatalf("healthz: expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["service"] != serviceName {
		t.Fatalf("expected service=%s, got %v", serviceName, resp["service"])
	}
}

func TestValidLienTypes(t *testing.T) {
	validTypes := []string{"judicial_hold", "collateral_lock", "garnishment", "regulatory_freeze", "card_hold", "loan_security"}
	for _, lt := range validTypes {
		t.Run(lt, func(t *testing.T) {
			app.db = nil
			body, _ := json.Marshal(map[string]interface{}{
				"account_id": "ACCT-TEST", "amount_kobo": 1000,
				"type": lt, "reason": "test", "reference": "REF", "placed_by": "admin",
			})
			req := httptest.NewRequest("POST", "/v1/liens", bytes.NewReader(body))
			w := httptest.NewRecorder()
			placeLien(w, req)
			if w.Code != 201 {
				t.Errorf("type %s: expected 201, got %d", lt, w.Code)
			}
		})
	}
}
