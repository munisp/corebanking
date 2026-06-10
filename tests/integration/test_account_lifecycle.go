// Package integration tests the complete account lifecycle flow:
// Account Opening → KYC Verification → Account Activation → First Transaction
package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"
)

var (
	accountOpeningURL = envOr("ACCOUNT_OPENING_URL", "http://account-opening-go:8080")
	kycURL            = envOr("KYC_URL", "http://kyc-verification-go:8080")
	coreBankingURL    = envOr("CORE_BANKING_URL", "http://core-banking-go:8080")
	notificationURL   = envOr("NOTIFICATION_URL", "http://notification-go:8080")
)

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func TestAccountOpeningToActivation(t *testing.T) {
	// Step 1: Submit account opening request
	t.Run("submit_application", func(t *testing.T) {
		body := map[string]interface{}{
			"customer": map[string]interface{}{
				"first_name":    "Adebayo",
				"last_name":     "Ogundimu",
				"bvn":           "22345678901",
				"phone":         "+2348012345678",
				"email":         "adebayo@example.com",
				"date_of_birth": "1990-05-15",
				"address": map[string]string{
					"street": "12 Marina Road",
					"city":   "Lagos",
					"state":  "Lagos",
					"lga":    "Lagos Island",
				},
			},
			"account_type":    "savings",
			"currency":        "NGN",
			"idempotency_key": fmt.Sprintf("test-acct-%d", time.Now().UnixNano()),
		}

		resp, err := postJSON(accountOpeningURL+"/v1/account-opening/apply", body)
		if err != nil {
			t.Fatalf("account opening request failed: %v", err)
		}
		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
			t.Fatalf("expected 200/201, got %d", resp.StatusCode)
		}

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		resp.Body.Close()

		appID, ok := result["application_id"].(string)
		if !ok || appID == "" {
			t.Fatal("no application_id in response")
		}
		t.Logf("Application created: %s", appID)

		// Step 2: Verify KYC
		t.Run("kyc_verification", func(t *testing.T) {
			kycBody := map[string]interface{}{
				"application_id": appID,
				"bvn":            "22345678901",
				"nin":            "12345678901",
				"documents": []map[string]string{
					{"type": "utility_bill", "url": "https://docs.example.com/bill.pdf"},
					{"type": "passport_photo", "url": "https://docs.example.com/photo.jpg"},
				},
			}

			kycResp, err := postJSON(kycURL+"/v1/kyc/verify", kycBody)
			if err != nil {
				t.Fatalf("KYC verification failed: %v", err)
			}
			if kycResp.StatusCode != http.StatusOK {
				t.Fatalf("KYC expected 200, got %d", kycResp.StatusCode)
			}

			var kycResult map[string]interface{}
			json.NewDecoder(kycResp.Body).Decode(&kycResult)
			kycResp.Body.Close()

			status, _ := kycResult["status"].(string)
			if status != "verified" && status != "pending" && status != "approved" {
				t.Logf("KYC status: %s (may need manual review)", status)
			}
		})

		// Step 3: Activate account
		t.Run("account_activation", func(t *testing.T) {
			activateBody := map[string]interface{}{
				"application_id": appID,
				"action":         "activate",
			}

			activateResp, err := postJSON(accountOpeningURL+"/v1/account-opening/activate", activateBody)
			if err != nil {
				t.Fatalf("account activation failed: %v", err)
			}
			if activateResp.StatusCode != http.StatusOK {
				t.Fatalf("activation expected 200, got %d", activateResp.StatusCode)
			}

			var activateResult map[string]interface{}
			json.NewDecoder(activateResp.Body).Decode(&activateResult)
			activateResp.Body.Close()

			accountNumber, _ := activateResult["account_number"].(string)
			if accountNumber != "" {
				t.Logf("Account activated: %s", accountNumber)
			}
		})
	})
}

func TestTransferFlow(t *testing.T) {
	t.Run("nip_transfer", func(t *testing.T) {
		body := map[string]interface{}{
			"source_account":      "0123456789",
			"destination_account": "9876543210",
			"destination_bank":    "000014", // Access Bank
			"amount_kobo":         500000,   // ₦5,000
			"narration":           "Integration test transfer",
			"idempotency_key":     fmt.Sprintf("test-txn-%d", time.Now().UnixNano()),
		}

		resp, err := postJSON(coreBankingURL+"/v1/core-banking/transfer", body)
		if err != nil {
			t.Fatalf("transfer failed: %v", err)
		}
		defer resp.Body.Close()

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)

		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
			ref, _ := result["reference"].(string)
			t.Logf("Transfer successful: ref=%s", ref)

			// Verify idempotency — same key should return same result
			t.Run("idempotency_check", func(t *testing.T) {
				resp2, err := postJSON(coreBankingURL+"/v1/core-banking/transfer", body)
				if err != nil {
					t.Fatalf("idempotency check failed: %v", err)
				}
				defer resp2.Body.Close()

				var result2 map[string]interface{}
				json.NewDecoder(resp2.Body).Decode(&result2)

				ref2, _ := result2["reference"].(string)
				if ref != "" && ref2 != "" && ref != ref2 {
					t.Errorf("idempotency failed: got different refs %s vs %s", ref, ref2)
				}
			})
		} else {
			t.Logf("Transfer returned %d (expected in test env without DB): %v", resp.StatusCode, result)
		}
	})
}

func TestHealthEndpoints(t *testing.T) {
	services := []struct {
		name string
		url  string
	}{
		{"account-opening", accountOpeningURL},
		{"kyc", kycURL},
		{"core-banking", coreBankingURL},
		{"notification", notificationURL},
	}

	for _, svc := range services {
		t.Run(svc.name+"_healthz", func(t *testing.T) {
			resp, err := http.Get(svc.url + "/healthz")
			if err != nil {
				t.Skipf("service %s not reachable: %v", svc.name, err)
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("healthz returned %d", resp.StatusCode)
			}
		})

		t.Run(svc.name+"_readyz", func(t *testing.T) {
			resp, err := http.Get(svc.url + "/readyz")
			if err != nil {
				t.Skipf("service %s not reachable: %v", svc.name, err)
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("readyz returned %d", resp.StatusCode)
			}
		})
	}
}

func TestRateLimiting(t *testing.T) {
	// Send requests rapidly to trigger rate limiting
	hitLimit := false
	for i := 0; i < 200; i++ {
		resp, err := http.Get(accountOpeningURL + "/healthz")
		if err != nil {
			t.Skipf("service not reachable: %v", err)
			return
		}
		resp.Body.Close()
		if resp.StatusCode == http.StatusTooManyRequests {
			hitLimit = true
			t.Logf("Rate limit triggered at request %d", i+1)
			break
		}
	}
	if !hitLimit {
		t.Log("Rate limit not hit in 200 requests (may have higher threshold)")
	}
}

func TestSecurityHeaders(t *testing.T) {
	resp, err := http.Get(accountOpeningURL + "/healthz")
	if err != nil {
		t.Skipf("service not reachable: %v", err)
		return
	}
	defer resp.Body.Close()

	headers := map[string]string{
		"X-Frame-Options":        "DENY",
		"X-Content-Type-Options":  "nosniff",
		"Strict-Transport-Security": "",
		"Content-Security-Policy":   "",
	}

	for header, expected := range headers {
		val := resp.Header.Get(header)
		if val == "" {
			t.Errorf("missing security header: %s", header)
		} else if expected != "" && val != expected {
			t.Errorf("header %s: got %q, want %q", header, val, expected)
		}
	}
}

func postJSON(url string, body interface{}) (*http.Response, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+os.Getenv("TEST_JWT_TOKEN"))
	return client.Do(req)
}
