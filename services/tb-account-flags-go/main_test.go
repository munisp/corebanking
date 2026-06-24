package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"tbclient"
)

func setupTest() {
	db = nil
	flagsCache = make(map[string][]AccountFlag)
	// Initialize tbClient for TB integration testing
	cfg := tbclient.DefaultConfig()
	tbClient, _ = tbclient.NewClient(cfg)
}

func TestSetFlagValidation(t *testing.T) {
	setupTest()
	tests := []struct {
		name     string
		body     string
		wantCode int
	}{
		{"invalid json", `{bad`, 400},
		{"unknown flag", `{"account_id":"A","flag_name":"nonexistent","reason":"test","set_by":"admin"}`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/v1/flags/set", bytes.NewBufferString(tt.body))
			w := httptest.NewRecorder()
			setFlagHandler(w, req)
			if w.Code != tt.wantCode {
				t.Errorf("expected %d, got %d: %s", tt.wantCode, w.Code, w.Body.String())
			}
		})
	}
}

func TestSetFlagSuccess(t *testing.T) {
	setupTest()
	body := `{"account_id":"ACCT-001","flag_name":"debits_must_not_exceed_credits","reason":"liability account","set_by":"treasury"}`
	req := httptest.NewRequest("POST", "/v1/flags/set", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	setFlagHandler(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	flag := resp["flag"].(map[string]interface{})
	if flag["account_id"] != "ACCT-001" {
		t.Fatalf("expected account_id ACCT-001, got %v", flag["account_id"])
	}
	if flag["flag_name"] != "debits_must_not_exceed_credits" {
		t.Fatalf("expected flag_name, got %v", flag["flag_name"])
	}
	// Verify TB flag value matches
	tbFlags := resp["tb_account_flags"].(float64)
	if uint32(tbFlags) != FlagDebitsMustNotExceedCredits {
		t.Fatalf("expected TB flag %d, got %v", FlagDebitsMustNotExceedCredits, tbFlags)
	}
}

func TestSetFlagWithTBClient(t *testing.T) {
	setupTest()
	body := `{"account_id":"ACCT-TB","flag_name":"history","reason":"audit","set_by":"compliance"}`
	req := httptest.NewRequest("POST", "/v1/flags/set", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	setFlagHandler(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	// Verify tbClient was called (AccountsCreated should increment)
	if tbClient.AccountsCreated.Load() < 1 {
		t.Fatal("expected tbClient.AccountsCreated >= 1")
	}
}

func TestGetFlags(t *testing.T) {
	setupTest()
	// Set a flag first
	body := `{"account_id":"ACCT-GET","flag_name":"closed","reason":"fraud","set_by":"security"}`
	req := httptest.NewRequest("POST", "/v1/flags/set", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	setFlagHandler(w, req)

	// Get flags for account
	req2 := httptest.NewRequest("GET", "/v1/flags?account_id=ACCT-GET", nil)
	w2 := httptest.NewRecorder()
	getFlagsHandler(w2, req2)
	if w2.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", w2.Code, w2.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w2.Body.Bytes(), &resp)
	flags, ok := resp["flags"].([]interface{})
	if !ok || len(flags) < 1 {
		t.Fatal("expected at least 1 flag in response")
	}
}

func TestValidateFlagNames(t *testing.T) {
	setupTest()
	validFlags := []string{"debits_must_not_exceed_credits", "credits_must_not_exceed_debits", "history", "closed"}
	for _, fn := range validFlags {
		t.Run(fn, func(t *testing.T) {
			body, _ := json.Marshal(map[string]interface{}{
				"account_id": "ACCT-VAL", "flag_name": fn,
				"reason": "test", "set_by": "admin",
			})
			req := httptest.NewRequest("POST", "/v1/flags/set", bytes.NewReader(body))
			w := httptest.NewRecorder()
			setFlagHandler(w, req)
			if w.Code != 200 {
				t.Errorf("flag %s: expected 200, got %d", fn, w.Code)
			}
		})
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
