package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// mockPermify starts a test server that always returns the given `can` value.
func mockPermify(t *testing.T, can string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"can": can})
	}))
	t.Cleanup(func() { srv.Close() })
	permifyURL = srv.URL
	return srv
}

func post(t *testing.T, handler http.HandlerFunc, path string, body interface{}, tenantID string) *httptest.ResponseRecorder {
	t.Helper()
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if tenantID != "" {
		req.Header.Set("x-tenant-id", tenantID)
	}
	w := httptest.NewRecorder()
	handler(w, req)
	return w
}

// ---------------------------------------------------------------------------
// /healthz
// ---------------------------------------------------------------------------

func TestHealthz(t *testing.T) {
	mockPermify(t, "CHECK_RESULT_ALLOWED")
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	w := httptest.NewRecorder()
	healthz(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["status"] != "healthy" {
		t.Errorf("expected status=healthy, got %v", resp["status"])
	}
}

// ---------------------------------------------------------------------------
// /v1/authz/check — Permify delegation
// ---------------------------------------------------------------------------

func TestCheck_AllowedByPermify(t *testing.T) {
	mockPermify(t, "CHECK_RESULT_ALLOWED")
	w := post(t, handleCheck, "/v1/authz/check", CheckRequest{
		Subject: "user:alice", Entity: "tenants", Action: "view_all_data",
	}, "tenant-001")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var res CheckResult
	json.NewDecoder(w.Body).Decode(&res)
	if !res.Allowed {
		t.Errorf("expected allowed=true, got false; reason: %s", res.Reason)
	}
}

func TestCheck_DeniedByPermify(t *testing.T) {
	mockPermify(t, "CHECK_RESULT_DENIED")
	w := post(t, handleCheck, "/v1/authz/check", CheckRequest{
		Subject: "user:bob", Entity: "tenants", Action: "emergency_override",
	}, "tenant-001")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var res CheckResult
	json.NewDecoder(w.Body).Decode(&res)
	if res.Allowed {
		t.Error("expected allowed=false")
	}
}

func TestCheck_MissingFields(t *testing.T) {
	w := post(t, handleCheck, "/v1/authz/check", CheckRequest{Subject: "user:x"}, "")
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestCheck_MethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/authz/check", nil)
	w := httptest.NewRecorder()
	handleCheck(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// Static deny policies
// ---------------------------------------------------------------------------

func TestStaticPolicy_DualControl(t *testing.T) {
	// Permify would allow, but static policy should deny same-user approval.
	mockPermify(t, "CHECK_RESULT_ALLOWED")
	w := post(t, handleCheck, "/v1/authz/check", CheckRequest{
		Subject: "user:alice", Entity: "transaction", Action: "approve",
		Context: map[string]string{"initiator": "alice", "approver": "alice"},
	}, "tenant-001")
	var res CheckResult
	json.NewDecoder(w.Body).Decode(&res)
	if res.Allowed {
		t.Error("dual-control policy should deny self-approval")
	}
	if res.Policy != "dual-control-approval" {
		t.Errorf("expected matchedPolicy=dual-control-approval, got %q", res.Policy)
	}
}

func TestStaticPolicy_HighValue_Teller(t *testing.T) {
	mockPermify(t, "CHECK_RESULT_ALLOWED")
	w := post(t, handleCheck, "/v1/authz/check", CheckRequest{
		Subject: "user:teller1", Entity: "transaction", Action: "create",
		Context: map[string]string{"role": "teller", "amount": "15000000"},
	}, "tenant-001")
	var res CheckResult
	json.NewDecoder(w.Body).Decode(&res)
	if res.Allowed {
		t.Error("high-value-restriction should deny teller creating >₦10M transaction")
	}
}

func TestStaticPolicy_HighValue_BranchManager_Allowed(t *testing.T) {
	mockPermify(t, "CHECK_RESULT_ALLOWED")
	// branch_manager is not in the deny condition so static layer passes through to Permify.
	w := post(t, handleCheck, "/v1/authz/check", CheckRequest{
		Subject: "user:mgr1", Entity: "transaction", Action: "create",
		Context: map[string]string{"role": "branch_manager", "amount": "15000000"},
	}, "tenant-001")
	var res CheckResult
	json.NewDecoder(w.Body).Decode(&res)
	if !res.Allowed {
		t.Error("branch_manager should not be blocked by high-value-restriction")
	}
}

func TestStaticPolicy_KYC(t *testing.T) {
	mockPermify(t, "CHECK_RESULT_ALLOWED")
	w := post(t, handleCheck, "/v1/authz/check", CheckRequest{
		Subject: "user:cust1", Entity: "transfer", Action: "create",
		Context: map[string]string{"amount": "60000", "kyc_level": "1"},
	}, "tenant-001")
	var res CheckResult
	json.NewDecoder(w.Body).Decode(&res)
	if res.Allowed {
		t.Error("kyc-level-restriction should deny transfer >₦50K at KYC level 1")
	}
}

// ---------------------------------------------------------------------------
// /v1/authz/check-batch
// ---------------------------------------------------------------------------

func TestCheckBatch_Mixed(t *testing.T) {
	// Permify allows everything; static policy will deny the dual-control check.
	mockPermify(t, "CHECK_RESULT_ALLOWED")
	req := BatchCheckRequest{
		UserID:   "alice",
		TenantID: "tenant-001",
		Checks: []BatchCheckItem{
			{Entity: "tenants", Action: "view_all_data"},
			{Entity: "transaction", Action: "approve",
				Context: map[string]string{"initiator": "alice", "approver": "alice"}},
		},
	}
	w := post(t, handleCheckBatch, "/v1/authz/check-batch", req, "tenant-001")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	results, ok := resp["results"].([]interface{})
	if !ok || len(results) != 2 {
		t.Fatalf("expected 2 results, got %v", resp["results"])
	}
}

func TestCheckBatch_MissingUserID(t *testing.T) {
	w := post(t, handleCheckBatch, "/v1/authz/check-batch", BatchCheckRequest{}, "")
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// ---------------------------------------------------------------------------
// /v1/authz/policies and /v1/authz/stats
// ---------------------------------------------------------------------------

func TestPolicies(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/authz/policies", nil)
	w := httptest.NewRecorder()
	handlePolicies(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if total, _ := resp["total"].(float64); total != float64(len(staticPolicies)) {
		t.Errorf("expected %d policies, got %v", len(staticPolicies), resp["total"])
	}
}

func TestStats(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/authz/stats", nil)
	w := httptest.NewRecorder()
	handleStats(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if _, ok := resp["checksPerformed"]; !ok {
		t.Error("missing checksPerformed in stats")
	}
}

// ---------------------------------------------------------------------------
// numericMatch helper
// ---------------------------------------------------------------------------

func TestNumericMatch(t *testing.T) {
	cases := []struct {
		cond, val string
		want      bool
	}{
		{">10000000", "15000000", true},
		{">10000000", "5000000", false},
		{"<2", "1", true},
		{"<2", "3", false},
		{">50000", "60000", true},
		{">50000", "40000", false},
	}
	for _, c := range cases {
		if got := numericMatch(c.cond, c.val); got != c.want {
			t.Errorf("numericMatch(%q, %q) = %v, want %v", c.cond, c.val, got, c.want)
		}
	}
}
