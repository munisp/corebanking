package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"
)

// C3-P0-B1: pending transfers are REAL TigerBeetle PENDING transfers; the
// in-memory pendingTxns map and sweepResults slice are gone. Without a
// reachable cluster (tbClient == nil) and PG projection (db == nil) every
// mutation/read endpoint must FAIL CLOSED (503) — these tests pin that
// contract plus the pure validation/determinism helpers that need no store.
// Integration behavior against a live cluster + PG is covered by the manual
// verify script (docker compose up; register → restart → status must agree).

func setupSweeperTest() {
	db = nil
	tbClient = nil
}

func TestRegisterValidation(t *testing.T) {
	setupSweeperTest()
	// Malformed JSON.
	req := httptest.NewRequest("POST", "/v1/tb-sweeper/register", bytes.NewBufferString("{not-json"))
	w := httptest.NewRecorder()
	registerPendingHandler(w, req)
	if w.Code != 400 {
		t.Fatalf("expected 400 for malformed body, got %d", w.Code)
	}
	// Missing required fields.
	req = httptest.NewRequest("POST", "/v1/tb-sweeper/register", bytes.NewBufferString(`{"transfer_id":"TXN-001"}`))
	w = httptest.NewRecorder()
	registerPendingHandler(w, req)
	if w.Code != 400 {
		t.Fatalf("expected 400 for missing fields, got %d", w.Code)
	}
	// Non-positive amount.
	req = httptest.NewRequest("POST", "/v1/tb-sweeper/register", bytes.NewBufferString(`{"transfer_id":"TXN-001","debit_account_id":"A","credit_account_id":"B","amount_kobo":0}`))
	w = httptest.NewRecorder()
	registerPendingHandler(w, req)
	if w.Code != 400 {
		t.Fatalf("expected 400 for non-positive amount, got %d", w.Code)
	}
}

func TestRegisterFailClosed(t *testing.T) {
	setupSweeperTest()
	body := `{"transfer_id":"TXN-001","debit_account_id":"A","credit_account_id":"B","amount_kobo":100000,"timeout_secs":60}`
	req := httptest.NewRequest("POST", "/v1/tb-sweeper/register", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	registerPendingHandler(w, req)
	if w.Code != 503 {
		t.Fatalf("expected 503 fail-closed without TB/PG, got %d: %s", w.Code, w.Body.String())
	}
}

func TestResolveValidationAndFailClosed(t *testing.T) {
	setupSweeperTest()
	// Invalid action rejected before any store access.
	req := httptest.NewRequest("POST", "/v1/tb-sweeper/resolve", bytes.NewBufferString(`{"transfer_id":"X","action":"explode"}`))
	w := httptest.NewRecorder()
	resolvePendingHandler(w, req)
	if w.Code != 400 {
		t.Fatalf("expected 400 for invalid action, got %d", w.Code)
	}
	// Fail-closed without stores.
	req = httptest.NewRequest("POST", "/v1/tb-sweeper/resolve", bytes.NewBufferString(`{"transfer_id":"X","action":"post"}`))
	w = httptest.NewRecorder()
	resolvePendingHandler(w, req)
	if w.Code != 503 {
		t.Fatalf("expected 503 fail-closed without TB/PG, got %d", w.Code)
	}
}

func TestSweepWithoutStoresIsNoop(t *testing.T) {
	setupSweeperTest()
	if n := sweepExpired(); n != 0 {
		t.Fatalf("expected 0 swept without stores, got %d", n)
	}
}

func TestStatusFailClosed(t *testing.T) {
	setupSweeperTest()
	req := httptest.NewRequest("GET", "/v1/tb-sweeper/status", nil)
	w := httptest.NewRecorder()
	statusHandler(w, req)
	if w.Code != 503 {
		t.Fatalf("expected 503 fail-closed without PG, got %d", w.Code)
	}
}

func TestDetIDDeterministic(t *testing.T) {
	a1 := detID("tb-pending-sweeper-go/pending/TXN-1")
	a2 := detID("tb-pending-sweeper-go/pending/TXN-1")
	b := detID("tb-pending-sweeper-go/pending/TXN-2")
	if a1 != a2 {
		t.Fatal("detID not deterministic")
	}
	if a1 == b {
		t.Fatal("detID collision for distinct keys")
	}
	if pendingTBID("TXN-1") == platformAccountTBID("TXN-1") {
		t.Fatal("namespaces must not collide")
	}
}

func TestHealthEndpoint(t *testing.T) {
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	healthHandler(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("health response not JSON: %v", err)
	}
}
