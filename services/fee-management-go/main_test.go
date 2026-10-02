package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthHandler(w, req)
	if w.Code != 200 {
		t.Errorf("health returned %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "status") {
		t.Error("missing healthy status")
	}
}

func TestReadyzEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/readyz", nil)
	w := httptest.NewRecorder()
	readyzHandler(w, req)
	if w.Code != 200 {
		t.Errorf("readyz returned %d", w.Code)
	}
}

func TestMetricsEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/metrics", nil)
	w := httptest.NewRecorder()
	metricsHandler(w, req)
	if w.Code != 200 {
		t.Errorf("metrics returned %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "requests_total") {
		t.Error("missing requests_total metric")
	}
}

func TestJWTRequired(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/list", nil)
	w := httptest.NewRecorder()
	handler := jwtAuthMiddleware(http.HandlerFunc(healthHandler))
	handler.ServeHTTP(w, req)
	if w.Code != 401 {
		t.Errorf("expected 401 without JWT, got %d", w.Code)
	}
}

func TestRateLimiting(t *testing.T) {
	for i := 0; i < 200; i++ {
		req := httptest.NewRequest("GET", "/healthz", nil)
		w := httptest.NewRecorder()
		rateLimitMiddleware(http.HandlerFunc(healthHandler)).ServeHTTP(w, req)
	}
}

// MN-10: evaluate endpoint — deterministic, pure over the rule set.
func TestEvaluateEndpoint(t *testing.T) {
	store := newMemStore()
	bps := int64(50) // 0.50%
	fixed := int64(1000)
	feeAcct := "4201"
	tenant := "t1"
	tt := "external_debit"
	mk := func(name string) *string { return &name }
	_ = mk
	store.Create(&FeeRule{ID: "r1", Name: "global", FeeType: "flat", AmountKobo: &fixed, Currency: "NGN", Status: "active", FeeAccountID: &feeAcct, CreatedAt: "2024-01-01T00:00:00Z"})
	store.Create(&FeeRule{ID: "r2", Name: "tenant-specific", FeeType: "percent", RateBps: &bps, Currency: "NGN", Status: "active", TenantID: &tenant, TransactionType: &tt, CreatedAt: "2024-01-02T00:00:00Z"})

	eval := func(body string) (int, EvaluateResponse) {
		req := httptest.NewRequest("POST", "/v1/fee-rules/evaluate", strings.NewReader(body))
		w := httptest.NewRecorder()
		handleEvaluate(store).ServeHTTP(w, req)
		var resp EvaluateResponse
		_ = json.Unmarshal(w.Body.Bytes(), &resp)
		return w.Code, resp
	}

	// most specific rule wins: 50bps of 200_000 = 1000 kobo
	code, resp := eval(`{"transaction_type":"external_debit","amount_kobo":200000,"tenant_id":"t1","channel":"api"}`)
	if code != 200 || !resp.Matched || resp.RuleID != "r2" || resp.FeeKobo != 1000 {
		t.Errorf("tenant rule: code=%d resp=%+v", code, resp)
	}
	// global fallback: fixed 1000 kobo + fee_account_id surfaced
	code, resp = eval(`{"transaction_type":"external_debit","amount_kobo":200000,"tenant_id":"other","channel":"api"}`)
	if code != 200 || !resp.Matched || resp.RuleID != "r1" || resp.FeeKobo != 1000 || resp.FeeAccountID != "4201" {
		t.Errorf("global rule: code=%d resp=%+v", code, resp)
	}
	// ROUND_HALF_UP on proportional leg: 50bps of 1100 = 5.5 → 6 (not truncation)
	_, resp = eval(`{"transaction_type":"external_debit","amount_kobo":1100,"tenant_id":"t1","channel":"api"}`)
	if resp.FeeKobo != 6 {
		t.Errorf("rounding: got %d want 6", resp.FeeKobo)
	}
	// no match → explicit unmatched zero fee
	_, resp = eval(`{"transaction_type":"x","amount_kobo":1000,"tenant_id":"t9","currency":"USD"}`)
	if resp.Matched || resp.FeeKobo != 0 {
		t.Errorf("unmatched: %+v", resp)
	}
}
