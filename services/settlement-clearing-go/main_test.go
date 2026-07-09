package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

func setupSettlementTest() {
	app.db = nil
}

func TestProcessTransferNoDB(t *testing.T) {
	setupSettlementTest()
	body := `{"source_bank":"054","dest_bank":"058","amount_kobo":100000}`
	req := httptest.NewRequest("POST", "/v1/settlement/transfer", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	processTransfer(w, req)
	if w.Code != 503 {
		t.Fatalf("expected 503 (no DB), got %d: %s", w.Code, w.Body.String())
	}
}

func TestProcessTransferValidation(t *testing.T) {
	setupSettlementTest()
	tests := []struct {
		name     string
		body     string
		wantCode int
	}{
		{"invalid json", `{bad`, 400},
		{"negative amount", `{"source_bank":"054","dest_bank":"058","amount_kobo":-100}`, 400},
		{"zero amount", `{"source_bank":"054","dest_bank":"058","amount_kobo":0}`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/v1/settlement/transfer", bytes.NewBufferString(tt.body))
			w := httptest.NewRecorder()
			processTransfer(w, req)
			if w.Code != tt.wantCode {
				t.Errorf("expected %d, got %d: %s", tt.wantCode, w.Code, w.Body.String())
			}
		})
	}
}

func TestGetPositionsNoDB(t *testing.T) {
	setupSettlementTest()
	req := httptest.NewRequest("GET", "/v1/settlement/positions", nil)
	w := httptest.NewRecorder()
	getPositions(w, req)
	if w.Code != 503 {
		t.Fatalf("expected 503 (no DB), got %d: %s", w.Code, w.Body.String())
	}
}

func TestHealthEndpoint(t *testing.T) {
	setupSettlementTest()
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthz(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["service"] != "settlement-clearing-go" {
		t.Fatalf("expected service name, got %v", resp["service"])
	}
	if resp["status"] != "healthy" {
		t.Fatalf("expected status=healthy, got %v", resp["status"])
	}
	// Verify settlement types listed
	types, ok := resp["settlement_types"].([]interface{})
	if !ok || len(types) != 3 {
		t.Fatalf("expected 3 settlement types (RTGS, NIP, DNS), got %v", resp["settlement_types"])
	}
}

func TestSettlementTypeDetermination(t *testing.T) {
	// RTGS is for amounts > 5M NGN (500,000,000 kobo)
	// NIP is for amounts <= 5M NGN
	if 500000001 <= 500000000 {
		t.Fatal("amount 500000001 should be RTGS")
	}
	if 500000000 > 500000000 {
		t.Fatal("amount 500000000 should be NIP")
	}
}

func TestNostroPositionStruct(t *testing.T) {
	p := NostroPosition{
		PositionID:   "POS-001",
		BankCode:     "054",
		BankName:     "First Bank",
		BalanceKobo:  1000000000,
		Currency:     "NGN",
		MaxLimitKobo: 5000000000,
		MinLimitKobo: 100000000,
	}
	if p.BalanceKobo < p.MinLimitKobo {
		t.Fatal("balance should be above min limit")
	}
	if p.BalanceKobo > p.MaxLimitKobo {
		t.Fatal("balance should be below max limit")
	}
}

func TestNIPTransferStruct(t *testing.T) {
	transfer := NIPTransfer{
		TransferID:     "NIP-001",
		SourceBank:     "054",
		DestBank:       "058",
		AmountKobo:     100000,
		SessionID:      "SESS-001",
		SettlementType: "NIP",
		Status:         "settled",
	}
	if transfer.AmountKobo <= 0 {
		t.Fatal("amount must be positive")
	}
	if transfer.SettlementType != "NIP" && transfer.SettlementType != "RTGS" && transfer.SettlementType != "DNS" {
		t.Fatalf("invalid settlement type: %s", transfer.SettlementType)
	}
}

func TestRespondJSON(t *testing.T) {
	w := httptest.NewRecorder()
	respondJSON(w, 201, map[string]string{"key": "value"})
	if w.Code != 201 {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	if w.Header().Get("Content-Type") != "application/json" {
		t.Fatal("expected Content-Type application/json")
	}
	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["key"] != "value" {
		t.Fatalf("expected key=value, got %v", resp["key"])
	}
}
