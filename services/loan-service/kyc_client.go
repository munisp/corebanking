package main

// LN-01 (L1): server-side sourcing of KYC/credit attributes for loan
// underwriting. BVN/NIN verification status comes from
// bvn-nin-verification-go (BVN_NIN_URL); the credit score comes from
// credit-service (CREDIT_SERVICE_URL). Both are fail-closed: any transport
// or provider error makes the caller reject the application with 503.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"time"
)

var kycHTTPClient = &http.Client{Timeout: 8 * time.Second}

// fetchApplicantVerification verifies the applicant's BVN/NIN with the
// verification service. When the applicant supplied no BVN/NIN numbers the
// flags are honestly false (evaluation will decline on identity
// incompleteness). Provider errors are fatal to the request (fail-closed).
func fetchApplicantVerification(tenantID, applicantID, bvn, nin string) (bool, bool, error) {
	base := os.Getenv("BVN_NIN_URL")
	if base == "" {
		base = "http://bvn-nin-verification-go:8080"
	}

	verify := func(path, idKey, idValue string) (bool, error) {
		if idValue == "" {
			return false, nil // not supplied → honestly unverified
		}
		payload, _ := json.Marshal(map[string]string{idKey: idValue, "customerId": applicantID})
		req, err := http.NewRequest("POST", base+path, bytes.NewReader(payload))
		if err != nil {
			return false, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Tenant-ID", tenantID)

		resp, err := kycHTTPClient.Do(req)
		if err != nil {
			return false, fmt.Errorf("verification provider unreachable: %w", err)
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusBadRequest {
			return false, nil // provider says not found / invalid → honestly unverified
		}
		if resp.StatusCode != http.StatusOK {
			return false, fmt.Errorf("verification provider error: status %d: %s", resp.StatusCode, string(body))
		}
		var result struct {
			Verified bool `json:"verified"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			return false, fmt.Errorf("verification provider returned undecodable response: %w", err)
		}
		return result.Verified, nil
	}

	bvnVerified, err := verify("/api/bvn/verify", "bvn", bvn)
	if err != nil {
		return false, false, err
	}
	ninVerified, err := verify("/api/nin/verify", "nin", nin)
	if err != nil {
		return false, false, err
	}
	return bvnVerified, ninVerified, nil
}

// fetchApplicantCreditScore obtains a risk assessment from credit-service
// (POST /v1/risk/score, the one real internal scoring engine) and maps the
// returned probability-of-default onto the 300–850 score scale consumed by
// the credit decision engine: score = 850 − PD×550, clamped to [300, 850].
// Fail-closed: provider errors are fatal to the request.
func fetchApplicantCreditScore(tenantID string, app *LoanApplication) (int, error) {
	base := os.Getenv("CREDIT_SERVICE_URL")
	if base == "" {
		base = "http://credit-service:8080"
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"entity_id":        app.ApplicantID,
		"entity_name":      app.ApplicantID,
		"exposure":         app.LoanAmount,
		"collateral_value": app.CollateralValue,
		"annual_revenue":   app.MonthlyIncome * 12,
	})
	req, err := http.NewRequest("POST", base+"/v1/risk/score", bytes.NewReader(payload))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", tenantID)

	resp, err := kycHTTPClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("credit service unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("credit service error: status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		PD float64 `json:"pd"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return 0, fmt.Errorf("credit service returned undecodable response: %w", err)
	}

	score := int(math.Round(850 - result.PD*550))
	if score < 300 {
		score = 300
	}
	if score > 850 {
		score = 850
	}
	return score, nil
}
