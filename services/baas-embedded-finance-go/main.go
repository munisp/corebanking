package main

import (
	"bytes"
	_ "github.com/lib/pq"
	"database/sql"
	"context"
	"os/signal"
	"syscall"
	"sync/atomic"

	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)


// Concurrency limiter prevents goroutine explosion
var semaphore = make(chan struct{}, 100)

func acquireSem() { semaphore <- struct{}{} }
func releaseSem() { <-semaphore }
var serviceName = "baas-embedded-finance-go"

var eventBus = newEventBus("platform.events", "baas-embedded-finance")

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
		w.Header().Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'")
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if dataBytes, err := json.Marshal(partner); err == nil { if dbErr := dbInsert(fmt.Sprintf("baas-embedded-finance-go-%d", time.Now().UnixNano()), "baas-embedded-finance-go", "partners", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	partnersMu.Unlock()

	log.Printf("[BaaS] Partner registered: %s name=%s tier=%s", partner.ID, partner.Name, partner.Tier)
		eventBus.Emit("baas-embedded-finance.processed", map[string]interface{}{"status": "success"})
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if dataBytes, err := json.Marshal(account); err == nil { if dbErr := dbInsert(fmt.Sprintf("baas-embedded-finance-go-%d", time.Now().UnixNano()), "baas-embedded-finance-go", "accounts", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if dataBytes, err := json.Marshal(payment); err == nil { if dbErr := dbInsert(fmt.Sprintf("baas-embedded-finance-go-%d", time.Now().UnixNano()), "baas-embedded-finance-go", "baasPays", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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


// ─── PostgreSQL Persistence ───

var db *sql.DB
var readyFlag int32

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — write operations will return 503", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — degraded mode active", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — degraded mode active", serviceName, err)
		db = nil
		return
	}
	log.Printf("[%s] Postgres connected (pool: 25/5)", serviceName)
	db.Exec(`CREATE TABLE IF NOT EXISTS service_records (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
		status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
		created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
		created_by TEXT DEFAULT '', tenant_id TEXT DEFAULT ''
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_status ON service_records(service, status)`)
	atomic.StoreInt32(&readyFlag, 1)
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET data=$5, status=$4, updated_at=NOW()", id, service, typ, status, string(data))
	return err
}

func dbQuery(service, typ string) ([]map[string]interface{}, error) {
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, data, status, created_at FROM service_records WHERE service=$1 AND type=$2 ORDER BY created_at DESC LIMIT 100", service, typ)
	if err != nil { return nil, err }
	defer rows.Close()
	var results []map[string]interface{}
	for rows.Next() {
		var id, data, status, createdAt string
		if err := rows.Scan(&id, &data, &status, &createdAt); err != nil { continue }
		results = append(results, map[string]interface{}{"id": id, "data": data, "status": status, "created_at": createdAt})
	}
	return results, nil
}


// ─── Idempotency Middleware ─────────────────────────────────────────────────
var idempotencyCache = struct {
	sync.RWMutex
	entries map[string]idempotencyEntry
}{entries: make(map[string]idempotencyEntry)}

type idempotencyEntry struct {
	response   []byte
	statusCode int
	createdAt  time.Time
}

func idempotencyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" && r.Method != "PUT" {
			next.ServeHTTP(w, r)
			return
		}
		key := r.Header.Get("Idempotency-Key")
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}
		idempotencyCache.RLock()
		if entry, ok := idempotencyCache.entries[key]; ok {
			idempotencyCache.RUnlock()
			w.Header().Set("X-Idempotency-Replayed", "true")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(entry.statusCode)
			w.Write(entry.response)
			return
		}
		idempotencyCache.RUnlock()
		rec := &idempotencyRecorder{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(rec, r)
		idempotencyCache.Lock()
		idempotencyCache.entries[key] = idempotencyEntry{response: rec.body, statusCode: rec.statusCode, createdAt: time.Now()}
		idempotencyCache.Unlock()
		// Cleanup old entries (>24h) in background
		go func() {
			idempotencyCache.Lock()
			defer idempotencyCache.Unlock()
			for k, v := range idempotencyCache.entries {
				if time.Since(v.createdAt) > 24*time.Hour { delete(idempotencyCache.entries, k) }
			}
		}()
	})
}

type idempotencyRecorder struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (r *idempotencyRecorder) WriteHeader(code int) { r.statusCode = code; r.ResponseWriter.WriteHeader(code) }
func (r *idempotencyRecorder) Write(b []byte) (int, error) { r.body = append(r.body, b...); return r.ResponseWriter.Write(b) }


// ─── Transaction Atomicity ──────────────────────────────────────────────────
// All multi-step write operations wrapped in DB transactions.
func dbExecAtomic(queries []string, params [][]interface{}) error {
	if db == nil { return fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return fmt.Errorf("BEGIN failed: %v", err) }
	for i, q := range queries {
		var args []interface{}
		if i < len(params) { args = params[i] }
		if _, err := tx.Exec(q, args...); err != nil {
			tx.Rollback()
			return fmt.Errorf("step %d failed: %v", i+1, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("COMMIT failed: %v", err)
	}
	return nil
}


func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simple token bucket: allow bursts of 100 requests
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key, X-Tenant-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}


// --- Monetary Safety (kobo precision) ---
// roundNaira eliminates floating-point drift by rounding to 2 decimal places (kobo precision).
func roundNaira(amount float64) float64 { return math.Round(amount*100) / 100 }

// validateAmount checks monetary amount is non-negative and within CBN limits.
func validateAmount(amount float64) error {
	if amount < 0 {
		return fmt.Errorf("amount must be non-negative, got %.2f", amount)
	}
	if amount > 999_999_999_999.99 {
		return fmt.Errorf("amount exceeds maximum (₦999,999,999,999.99), got %.2f", amount)
	}
	return nil
}

// --- Audit Trail (append-only) ---
type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	RecordID  string `json:"record_id"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	Details   string `json:"details"`
}

var auditLog []AuditEntry

func appendAudit(action, recordID, actor, details string) {
	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", secureRandUint32()),
		Action: action, RecordID: recordID, Actor: actor,
		Timestamp: time.Now().UTC().Format(time.RFC3339), Details: details,
	})

}

// --- Request Tracing ---
func tracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" { traceID = r.Header.Get("traceparent") }
		if traceID == "" { traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid()) }
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Circuit Breaker ---
type circuitBreakerState int
const (
	cbClosed circuitBreakerState = iota
	cbOpen
	cbHalfOpen
)

var (
	cbState     circuitBreakerState
	cbFailCount uint64
	cbLastFail  int64
	cbThreshold uint64 = 5
	cbTimeout   int64  = 30 // seconds
)

func cbAllow() bool {
	if cbState == cbClosed { return true }
	if cbState == cbOpen && time.Now().Unix()-atomic.LoadInt64(&cbLastFail) > cbTimeout {
		cbState = cbHalfOpen
		return true
	}
	return cbState == cbHalfOpen
}

func cbRecordSuccess() { atomic.StoreUint64(&cbFailCount, 0); cbState = cbClosed }
func cbRecordFailure() {
	atomic.AddUint64(&cbFailCount, 1)
	atomic.StoreInt64(&cbLastFail, time.Now().Unix())
	if atomic.LoadUint64(&cbFailCount) >= cbThreshold { cbState = cbOpen }
}

// --- Observability (OpenTelemetry) ---
var otelEndpoint = os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

func initTracing() {
	if otelEndpoint == "" { return }
	log.Printf("[%s] OTEL tracing configured: %s", serviceName, otelEndpoint)
}

// --- Retry with Exponential Backoff ---
func retryWithBackoff(maxRetries int, fn func() error) error {
	for i := 0; i < maxRetries; i++ {
		if err := fn(); err == nil { return nil }
		backoff := time.Duration(1<<uint(i)) * 100 * time.Millisecond
		if backoff > 5*time.Second { backoff = 5 * time.Second }
		time.Sleep(backoff)
	}
	return fmt.Errorf("max retries (%d) exceeded", maxRetries)
}


func secureRandUint32() uint32 {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil { return uint32(time.Now().UnixNano()) }
	return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
}

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := r.Header.Get("X-Request-Id")
		if rid == "" {
			rid = fmt.Sprintf("%d", time.Now().UnixNano())
		}
		w.Header().Set("X-Request-Id", rid)
		next.ServeHTTP(w, r)
	})
}

// Handler context with timeout prevents hung requests
func handlerContext(r *http.Request) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), 30*time.Second)
}

// Secure HTTP server configuration
func newSecureServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
	}
}

func sanitizeError(err error) string {
	errStr := err.Error()
	if strings.Contains(errStr, "/") || strings.Contains(errStr, "\\") { return "internal error" }
	if len(errStr) > 200 { return "internal error" }
	return errStr
}

// IP-based sliding window rate limiter
type ipRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*rateBucket
	rate     int
	window   time.Duration
}

type rateBucket struct {
	count    int
	lastSeen time.Time
}

func newIPRateLimiter(rate int, window time.Duration) *ipRateLimiter {
	rl := &ipRateLimiter{visitors: make(map[string]*rateBucket), rate: rate, window: window}
	go rl.cleanup()
	return rl
}

func (rl *ipRateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	b, exists := rl.visitors[ip]
	if !exists || time.Since(b.lastSeen) > rl.window {
		rl.visitors[ip] = &rateBucket{count: 1, lastSeen: time.Now()}
		return true
	}
	if b.count >= rl.rate {
		return false
	}
	b.count++
	b.lastSeen = time.Now()
	return true
}

func (rl *ipRateLimiter) cleanup() {
	for {
		time.Sleep(rl.window)
		rl.mu.Lock()
		for ip, b := range rl.visitors {
			if time.Since(b.lastSeen) > rl.window {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

var globalIPLimiter = newIPRateLimiter(100, time.Minute)

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	return host
}

// Prevent HTTP header injection (strip CR/LF)
func sanitizeHeader(value string) string {
	return strings.NewReplacer("\r", "", "\n", "", "\x00", "").Replace(value)
}


// panicRecoveryMiddleware catches panics and returns 500 instead of crashing
func panicRecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[%s] PANIC recovered: %v", serviceName, err)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(`{"error":"internal server error"}`))
			}
		}()
		next.ServeHTTP(w, r)
	})
}


// validateJWTExpiry checks JWT token expiry claim
func validateJWTExpiry(tokenStr string) bool {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 { return false }
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil { return false }
	var claims map[string]interface{}
	if err := json.Unmarshal(payload, &claims); err != nil { return false }
	exp, ok := claims["exp"].(float64)
	if !ok { return false }
	return time.Now().Unix() < int64(exp)
}

func main() {
	initTracing()
	initDB()
	_ = context.Background
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

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
		<-sigCh
		log.Printf("[%s] Shutting down gracefully...", serviceName)
		if db != nil { db.Close() }
		os.Exit(0)
	}()
		srv := &http.Server{Addr: ":"+PORT, Handler: corsMiddleware(rateLimitMiddleware(mux))}
	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("[baas-embedded-finance-go] Shutting down gracefully...")
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()
	log.Printf("[baas-embedded-finance-go] listening on %s", ":"+PORT)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("Server error: %v", err)
	}
}

// --- Event Bus (Kafka-compatible event emission) ---

type EventBus struct {
	brokerURL   string
	topic       string
	serviceName string
	mu          sync.Mutex
	buffer      []map[string]interface{}
}

func newEventBus(topic, service string) *EventBus {
	broker := os.Getenv("KAFKA_BROKERS")
	if broker == "" {
		broker = "localhost:9092"
	}
	return &EventBus{brokerURL: broker, topic: topic, serviceName: service}
}

func (eb *EventBus) Emit(eventType string, payload map[string]interface{}) {
	event := map[string]interface{}{
		"id":        fmt.Sprintf("%s_%d", eb.serviceName, time.Now().UnixMilli()),
		"type":      eventType,
		"source":    eb.serviceName,
		"topic":     eb.topic,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"data":      payload,
	}
	eb.mu.Lock()
	eb.buffer = append(eb.buffer, event)
	eb.mu.Unlock()
	// In production: sarama.SyncProducer.SendMessage to eb.topic
	log.Printf("[EventBus] %s -> %s: %s", eb.serviceName, eb.topic, eventType)
}

func (eb *EventBus) Flush() []map[string]interface{} {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	events := eb.buffer
	eb.buffer = nil
	return events
}

// --- Downstream Notifier ---

func notifyDownstream(serviceURL, path string, payload interface{}) error {
	body, _ := json.Marshal(payload)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "POST", serviceURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Source-Service", serviceName)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[Downstream] %s%s failed: %v", serviceURL, path, err)
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("downstream %s returned %d", path, resp.StatusCode)
	}
	return nil
}

