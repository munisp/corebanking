package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"tbclient"
)

func setupSweeperTest() {
	db = nil
	pendingTxns = make(map[string]*PendingTransfer)
	cfg := tbclient.DefaultConfig()
	tbClient, _ = tbclient.NewClient(cfg)
}

func TestRegisterPending(t *testing.T) {
	setupSweeperTest()
	body := `{"transfer_id":"TXN-001","debit_account_id":"A","credit_account_id":"B","amount_kobo":100000,"timeout_secs":60}`
	req := httptest.NewRequest("POST", "/v1/pending/register", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	registerPendingHandler(w, req)
	if w.Code != 201 {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	transfer := resp["transfer"].(map[string]interface{})
	if transfer["status"] != "pending" {
		t.Fatalf("expected status=pending, got %v", transfer["status"])
	}
	if len(pendingTxns) != 1 {
		t.Fatalf("expected 1 pending txn, got %d", len(pendingTxns))
	}
}

func TestRegisterDefaultTimeout(t *testing.T) {
	setupSweeperTest()
	body := `{"transfer_id":"TXN-002","debit_account_id":"A","credit_account_id":"B","amount_kobo":50000}`
	req := httptest.NewRequest("POST", "/v1/pending/register", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	registerPendingHandler(w, req)
	if w.Code != 201 {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	timeout := resp["timeout_secs"].(float64)
	if int(timeout) != 300 {
		t.Fatalf("expected default timeout 300, got %v", timeout)
	}
}

func TestResolvePost(t *testing.T) {
	setupSweeperTest()
	// Register first
	body := `{"transfer_id":"TXN-R1","debit_account_id":"A","credit_account_id":"B","amount_kobo":75000,"timeout_secs":60}`
	req := httptest.NewRequest("POST", "/v1/pending/register", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	registerPendingHandler(w, req)

	// Resolve as posted
	body2 := `{"transfer_id":"TXN-R1","action":"post"}`
	req2 := httptest.NewRequest("POST", "/v1/pending/resolve", bytes.NewBufferString(body2))
	w2 := httptest.NewRecorder()
	resolvePendingHandler(w2, req2)
	if w2.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", w2.Code, w2.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w2.Body.Bytes(), &resp)
	if resp["status"] != "posted" {
		t.Fatalf("expected status=posted, got %v", resp["status"])
	}
}

func TestResolveVoid(t *testing.T) {
	setupSweeperTest()
	body := `{"transfer_id":"TXN-V1","debit_account_id":"A","credit_account_id":"B","amount_kobo":30000,"timeout_secs":60}`
	req := httptest.NewRequest("POST", "/v1/pending/register", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	registerPendingHandler(w, req)

	body2 := `{"transfer_id":"TXN-V1","action":"void"}`
	req2 := httptest.NewRequest("POST", "/v1/pending/resolve", bytes.NewBufferString(body2))
	w2 := httptest.NewRecorder()
	resolvePendingHandler(w2, req2)
	if w2.Code != 200 {
		t.Fatalf("expected 200, got %d", w2.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w2.Body.Bytes(), &resp)
	if resp["status"] != "voided" {
		t.Fatalf("expected status=voided, got %v", resp["status"])
	}
}

func TestResolveNotFound(t *testing.T) {
	setupSweeperTest()
	body := `{"transfer_id":"NONEXISTENT","action":"post"}`
	req := httptest.NewRequest("POST", "/v1/pending/resolve", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	resolvePendingHandler(w, req)
	if w.Code != 404 {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestResolveAlreadyResolved(t *testing.T) {
	setupSweeperTest()
	body := `{"transfer_id":"TXN-DOUBLE","debit_account_id":"A","credit_account_id":"B","amount_kobo":10000,"timeout_secs":60}`
	req := httptest.NewRequest("POST", "/v1/pending/register", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	registerPendingHandler(w, req)

	// Post first
	body2 := `{"transfer_id":"TXN-DOUBLE","action":"post"}`
	req2 := httptest.NewRequest("POST", "/v1/pending/resolve", bytes.NewBufferString(body2))
	w2 := httptest.NewRecorder()
	resolvePendingHandler(w2, req2)

	// Try to void same (should fail with 409)
	body3 := `{"transfer_id":"TXN-DOUBLE","action":"void"}`
	req3 := httptest.NewRequest("POST", "/v1/pending/resolve", bytes.NewBufferString(body3))
	w3 := httptest.NewRecorder()
	resolvePendingHandler(w3, req3)
	if w3.Code != 409 {
		t.Fatalf("expected 409, got %d", w3.Code)
	}
}

func TestSweepExpired(t *testing.T) {
	setupSweeperTest()
	// Register a transfer with 0 timeout (immediately expired)
	pendingTxns["TXN-EXPIRE"] = &PendingTransfer{
		TransferID:  "TXN-EXPIRE",
		DebitAcct:   "A",
		CreditAcct:  "B",
		AmountKobo:  5000,
		CreatedAt:   time.Now().Add(-10 * time.Minute),
		TimeoutSecs: 1,
		Status:      "pending",
	}
	count := sweepExpired()
	if count != 1 {
		t.Fatalf("expected 1 expired, got %d", count)
	}
	if pendingTxns["TXN-EXPIRE"].Status != "expired" {
		t.Fatalf("expected status=expired, got %s", pendingTxns["TXN-EXPIRE"].Status)
	}
}

func TestStatusEndpoint(t *testing.T) {
	setupSweeperTest()
	req := httptest.NewRequest("GET", "/v1/pending/status", nil)
	w := httptest.NewRecorder()
	statusHandler(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	if _, ok := resp["pending"]; !ok {
		t.Fatal("expected 'pending' count in response")
	}
	if _, ok := resp["sweep_interval_secs"]; !ok {
		t.Fatal("expected 'sweep_interval_secs' in response")
	}
}

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthHandler(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
