package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

// CBN Open Banking Regulatory Framework — AISP (Account Information) + PISP (Payment Initiation) APIs
// Implements CBN Open Banking Guidelines 2023

var PORT = "8100"

func init() {
	if p := os.Getenv("PORT"); p != "" {
		PORT = p
	}
}

// ─── Domain Types ───

type ConsentRequest struct {
	ID              string   `json:"id"`
	TPPId           string   `json:"tpp_id"`
	CustomerID      string   `json:"customer_id"`
	ConsentType     string   `json:"consent_type"` // AISP or PISP
	Permissions     []string `json:"permissions"`
	ExpiresAt       string   `json:"expires_at"`
	Status          string   `json:"status"` // pending→authorized→active→revoked→expired
	CreatedAt       string   `json:"created_at"`
	AuthorizedAt    string   `json:"authorized_at,omitempty"`
	FrequencyLimit  int      `json:"frequency_limit"`  // max requests per day
	TransactionFrom string   `json:"transaction_from,omitempty"`
	TransactionTo   string   `json:"transaction_to,omitempty"`
}

type TPPRegistration struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Type           string   `json:"type"` // AISP, PISP, CBPII
	LicenseNumber  string   `json:"license_number"`
	CertificateExp string   `json:"certificate_expires"`
	CallbackURL    string   `json:"callback_url"`
	Status         string   `json:"status"` // registered→verified→active→suspended→revoked
	Permissions    []string `json:"permissions"`
	RateLimit      int      `json:"rate_limit"` // requests per minute
	CreatedAt      string   `json:"created_at"`
}

type PaymentInitiation struct {
	ID              string `json:"id"`
	ConsentID       string `json:"consent_id"`
	TPPId           string `json:"tpp_id"`
	DebitAccount    string `json:"debit_account"`
	CreditAccount   string `json:"credit_account"`
	AmountKobo      int64  `json:"amount_kobo"`
	Currency        string `json:"currency"`
	Reference       string `json:"reference"`
	Narration       string `json:"narration"`
	Status          string `json:"status"` // initiated→validating→processing→completed→failed→reversed
	ChannelCode     string `json:"channel_code"`
	NFIUReportable  bool   `json:"nfiu_reportable"`
	CreatedAt       string `json:"created_at"`
	CompletedAt     string `json:"completed_at,omitempty"`
}

// ─── State ───

var (
	consents   []ConsentRequest
	consentsMu sync.RWMutex
	tpps       []TPPRegistration
	tppsMu     sync.RWMutex
	payments   []PaymentInitiation
	paymentsMu sync.RWMutex
	requestCount int64
	errorCount   int64
	counterMu    sync.Mutex
)

func incRequests() { counterMu.Lock(); requestCount++; counterMu.Unlock() }
func incErrors()   { counterMu.Lock(); errorCount++; counterMu.Unlock() }

// ─── Utilities ───

func secureRandID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%X", b)
}

func maskPII(value, fieldType string) string {
	if len(value) == 0 {
		return "***"
	}
	switch fieldType {
	case "bvn", "nin":
		if len(value) >= 4 { return "***" + value[len(value)-4:] }
		return "***"
	case "phone":
		if len(value) >= 4 { return "+234***" + value[len(value)-4:] }
		return "+234***"
	case "email":
		parts := strings.SplitN(value, "@", 2)
		if len(parts) == 2 { return string(parts[0][0]) + "***@" + parts[1] }
		return "***@***"
	case "account":
		if len(value) >= 4 { return "****" + value[len(value)-4:] }
		return "****"
	default:
		return "***"
	}
}

func sanitizeLogEntry(msg string) string {
	re1 := regexp.MustCompile(`\b[0-9]{11}\b`)
	return re1.ReplaceAllStringFunc(msg, func(s string) string { return "***" + s[len(s)-4:] })
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Strict-Transport-Security", "max-age=31536000")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Consent State Machine ───

var consentTransitions = map[string][]string{
	"pending":    {"authorized", "rejected"},
	"authorized": {"active"},
	"active":     {"revoked", "expired"},
	"revoked":    {},
	"rejected":   {},
	"expired":    {},
}

func validateConsentTransition(current, target string) (bool, string) {
	allowed, ok := consentTransitions[current]
	if !ok {
		return false, fmt.Sprintf("unknown_state:%s", current)
	}
	for _, a := range allowed {
		if a == target {
			return true, ""
		}
	}
	return false, fmt.Sprintf("invalid_transition:%s->%s", current, target)
}

// ─── Payment State Machine ───

var paymentTransitions = map[string][]string{
	"initiated":  {"validating"},
	"validating": {"processing", "failed"},
	"processing": {"completed", "failed"},
	"completed":  {"reversed"},
	"failed":     {},
	"reversed":   {},
}

// ─── AISP Permissions ───

var aispPermissions = []string{
	"ReadAccountsBasic", "ReadAccountsDetail", "ReadBalances",
	"ReadTransactionsBasic", "ReadTransactionsDetail", "ReadTransactionsCredits",
	"ReadTransactionsDebits", "ReadStatementsBasic", "ReadStatementsDetail",
	"ReadProducts", "ReadStandingOrdersBasic", "ReadStandingOrdersDetail",
	"ReadDirectDebits", "ReadScheduledPaymentsBasic", "ReadScheduledPaymentsDetail",
	"ReadBeneficiariesDetail", "ReadParty", "ReadPartyPSU",
}

// ─── NUBAN Validation ───

func validateNUBAN(accountNumber string) (bool, string) {
	if len(accountNumber) != 10 {
		return false, "account_number_must_be_10_digits"
	}
	for _, c := range accountNumber {
		if c < '0' || c > '9' {
			return false, "account_number_must_be_numeric"
		}
	}
	return true, ""
}

// ─── HMAC Signature Verification ───

func verifySignature(payload, signature, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// ─── CBN Tier Limits ───

var cbnTierLimits = map[string]int64{
	"tier1": 30000000,    // ₦300K in kobo
	"tier2": 50000000,    // ₦500K in kobo
	"tier3": 500000000,   // ₦5M in kobo
}

func checkTierLimit(tier string, amountKobo int64) (bool, string) {
	limit, ok := cbnTierLimits[tier]
	if !ok {
		return false, "unknown_tier"
	}
	if amountKobo > limit {
		return false, fmt.Sprintf("exceeds_tier_limit:%s_max:%d_kobo", tier, limit)
	}
	return true, ""
}

// ─── NFIU Threshold ───

func checkNFIU(amountKobo int64) (bool, string) {
	if amountKobo >= 1000000000 { // ₦10M
		return true, "transfer_threshold_10M"
	}
	if amountKobo >= 500000000 { // ₦5M
		return true, "cash_threshold_5M"
	}
	return false, ""
}

// ─── Handlers ───

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	consentsMu.RLock()
	cc := len(consents)
	consentsMu.RUnlock()
	tppsMu.RLock()
	tc := len(tpps)
	tppsMu.RUnlock()
	paymentsMu.RLock()
	pc := len(payments)
	paymentsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "open-banking-gateway-go", "version": "2.0.0",
		"consents": cc, "tpps": tc, "payments": pc,
		"regulation": "CBN_Open_Banking_Guidelines_2023",
		"supported_apis": []string{"AISP", "PISP", "CBPII"},
	})
}

func handleConsentCreate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		TPPId       string   `json:"tpp_id"`
		CustomerID  string   `json:"customer_id"`
		ConsentType string   `json:"consent_type"`
		Permissions []string `json:"permissions"`
		ExpiresIn   int      `json:"expires_in_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
		return
	}

	errors := []string{}
	if body.TPPId == "" { errors = append(errors, "tpp_id_required") }
	if body.CustomerID == "" { errors = append(errors, "customer_id_required") }
	if body.ConsentType != "AISP" && body.ConsentType != "PISP" {
		errors = append(errors, "consent_type_must_be_AISP_or_PISP")
	}
	if len(body.Permissions) == 0 { errors = append(errors, "permissions_required") }
	if body.ConsentType == "AISP" {
		for _, p := range body.Permissions {
			valid := false
			for _, ap := range aispPermissions {
				if p == ap { valid = true; break }
			}
			if !valid {
				errors = append(errors, fmt.Sprintf("invalid_aisp_permission:%s", p))
			}
		}
	}
	if len(errors) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errors})
		return
	}

	// Verify TPP is registered and active
	tppsMu.RLock()
	var tppFound *TPPRegistration
	for i := range tpps {
		if tpps[i].ID == body.TPPId && tpps[i].Status == "active" {
			tppFound = &tpps[i]
			break
		}
	}
	tppsMu.RUnlock()
	if tppFound == nil {
		incErrors()
		respondJSON(w, 403, map[string]interface{}{"error": "tpp_not_found_or_inactive"})
		return
	}

	now := time.Now().UTC()
	expiresIn := body.ExpiresIn
	if expiresIn <= 0 { expiresIn = 90 }
	consent := ConsentRequest{
		ID:             fmt.Sprintf("CST-%s", secureRandID()),
		TPPId:          body.TPPId,
		CustomerID:     body.CustomerID,
		ConsentType:    body.ConsentType,
		Permissions:    body.Permissions,
		ExpiresAt:      now.Add(time.Duration(expiresIn) * 24 * time.Hour).Format(time.RFC3339),
		Status:         "pending",
		CreatedAt:      now.Format(time.RFC3339),
		FrequencyLimit: 4,
	}

	consentsMu.Lock()
	consents = append(consents, consent)
	consentsMu.Unlock()

	log.Printf("[OB] Consent created: %s type=%s tpp=%s customer=%s",
		consent.ID, consent.ConsentType, consent.TPPId, maskPII(consent.CustomerID, "account"))
	respondJSON(w, 201, map[string]interface{}{"consent": consent})
}

func handleConsentAuthorize(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		ConsentID string `json:"consent_id"`
		Action    string `json:"action"` // authorize or reject
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	target := "authorized"
	if body.Action == "reject" { target = "rejected" }

	consentsMu.Lock()
	defer consentsMu.Unlock()
	for i := range consents {
		if consents[i].ID == body.ConsentID {
			valid, errMsg := validateConsentTransition(consents[i].Status, target)
			if !valid {
				incErrors()
				respondJSON(w, 400, map[string]interface{}{"error": errMsg})
				return
			}
			consents[i].Status = target
			consents[i].AuthorizedAt = time.Now().UTC().Format(time.RFC3339)
			respondJSON(w, 200, map[string]interface{}{"consent": consents[i], "transition": target})
			return
		}
	}
	incErrors()
	respondJSON(w, 404, map[string]interface{}{"error": "consent_not_found"})
}

func handleTPPRegister(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Name          string   `json:"name"`
		Type          string   `json:"type"`
		LicenseNumber string   `json:"license_number"`
		CallbackURL   string   `json:"callback_url"`
		Permissions   []string `json:"permissions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errors := []string{}
	if body.Name == "" { errors = append(errors, "name_required") }
	if body.Type != "AISP" && body.Type != "PISP" && body.Type != "CBPII" {
		errors = append(errors, "type_must_be_AISP_PISP_or_CBPII")
	}
	if body.LicenseNumber == "" { errors = append(errors, "license_number_required") }
	if body.CallbackURL == "" { errors = append(errors, "callback_url_required") }
	if len(errors) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errors})
		return
	}

	tpp := TPPRegistration{
		ID:             fmt.Sprintf("TPP-%s", secureRandID()),
		Name:           body.Name,
		Type:           body.Type,
		LicenseNumber:  body.LicenseNumber,
		CertificateExp: time.Now().UTC().Add(365 * 24 * time.Hour).Format(time.RFC3339),
		CallbackURL:    body.CallbackURL,
		Status:         "active",
		Permissions:    body.Permissions,
		RateLimit:      60,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
	}

	tppsMu.Lock()
	tpps = append(tpps, tpp)
	tppsMu.Unlock()

	respondJSON(w, 201, map[string]interface{}{"tpp": tpp})
}

func handlePaymentInitiate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		ConsentID     string `json:"consent_id"`
		DebitAccount  string `json:"debit_account"`
		CreditAccount string `json:"credit_account"`
		AmountKobo    int64  `json:"amount_kobo"`
		Currency      string `json:"currency"`
		Narration     string `json:"narration"`
		Tier          string `json:"tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errors := []string{}
	if body.ConsentID == "" { errors = append(errors, "consent_id_required") }
	if body.AmountKobo <= 0 { errors = append(errors, "amount_must_be_positive") }
	if valid, msg := validateNUBAN(body.DebitAccount); !valid { errors = append(errors, "debit_"+msg) }
	if valid, msg := validateNUBAN(body.CreditAccount); !valid { errors = append(errors, "credit_"+msg) }
	if body.DebitAccount == body.CreditAccount { errors = append(errors, "debit_and_credit_must_differ") }
	if body.Currency == "" { body.Currency = "NGN" }

	// Tier limit check
	if body.Tier != "" {
		if valid, msg := checkTierLimit(body.Tier, body.AmountKobo); !valid {
			errors = append(errors, msg)
		}
	}
	if len(errors) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errors})
		return
	}

	// Verify consent exists and is PISP + active
	consentsMu.RLock()
	var consent *ConsentRequest
	for i := range consents {
		if consents[i].ID == body.ConsentID {
			consent = &consents[i]
			break
		}
	}
	consentsMu.RUnlock()
	if consent == nil || (consent.Status != "authorized" && consent.Status != "active") {
		incErrors()
		respondJSON(w, 403, map[string]interface{}{"error": "consent_not_active"})
		return
	}
	if consent.ConsentType != "PISP" {
		incErrors()
		respondJSON(w, 403, map[string]interface{}{"error": "consent_type_not_PISP"})
		return
	}

	nfiu, nfiuMsg := checkNFIU(body.AmountKobo)

	payment := PaymentInitiation{
		ID:             fmt.Sprintf("PAY-%s", secureRandID()),
		ConsentID:      body.ConsentID,
		TPPId:          consent.TPPId,
		DebitAccount:   body.DebitAccount,
		CreditAccount:  body.CreditAccount,
		AmountKobo:     body.AmountKobo,
		Currency:       body.Currency,
		Reference:      fmt.Sprintf("OB-%s", secureRandID()),
		Narration:      body.Narration,
		Status:         "initiated",
		ChannelCode:    "OB",
		NFIUReportable: nfiu,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
	}

	paymentsMu.Lock()
	payments = append(payments, payment)
	paymentsMu.Unlock()

	resp := map[string]interface{}{"payment": payment}
	if nfiu {
		resp["nfiu_alert"] = nfiuMsg
	}
	log.Printf("[OB] Payment initiated: %s amount=%d debit=%s credit=%s",
		payment.ID, payment.AmountKobo, maskPII(body.DebitAccount, "account"), maskPII(body.CreditAccount, "account"))
	respondJSON(w, 201, resp)
}

func handleConsentsList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	consentsMu.RLock()
	defer consentsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"consents": consents, "count": len(consents)})
}

func handlePaymentsList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	paymentsMu.RLock()
	defer paymentsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"payments": payments, "count": len(payments)})
}

func handleTPPList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	tppsMu.RLock()
	defer tppsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"tpps": tpps, "count": len(tpps)})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	counterMu.Lock()
	rc, ec := requestCount, errorCount
	counterMu.Unlock()
	fmt.Fprintf(w, "requests_total{service=\"open-banking-gateway-go\"} %d\nerrors_total{service=\"open-banking-gateway-go\"} %d\n", rc, ec)
}

func main() {
	_ = big.NewInt
	_ = sanitizeLogEntry
	_ = verifySignature
	_ = hex.EncodeToString
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", handleHealthz)
	mux.HandleFunc("/livez", handleHealthz)
	mux.HandleFunc("/metrics", handleMetrics)
	mux.HandleFunc("/v1/consents", handleConsentsList)
	mux.HandleFunc("/v1/consent/create", handleConsentCreate)
	mux.HandleFunc("/v1/consent/authorize", handleConsentAuthorize)
	mux.HandleFunc("/v1/tpp/register", handleTPPRegister)
	mux.HandleFunc("/v1/tpp/list", handleTPPList)
	mux.HandleFunc("/v1/payment/initiate", handlePaymentInitiate)
	mux.HandleFunc("/v1/payments", handlePaymentsList)
	log.Printf("CBN Open Banking Gateway (AISP + PISP) listening on :%s", PORT)
	log.Fatal(http.ListenAndServe(":"+PORT, mux))
}
