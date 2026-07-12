package main

import (
	"net/http/httptest"
	"testing"
)

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	handleHealthz(w, req)
	if w.Code != 200 {
		t.Errorf("healthz returned %d", w.Code)
	}
}

func TestTransactionsEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/nip/transactions", nil)
	w := httptest.NewRecorder()
	handleTransactions(w, req)
	if w.Code != 200 {
		t.Errorf("transactions returned %d", w.Code)
	}
}

func TestSettlementsEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/nip/settlements", nil)
	w := httptest.NewRecorder()
	handleSettlements(w, req)
	if w.Code != 200 {
		t.Errorf("settlements returned %d", w.Code)
	}
}

func TestResponseCodesEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/nip/response-codes", nil)
	w := httptest.NewRecorder()
	handleResponseCodes(w, req)
	if w.Code != 200 {
		t.Errorf("response-codes returned %d", w.Code)
	}
}
