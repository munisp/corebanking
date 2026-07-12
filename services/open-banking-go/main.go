package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type Consent struct {
	ID             string   `json:"id"`
	CustomerID     string   `json:"customerId"`
	CustomerName   string   `json:"customerName"`
	TPPID          string   `json:"tppId"`
	TPPName        string   `json:"tppName"`
	ConsentType    string   `json:"consentType"` // ais, pis, cbpii (confirmation of funds)
	Permissions    []string `json:"permissions"`
	Status         string   `json:"status"` // awaiting_authorization, authorized, rejected, revoked, expired
	CreatedAt      string   `json:"createdAt"`
	ExpiresAt      string   `json:"expiresAt"`
	LastAccessedAt string   `json:"lastAccessedAt,omitempty"`
	AccessCount    int      `json:"accessCount"`
	Accounts       []string `json:"accounts"`
}

type TPP struct {
	ID            string   `json:"id"`
	Name          string   `json:"tppName"`
	RegistrationNo string  `json:"registrationNo"`
	Role          string   `json:"role"` // aisp, pisp, cbpii, aspsp
	Status        string   `json:"status"`
	CertIssuer    string   `json:"certIssuer"`
	CertExpiry    string   `json:"certExpiry"`
	RedirectURIs  []string `json:"redirectUris"`
	ContactEmail  string   `json:"contactEmail"`
	APIVersions   []string `json:"apiVersions"`
	ConsentCount  int      `json:"consentCount"`
}

type APIEndpoint struct {
	ID          string `json:"id"`
	Path        string `json:"path"`
	Method      string `json:"method"`
	Category    string `json:"category"` // accounts, payments, funds, events
	Version     string `json:"version"`
	Description string `json:"description"`
	RateLimit   int    `json:"rateLimit"`
	AuthType    string `json:"authType"`
}

type ConsentRequest struct {
	CustomerID  string   `json:"customerId"`
	TPPID       string   `json:"tppId"`
	ConsentType string   `json:"consentType"`
	Permissions []string `json:"permissions"`
	Accounts    []string `json:"accounts"`
}

var (
	consents  []Consent
	tpps      []TPP
	endpoints []APIEndpoint
	mu        sync.Mutex
)

func init() {
	tpps = []TPP{
		{"TPP-001", "Paystack (Stripe)", "CBN/TPP/2025/001", "pisp", "active", "CBN Certificate Authority", "2027-12-31", []string{"https://paystack.com/callback"}, "api@paystack.com", []string{"v3.1", "v3.2"}, 12500},
		{"TPP-002", "Flutterwave", "CBN/TPP/2025/002", "pisp", "active", "CBN Certificate Authority", "2027-06-30", []string{"https://flutterwave.com/callback"}, "api@flutterwave.com", []string{"v3.1"}, 8200},
		{"TPP-003", "Mono (YC)", "CBN/TPP/2025/003", "aisp", "active", "CBN Certificate Authority", "2027-09-30", []string{"https://mono.co/callback"}, "api@mono.co", []string{"v3.1", "v3.2"}, 5600},
		{"TPP-004", "Okra", "CBN/TPP/2025/004", "aisp", "active", "CBN Certificate Authority", "2028-03-31", []string{"https://okra.ng/callback"}, "api@okra.ng", []string{"v3.1"}, 3200},
		{"TPP-005", "Stitch", "CBN/TPP/2025/005", "cbpii", "active", "CBN Certificate Authority", "2027-12-31", []string{"https://stitch.money/callback"}, "api@stitch.money", []string{"v3.1"}, 1500},
		{"TPP-006", "Carbon (Paylater)", "CBN/TPP/2025/006", "pisp", "suspended", "CBN Certificate Authority", "2026-06-30", []string{"https://carbon.ng/callback"}, "api@carbon.ng", []string{"v3.1"}, 450},
	}

	consents = []Consent{
		{"CNS-001", "CUST-001", "Dangote Industries", "TPP-001", "Paystack (Stripe)", "pis", []string{"ReadAccountsBasic", "ReadBalances", "CreatePayment"}, "authorized", "2026-04-01T10:00:00Z", "2026-10-01T10:00:00Z", "2026-05-09T14:30:00Z", 250, []string{"0012345678", "0012345679"}},
		{"CNS-002", "CUST-002", "MTN Nigeria", "TPP-003", "Mono (YC)", "ais", []string{"ReadAccountsDetail", "ReadBalances", "ReadTransactionsDetail", "ReadStatementsBasic"}, "authorized", "2026-03-15T09:00:00Z", "2026-09-15T09:00:00Z", "2026-05-09T16:00:00Z", 1200, []string{"0098765432"}},
		{"CNS-003", "CUST-003", "Access Corp", "TPP-002", "Flutterwave", "pis", []string{"ReadAccountsBasic", "CreatePayment"}, "authorized", "2026-05-01T12:00:00Z", "2026-11-01T12:00:00Z", "2026-05-09T11:00:00Z", 50, []string{"0033344455"}},
		{"CNS-004", "CUST-004", "BUA Cement", "TPP-005", "Stitch", "cbpii", []string{"ReadAccountsBasic", "ReadBalances", "ConfirmFunds"}, "authorized", "2026-04-20T08:00:00Z", "2026-07-20T08:00:00Z", "2026-05-08T09:00:00Z", 80, []string{"0044455566"}},
		{"CNS-005", "CUST-005", "Retail Customer", "TPP-004", "Okra", "ais", []string{"ReadAccountsBasic", "ReadBalances"}, "revoked", "2026-01-10T10:00:00Z", "2026-07-10T10:00:00Z", "2026-03-15T14:00:00Z", 30, []string{"0055566677"}},
		{"CNS-006", "CUST-006", "Shell Nigeria", "TPP-006", "Carbon (Paylater)", "pis", []string{"CreatePayment"}, "rejected", "2026-05-09T10:00:00Z", "2026-11-09T10:00:00Z", "", 0, []string{"0066677788"}},
	}

	endpoints = []APIEndpoint{
		{"API-001", "/open-banking/v3.1/accounts", "GET", "accounts", "v3.1", "Get list of accounts", 1000, "oauth2_ais"},
		{"API-002", "/open-banking/v3.1/accounts/{accountId}", "GET", "accounts", "v3.1", "Get account details", 1000, "oauth2_ais"},
		{"API-003", "/open-banking/v3.1/accounts/{accountId}/balances", "GET", "accounts", "v3.1", "Get account balances", 2000, "oauth2_ais"},
		{"API-004", "/open-banking/v3.1/accounts/{accountId}/transactions", "GET", "accounts", "v3.1", "Get account transactions", 500, "oauth2_ais"},
		{"API-005", "/open-banking/v3.1/accounts/{accountId}/statements", "GET", "accounts", "v3.1", "Get account statements", 200, "oauth2_ais"},
		{"API-006", "/open-banking/v3.1/payments/domestic-payments", "POST", "payments", "v3.1", "Create domestic payment", 500, "oauth2_pis"},
		{"API-007", "/open-banking/v3.1/payments/international-payments", "POST", "payments", "v3.1", "Create international payment", 200, "oauth2_pis"},
		{"API-008", "/open-banking/v3.1/funds-confirmation", "POST", "funds", "v3.1", "Confirm availability of funds", 2000, "oauth2_cbpii"},
		{"API-009", "/open-banking/v3.1/event-subscriptions", "POST", "events", "v3.1", "Subscribe to account events", 100, "oauth2_ais"},
		{"API-010", "/open-banking/v3.1/payments/standing-orders", "POST", "payments", "v3.1", "Create standing order", 200, "oauth2_pis"},
	}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"status": "ok", "service": "open-banking",
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"ob.consent.created", "ob.consent.revoked", "ob.payment.initiated", "ob.account.accessed"}},
				"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"ob:consents", "ob:tpp_certs", "ob:rate_limits", "ob:tokens"}},
				"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"ob_consents", "ob_tpps", "ob_api_endpoints", "ob_access_logs"}},
				"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"ob-access-logs", "ob-consent-audit", "ob-api-metrics"}},
				"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank-openbanking", "client": "open-banking-service"},
				"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"ob_consent", "ob_tpp", "ob_api_access"}},
				"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "open-banking", "pubsub": "ob-events"},
				"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"ob-api-requests-stream", "ob-consent-events-stream"}},
				"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"ConsentAuthorization", "PaymentInitiation", "TPPCertRenewal", "ConsentExpiry"}},
				"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "open-banking-payment-routing"},
				"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"ob_payment_initiation", "ob_funds_confirmation"}},
				"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"ob_api_usage_history", "ob_consent_history", "ob_tpp_analytics"}},
				"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/open-banking/*"}},
				"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "ob-waf-rules"},
			},
		})
	})

	mux.HandleFunc("/v1/open-banking/consents", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			mu.Lock()
			respondJSON(w, 200, map[string]interface{}{"items": consents, "total": len(consents)})
			mu.Unlock()
			return
		}
		if r.Method == http.MethodPost {
			var req ConsentRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, 400, map[string]string{"error": "invalid JSON"})
				return
			}
			if req.ConsentType != "ais" && req.ConsentType != "pis" && req.ConsentType != "cbpii" {
				respondJSON(w, 400, map[string]string{"error": "consentType must be ais, pis, or cbpii"})
				return
			}
			if len(req.Permissions) == 0 {
				respondJSON(w, 400, map[string]string{"error": "at least one permission required"})
				return
			}
			if req.CustomerID == "" || req.TPPID == "" {
				respondJSON(w, 400, map[string]string{"error": "customerId and tppId required"})
				return
			}
			// Verify TPP is active
			tppActive := false
			tppName := ""
			for _, t := range tpps {
				if t.ID == req.TPPID && t.Status == "active" {
					tppActive = true
					tppName = t.Name
					break
				}
			}
			if !tppActive {
				respondJSON(w, 403, map[string]string{"error": "TPP is not active or not found"})
				return
			}
			mu.Lock()
			consent := Consent{
				ID:          fmt.Sprintf("CNS-%03d", len(consents)+1),
				CustomerID:  req.CustomerID,
				TPPID:       req.TPPID,
				TPPName:     tppName,
				ConsentType: req.ConsentType,
				Permissions: req.Permissions,
				Status:      "awaiting_authorization",
				CreatedAt:   time.Now().UTC().Format(time.RFC3339),
				ExpiresAt:   time.Now().UTC().Add(180 * 24 * time.Hour).Format(time.RFC3339),
				Accounts:    req.Accounts,
			}
			consents = append(consents, consent)
			mu.Unlock()
			respondJSON(w, 201, consent)
			return
		}
		respondJSON(w, 405, map[string]string{"error": "method not allowed"})
	})

	mux.HandleFunc("/v1/open-banking/tpps", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{"items": tpps, "total": len(tpps)})
	})

	mux.HandleFunc("/v1/open-banking/api-catalog", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{"items": endpoints, "total": len(endpoints)})
	})

	mux.HandleFunc("/v1/open-banking/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		active := 0
		totalAccess := 0
		for _, c := range consents {
			if c.Status == "authorized" {
				active++
			}
			totalAccess += c.AccessCount
		}
		activeTPPs := 0
		for _, t := range tpps {
			if t.Status == "active" {
				activeTPPs++
			}
		}
		respondJSON(w, 200, map[string]interface{}{
			"totalConsents":    len(consents),
			"activeConsents":   active,
			"totalTPPs":        len(tpps),
			"activeTPPs":       activeTPPs,
			"totalAPIAccesses": totalAccess,
			"apiEndpoints":     len(endpoints),
			"byConsentType": map[string]int{
				"ais":   3,
				"pis":   4,
				"cbpii": 1,
			},
		})
	})

	fmt.Println("Open Banking service on :8165")
	http.ListenAndServe(":8165", mux)
}
