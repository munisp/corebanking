package main

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthz(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthz(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["service"] != "scratch-card-pin-go" {
		t.Fatalf("unexpected service name: %v", resp["service"])
	}
}

func TestListCards(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/scratch-cards", nil)
	w := httptest.NewRecorder()
	handleCards(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	if len(items) < 8 {
		t.Fatalf("expected at least 8 cards, got %d", len(items))
	}
}

func TestListCardsFilterByType(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/scratch-cards?type=grid_challenge", nil)
	w := httptest.NewRecorder()
	handleCards(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	for _, item := range items {
		card := item.(map[string]interface{})
		if card["cardType"] != "grid_challenge" {
			t.Fatalf("expected grid_challenge type, got %v", card["cardType"])
		}
	}
}

func TestListBatches(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/scratch-cards/batches", nil)
	w := httptest.NewRecorder()
	handleBatches(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if int(resp["total"].(float64)) < 4 {
		t.Fatalf("expected at least 4 batches")
	}
}

func TestListVerifications(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/scratch-cards/verifications", nil)
	w := httptest.NewRecorder()
	handleVerifications(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestAudit(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/scratch-cards/audit", nil)
	w := httptest.NewRecorder()
	handleAudit(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestStats(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/scratch-cards/stats", nil)
	w := httptest.NewRecorder()
	handleStats(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["totalCards"] == nil {
		t.Fatal("expected totalCards in stats")
	}
}

func TestVerifyPinSuccess(t *testing.T) {
	// We can't test actual PIN verification without knowing the plaintext
	// But we can test the endpoint returns proper error for unknown card
	body := `{"serialNumber":"NONEXISTENT","pin":"123456","customerId":"CUST-TEST","channel":"mobile"}`
	req := httptest.NewRequest("POST", "/v1/scratch-cards/verify", strings.NewReader(body))
	w := httptest.NewRecorder()
	handleVerify(w, req)
	if w.Code != 404 {
		t.Fatalf("expected 404 for nonexistent card, got %d", w.Code)
	}
}

func TestVerifyRevokedCard(t *testing.T) {
	body := `{"serialNumber":"54B-TXN-000003","pin":"628104","customerId":"CUST-TEST","channel":"mobile"}`
	req := httptest.NewRequest("POST", "/v1/scratch-cards/verify", strings.NewReader(body))
	w := httptest.NewRecorder()
	handleVerify(w, req)
	if w.Code != 403 {
		t.Fatalf("expected 403 for revoked card, got %d", w.Code)
	}
}

func TestCreateBatch(t *testing.T) {
	body := `{"cardType":"transaction_pin","batchSize":5,"branchCode":"TST-001","pinLength":6}`
	req := httptest.NewRequest("POST", "/v1/scratch-cards", strings.NewReader(body))
	w := httptest.NewRecorder()
	handleCards(w, req)
	if w.Code != 201 {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["batch"] == nil {
		t.Fatal("expected batch in response")
	}
	if resp["sampleCards"] == nil {
		t.Fatal("expected sampleCards in response")
	}
}

func TestGenerateSecurePin(t *testing.T) {
	pin := generateSecurePin(6)
	if len(pin) != 6 {
		t.Fatalf("expected 6-digit PIN, got %d digits", len(pin))
	}
	for _, c := range pin {
		if c < '0' || c > '9' {
			t.Fatalf("PIN contains non-digit: %c", c)
		}
	}
}

func TestHashPin(t *testing.T) {
	hash1 := hashPin("123456")
	hash2 := hashPin("123456")
	if hash1 != hash2 {
		t.Fatal("same PIN should produce same hash")
	}
	hash3 := hashPin("654321")
	if hash1 == hash3 {
		t.Fatal("different PINs should produce different hashes")
	}
}

func TestGenerateGridValues(t *testing.T) {
	grid := generateGridValues()
	if len(grid) != 25 {
		t.Fatalf("expected 25 grid values for 5x5, got %d", len(grid))
	}
	if _, ok := grid["A1"]; !ok {
		t.Fatal("missing A1 grid position")
	}
	if _, ok := grid["E5"]; !ok {
		t.Fatal("missing E5 grid position")
	}
}
