package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestQRHealthz(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthz(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["service"] != "qr-payments-go" {
		t.Fatalf("expected service qr-payments-go, got %v", resp["service"])
	}
}

func TestListQRPayments(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/qr/payments", nil)
	w := httptest.NewRecorder()
	listItems(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items, ok := resp["items"].([]interface{})
	if !ok {
		t.Fatal("expected items array")
	}
	if len(items) < 4 {
		t.Fatalf("expected at least 4 QR payments, got %d", len(items))
	}
}

func TestGenerateQR(t *testing.T) {
	body := `{"merchantId":"M-001","amount":5000,"currency":"NGN","description":"Test QR"}`
	req := httptest.NewRequest("POST", "/v1/qr/generate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	listItems(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["qrType"] != "dynamic" {
		t.Errorf("expected dynamic QR, got %v", resp["qrType"])
	}
}

func TestQRPaymentStats(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/qr/stats", nil)
	w := httptest.NewRecorder()
	getStats(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	successful := resp["successfulCount"].(float64)
	if successful != 4 {
		t.Errorf("expected 4 successful payments, got %v", successful)
	}
}
