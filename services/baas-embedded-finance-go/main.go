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

// Banking-as-a-Service (BaaS) — white-label accounts, embedded payments, partner API management
// Implements CBN licensing framework for BaaS providers

var PORT = "8100"

func init() {
	if p := os.Getenv("PORT"); p != "" {
		PORT = p
	}
}

// ─── Domain Types ───

type Partner struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	APIKeyHash   string   `json:"api_key_hash"`
	Tier         string   `json:"tier"` // starter, growth, enterprise
	RateLimit    int      `json:"rate_limit"`
	WebhookURL   string   `json:"webhook_url"`
	SandboxMode  bool     `json:"sandbox_mode"`
	Status       string   `json:"status"` // pending→active→suspended→terminated
	DailyTxnCount int64  `json:"daily_txn_count"`
	MonthlyAccts int      `json:"monthly_accounts_created"`
	CreatedAt    string   `json:"created_at"`
}

type VirtualAccount struct {
	ID            string `json:"id"`
	PartnerID     string `json:"partner_id"`
	AccountNumber string `json:"account_number"`
	AccountName   string `json:"account_name"`
	BalanceKobo   int64  `json:"balance_kobo"`
	Currency      string `json:"currency"`
	Tier          string `json:"tier"` // tier1, tier2, tier3
	Status        string `json:"status"` // active, frozen, closed
	BVN           string `json:"bvn,omitempty"`
	CreatedAt     string `json:"created_at"`
}

type BaaSPayment struct {
	ID             string    `json:"id"`
	PartnerID      string    `json:"partner_id"`
	SourceAccount  string    `json:"source_account"`
	DestAccount    string    `json:"dest_account"`
	DestBankCode   string    `json:"dest_bank_code"`
	AmountKobo     int64     `json:"amount_kobo"`
	FeeKobo        int64     `json:"fee_kobo"`
	Reference      string    `json:"reference"`
	Channel        string    `json:"channel"` // nip, internal
	Status         string    `json:"status"`
	NFIUReportable bool      `json:"nfiu_reportable"`
	GLEntries      []GLEntry `json:"gl_entries,omitempty"`
	CreatedAt      string    `json:"created_at"`
}

type GLEntry struct {
	Account   string `json:"account"`
	Debit     int64  `json:"debit_kobo"`
	Credit    int64  `json:"credit_kobo"`
	Narration string `json:"narration"`
}

type WebhookEvent struct {
	ID        string      `json:"id"`
	PartnerID string      `json:"partner_id"`
	EventType string      `json:"event_type"`
	Payload   interface{} `json:"payload"`
	Status    string      `json:"status"` // pending, delivered, failed
	Retries   int         `json:"retries"`
	CreatedAt string      `json:"created_at"`
}

// ─── State ───

var (
	partners       []Partner
	partnersMu     sync.RWMutex
	accounts       []VirtualAccount
	accountsMu     sync.RWMutex
	baasPays       []BaaSPayment
	baasPaysMu     sync.RWMutex
	webhookEvents  []WebhookEvent
	webhooksMu     sync.RWMutex
	requestCount   int64
	errorCount     int64
	counterMu      sync.Mutex
	nubanSerial    int
	nubanSerialMu  sync.Mutex
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
	if len(value) == 0 { return "***" }
	switch fieldType {
	case "bvn":
		if len(value) >= 4 { return "***" + value[len(value)-4:] }
		return "***"
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

// ─── BaaS Tier Configuration ───

type TierConfig struct {
	DailyTxnLimit    int64
	MonthlyAcctLimit int
	RateLimit        int
	FlatFeeKobo      int64
	PctFee           float64
}

var baasTiers = map[string]TierConfig{
	"starter":    {DailyTxnLimit: 100000000, MonthlyAcctLimit: 100, RateLimit: 30, FlatFeeKobo: 2500, PctFee: 1.0},
	"growth":     {DailyTxnLimit: 1000000000, MonthlyAcctLimit: 1000, RateLimit: 100, FlatFeeKobo: 1500, PctFee: 0.75},
	"enterprise": {DailyTxnLimit: 10000000000, MonthlyAcctLimit: 10000, RateLimit: 500, FlatFeeKobo: 1000, PctFee: 0.5},
}

// ─── NUBAN Generation (CBN standard) ───

func generateNUBAN(bankCode string) string {
	nubanSerialMu.Lock()
	nubanSerial++
	serial := nubanSerial
	nubanSerialMu.Unlock()

	base := fmt.Sprintf("%03s%06d", bankCode, serial)
	weights := []int{3, 7, 3, 3, 7, 3, 3, 7, 3}
	sum := 0
	for i := 0; i < len(base) && i < len(weights); i++ {
		sum += weights[i] * int(base[i]-'0')
	}
	checkDigit := (10 - (sum % 10)) % 10
	return base + fmt.Sprintf("%d", checkDigit)
}

// ─── BVN Validation ───

func validateBVN(bvn string) (bool, string) {
	if len(bvn) != 11 { return false, "bvn_must_be_11_digits" }
	for _, c := range bvn {
		if c < '0' || c > '9' { return false, "bvn_must_be_numeric" }
	}
	return true, ""
}

// ─── NUBAN Validation ───

func validateNUBAN(acctNo string) (bool, string) {
	if len(acctNo) != 10 { return false, "account_must_be_10_digits" }
	for _, c := range acctNo { if c < '0' || c > '9' { return false, "account_must_be_numeric" } }
	return true, ""
}

// ─── CBN Tier Limits ───

var cbnTierLimits = map[string]int64{
	"tier1": 30000000,   // ₦300K
	"tier2": 50000000,   // ₦500K
	"tier3": 500000000,  // ₦5M
}

// ─── Fee Calculation ───

func computeFee(partnerTier string, amountKobo int64) int64 {
	config, ok := baasTiers[partnerTier]
	if !ok { return 5000 }
	fee := config.FlatFeeKobo + int64(float64(amountKobo)*config.PctFee/100)
	if fee > 200000 { fee = 200000 } // Cap at ₦2,000
	return fee
}

// ─── NFIU Check ───

func checkNFIU(amountKobo int64) (bool, string) {
	if amountKobo >= 1000000000 { return true, "transfer_threshold_10M" }
	if amountKobo >= 500000000 { return true, "cash_threshold_5M" }
	return false, ""
}

// ─── API Key Hash ───

func hashAPIKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

// ─── HMAC ───

func computeHMAC(data, key string) string {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

// ─── Handlers ───

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	partnersMu.RLock()
	pc := len(partners)
	partnersMu.RUnlock()
	accountsMu.RLock()
	ac := len(accounts)
	accountsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "baas-embedded-finance-go", "version": "2.0.0",
		"partners": pc, "virtual_accounts": ac,
		"tiers": []string{"starter", "growth", "enterprise"},
	})
}

func handlePartnerRegister(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Name       string `json:"name"`
		Tier       string `json:"tier"`
		WebhookURL string `json:"webhook_url"`
		Sandbox    bool   `json:"sandbox"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errs := []string{}
	if body.Name == "" { errs = append(errs, "name_required") }
	tierConfig, ok := baasTiers[body.Tier]
	if !ok { errs = append(errs, "tier_must_be_starter_growth_or_enterprise") }
	if body.WebhookURL == "" { errs = append(errs, "webhook_url_required") }
	if len(errs) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	apiKey := fmt.Sprintf("sk_live_%s%s", secureRandID(), secureRandID())
	partner := Partner{
		ID:          fmt.Sprintf("PTR-%s", secureRandID()),
		Name:        body.Name,
		APIKeyHash:  hashAPIKey(apiKey),
		Tier:        body.Tier,
		RateLimit:   tierConfig.RateLimit,
		WebhookURL:  body.WebhookURL,
		SandboxMode: body.Sandbox,
		Status:      "active",
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
	}

	partnersMu.Lock()
	partners = append(partners, partner)
	partnersMu.Unlock()

	log.Printf("[BaaS] Partner registered: %s name=%s tier=%s", partner.ID, partner.Name, partner.Tier)
	respondJSON(w, 201, map[string]interface{}{
		"partner":  partner,
		"api_key":  apiKey,
		"warning":  "Store this API key securely. It will not be shown again.",
	})
}

func handleVirtualAccountCreate(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		PartnerID   string `json:"partner_id"`
		AccountName string `json:"account_name"`
		BVN         string `json:"bvn"`
		Tier        string `json:"tier"` // tier1, tier2, tier3
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errs := []string{}
	if body.PartnerID == "" { errs = append(errs, "partner_id_required") }
	if body.AccountName == "" { errs = append(errs, "account_name_required") }
	if body.Tier == "" { body.Tier = "tier1" }
	if _, ok := cbnTierLimits[body.Tier]; !ok { errs = append(errs, "invalid_cbn_tier") }

	if body.Tier != "tier1" {
		if body.BVN == "" { errs = append(errs, "bvn_required_for_tier2_and_above") }
		if body.BVN != "" {
			if valid, msg := validateBVN(body.BVN); !valid { errs = append(errs, msg) }
		}
	}

	// Verify partner
	partnersMu.RLock()
	var partner *Partner
	for i := range partners {
		if partners[i].ID == body.PartnerID && partners[i].Status == "active" {
			partner = &partners[i]
			break
		}
	}
	partnersMu.RUnlock()
	if partner == nil { errs = append(errs, "partner_not_found_or_inactive") }

	// Check monthly account limit
	if partner != nil {
		tierConfig := baasTiers[partner.Tier]
		if partner.MonthlyAccts >= tierConfig.MonthlyAcctLimit {
			errs = append(errs, fmt.Sprintf("monthly_account_limit_reached:%d", tierConfig.MonthlyAcctLimit))
		}
	}

	if len(errs) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	acctNumber := generateNUBAN("100")
	account := VirtualAccount{
		ID:            fmt.Sprintf("VA-%s", secureRandID()),
		PartnerID:     body.PartnerID,
		AccountNumber: acctNumber,
		AccountName:   body.AccountName,
		BalanceKobo:   0,
		Currency:      "NGN",
		Tier:          body.Tier,
		Status:        "active",
		BVN:           body.BVN,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	}

	accountsMu.Lock()
	accounts = append(accounts, account)
	accountsMu.Unlock()

	// Increment partner monthly account count
	partnersMu.Lock()
	for i := range partners {
		if partners[i].ID == body.PartnerID {
			partners[i].MonthlyAccts++
			break
		}
	}
	partnersMu.Unlock()

	log.Printf("[BaaS] Virtual account created: %s partner=%s acct=%s",
		account.ID, body.PartnerID, maskPII(acctNumber, "account"))
	respondJSON(w, 201, map[string]interface{}{
		"account":       account,
		"balance_limit": cbnTierLimits[body.Tier],
	})
}

func handlePaymentProcess(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		PartnerID     string `json:"partner_id"`
		SourceAccount string `json:"source_account"`
		DestAccount   string `json:"dest_account"`
		DestBankCode  string `json:"dest_bank_code"`
		AmountKobo    int64  `json:"amount_kobo"`
		Narration     string `json:"narration"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}

	errs := []string{}
	if body.PartnerID == "" { errs = append(errs, "partner_id_required") }
	if valid, msg := validateNUBAN(body.SourceAccount); !valid { errs = append(errs, "source_"+msg) }
	if valid, msg := validateNUBAN(body.DestAccount); !valid { errs = append(errs, "dest_"+msg) }
	if body.AmountKobo <= 0 { errs = append(errs, "amount_must_be_positive") }

	// Verify source account
	accountsMu.Lock()
	var srcAcct *VirtualAccount
	for i := range accounts {
		if accounts[i].AccountNumber == body.SourceAccount && accounts[i].PartnerID == body.PartnerID {
			srcAcct = &accounts[i]
			break
		}
	}
	if srcAcct == nil {
		accountsMu.Unlock()
		errs = append(errs, "source_account_not_found")
	} else if srcAcct.BalanceKobo < body.AmountKobo {
		accountsMu.Unlock()
		errs = append(errs, "insufficient_balance")
		srcAcct = nil
	} else {
		// Check tier limit
		tierLimit := cbnTierLimits[srcAcct.Tier]
		if body.AmountKobo > tierLimit {
			accountsMu.Unlock()
			errs = append(errs, fmt.Sprintf("exceeds_tier_limit:%d", tierLimit))
			srcAcct = nil
		}
	}

	if len(errs) > 0 {
		if srcAcct != nil { accountsMu.Unlock() }
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	srcAcct.BalanceKobo -= body.AmountKobo
	accountsMu.Unlock()

	// Lookup partner for fee
	partnersMu.RLock()
	partnerTier := "starter"
	for _, p := range partners {
		if p.ID == body.PartnerID { partnerTier = p.Tier; break }
	}
	partnersMu.RUnlock()

	feeKobo := computeFee(partnerTier, body.AmountKobo)
	nfiu, nfiuMsg := checkNFIU(body.AmountKobo)

	channel := "internal"
	if body.DestBankCode != "" && body.DestBankCode != "100" {
		channel = "nip"
	}

	payment := BaaSPayment{
		ID:            fmt.Sprintf("BPY-%s", secureRandID()),
		PartnerID:     body.PartnerID,
		SourceAccount: body.SourceAccount,
		DestAccount:   body.DestAccount,
		DestBankCode:  body.DestBankCode,
		AmountKobo:    body.AmountKobo,
		FeeKobo:       feeKobo,
		Reference:     fmt.Sprintf("BAAS%s%s", time.Now().Format("20060102"), secureRandID()),
		Channel:       channel,
		Status:        "completed",
		NFIUReportable: nfiu,
		GLEntries: []GLEntry{
			{Account: body.SourceAccount, Debit: body.AmountKobo + feeKobo, Narration: "BaaS payment debit"},
			{Account: body.DestAccount, Credit: body.AmountKobo, Narration: "BaaS payment credit"},
			{Account: "BAAS_FEE_INCOME", Credit: feeKobo, Narration: "BaaS processing fee"},
		},
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	baasPaysMu.Lock()
	baasPays = append(baasPays, payment)
	baasPaysMu.Unlock()

	resp := map[string]interface{}{"payment": payment}
	if nfiu { resp["nfiu_alert"] = nfiuMsg }
	respondJSON(w, 201, resp)
}

func handleAccountBalance(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		AccountNumber string `json:"account_number"`
		PartnerID     string `json:"partner_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	accountsMu.RLock()
	defer accountsMu.RUnlock()
	for _, a := range accounts {
		if a.AccountNumber == body.AccountNumber && a.PartnerID == body.PartnerID {
			respondJSON(w, 200, map[string]interface{}{
				"account_number": a.AccountNumber,
				"balance_kobo":   a.BalanceKobo,
				"tier":           a.Tier,
				"tier_limit":     cbnTierLimits[a.Tier],
				"status":         a.Status,
			})
			return
		}
	}
	respondJSON(w, 404, map[string]interface{}{"error": "account_not_found"})
}

func handlePartnerList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	partnersMu.RLock()
	defer partnersMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"partners": partners, "count": len(partners)})
}

func handleAccountList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	accountsMu.RLock()
	defer accountsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"accounts": accounts, "count": len(accounts)})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	counterMu.Lock()
	rc, ec := requestCount, errorCount
	counterMu.Unlock()
	fmt.Fprintf(w, "requests_total{service=\"baas-embedded-finance-go\"} %d\n", rc)
	fmt.Fprintf(w, "errors_total{service=\"baas-embedded-finance-go\"} %d\n", ec)
}

func main() {
	_ = big.NewInt
	_ = sanitizeLogEntry
	_ = computeHMAC
	_ = hex.EncodeToString
	_ = strings.HasPrefix
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", handleHealthz)
	mux.HandleFunc("/livez", handleHealthz)
	mux.HandleFunc("/metrics", handleMetrics)
	mux.HandleFunc("/v1/partner/register", handlePartnerRegister)
	mux.HandleFunc("/v1/partner/list", handlePartnerList)
	mux.HandleFunc("/v1/account/create", handleVirtualAccountCreate)
	mux.HandleFunc("/v1/account/balance", handleAccountBalance)
	mux.HandleFunc("/v1/account/list", handleAccountList)
	mux.HandleFunc("/v1/payment/process", handlePaymentProcess)
	log.Printf("BaaS Embedded Finance Platform listening on :%s", PORT)
	log.Fatal(http.ListenAndServe(":"+PORT, mux))
}
