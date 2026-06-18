package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthz(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthz(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["service"] != "escrow-go" {
		t.Fatalf("expected service escrow-go, got %v", resp["service"])
	}
	mw, ok := resp["middleware"].(map[string]interface{})
	if !ok || mw == nil {
		t.Fatal("expected middleware config in healthz response")
	}
	requiredMiddleware := []string{"kafka", "redis", "postgres", "opensearch", "keycloak", "permify", "dapr", "fluvio", "temporal", "mojaloop", "tigerbeetle", "lakehouse", "apisix", "openappsec"}
	for _, m := range requiredMiddleware {
		if _, found := mw[m]; !found {
			t.Errorf("missing middleware: %s", m)
		}
	}
	features, ok := resp["features"].([]interface{})
	if !ok || len(features) < 5 {
		t.Error("expected features list with at least 5 items")
	}
}

func TestListEscrowAccounts(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/accounts", nil)
	w := httptest.NewRecorder()
	handleAccounts(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items, ok := resp["items"].([]interface{})
	if !ok {
		t.Fatal("expected items array")
	}
	if len(items) < 10 {
		t.Fatalf("expected at least 10 seed escrow accounts, got %d", len(items))
	}
}

func TestListAccountsWithFilter(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/accounts?status=active", nil)
	w := httptest.NewRecorder()
	handleAccounts(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	for _, item := range items {
		acct := item.(map[string]interface{})
		if acct["status"] != "active" {
			t.Errorf("expected only active accounts, got %v", acct["status"])
		}
	}
}

func TestCreateEscrowAccountRequiresParties(t *testing.T) {
	body := `{"amount":5000000,"currency":"NGN","escrowType":"property","condition":"test","parties":[]}`
	req := httptest.NewRequest("POST", "/v1/escrow/accounts", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleAccounts(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty parties, got %d", w.Code)
	}
}

func TestCreateEscrowAccountWithMultiParty(t *testing.T) {
	body := `{
		"amount":100000000,"currency":"NGN","escrowType":"construction","condition":"milestone test",
		"parties":[
			{"role":"buyer","name":"Test Buyer Corp","accountId":"ACC-T1"},
			{"role":"seller","name":"Test Seller Ltd","accountId":"ACC-T2"},
			{"role":"engineer","name":"Test Engineer","accountId":"ACC-T3"}
		]
	}`
	req := httptest.NewRequest("POST", "/v1/escrow/accounts", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handleAccounts(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d — %s", w.Code, w.Body.String())
	}
	var resp EscrowAccount
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Status != "draft" {
		t.Errorf("expected status draft, got %v", resp.Status)
	}
	if len(resp.Parties) != 3 {
		t.Errorf("expected 3 parties, got %d", len(resp.Parties))
	}
	if resp.SetupFee <= 0 {
		t.Error("expected setup fee to be calculated")
	}
	if resp.TemporalWorkflowID == "" {
		t.Error("expected temporal workflow ID")
	}
}

func TestTransactions(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/transactions", nil)
	w := httptest.NewRecorder()
	handleTransactions(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	if len(items) < 5 {
		t.Fatalf("expected at least 5 seed transactions, got %d", len(items))
	}
}

func TestMilestones(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/milestones?escrowId=ESC-005", nil)
	w := httptest.NewRecorder()
	handleMilestones(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	if len(items) < 5 {
		t.Fatalf("expected at least 5 milestones for ESC-005, got %d", len(items))
	}
}

func TestDisputes(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/disputes", nil)
	w := httptest.NewRecorder()
	handleDisputes(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	if len(items) < 2 {
		t.Fatalf("expected at least 2 seed disputes, got %d", len(items))
	}
}

func TestDocuments(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/documents?escrowId=ESC-001", nil)
	w := httptest.NewRecorder()
	handleDocuments(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	if len(items) < 2 {
		t.Fatalf("expected at least 2 documents for ESC-001, got %d", len(items))
	}
}

func TestFees(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/fees", nil)
	w := httptest.NewRecorder()
	handleFees(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if _, ok := resp["feeSchedule"]; !ok {
		t.Error("expected feeSchedule in response")
	}
	items := resp["items"].([]interface{})
	if len(items) < 5 {
		t.Fatalf("expected at least 5 fee records, got %d", len(items))
	}
}

func TestInterestAccruals(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/interest", nil)
	w := httptest.NewRecorder()
	handleInterestAccruals(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	if len(items) < 3 {
		t.Fatalf("expected at least 3 interest accrual records, got %d", len(items))
	}
}

func TestRegulatoryReports(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/regulatory", nil)
	w := httptest.NewRecorder()
	handleRegulatoryReports(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	if len(items) < 2 {
		t.Fatalf("expected at least 2 regulatory reports, got %d", len(items))
	}
}

func TestGenerateRegulatoryReport(t *testing.T) {
	req := httptest.NewRequest("POST", "/v1/escrow/regulatory", nil)
	w := httptest.NewRecorder()
	handleRegulatoryReports(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["status"] != "draft" {
		t.Errorf("expected status draft, got %v", resp["status"])
	}
	if resp["totalAccounts"] == nil {
		t.Error("expected totalAccounts in report")
	}
}

func TestNotifications(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/notifications", nil)
	w := httptest.NewRecorder()
	handleNotifications(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	if len(items) < 5 {
		t.Fatalf("expected at least 5 notifications, got %d", len(items))
	}
}

func TestFXRates(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/fx-rates", nil)
	w := httptest.NewRecorder()
	handleFXRates(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	rates := resp["rates"].(map[string]interface{})
	if rates["NGN"] == nil || rates["USD"] == nil {
		t.Error("expected NGN and USD rates")
	}
}

func TestAuditLog(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/audit", nil)
	w := httptest.NewRecorder()
	handleAuditLog(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	items := resp["items"].([]interface{})
	if len(items) < 10 {
		t.Fatalf("expected at least 10 audit log entries, got %d", len(items))
	}
}

func TestEscrowStats(t *testing.T) {
	req := httptest.NewRequest("GET", "/v1/escrow/stats", nil)
	w := httptest.NewRecorder()
	handleStats(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	required := []string{"totalAccounts", "totalTransactions", "totalDisputes", "totalMilestones",
		"totalDocuments", "totalFeeRecords", "totalInterestAccruals", "totalParties",
		"totalNotifications", "totalAuditEntries", "totalRegulatoryReports",
		"totalHeldValueNGN", "totalReleasedValueNGN", "totalDisputedValueNGN",
		"totalInterestAccrued", "totalFeesCharged", "byType", "byStatus", "byCurrency",
		"fxRates", "supportedTypes", "supportedCurrencies"}
	for _, key := range required {
		if _, ok := resp[key]; !ok {
			t.Errorf("expected %s in stats", key)
		}
	}
}
