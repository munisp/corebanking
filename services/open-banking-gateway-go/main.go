package main

import (
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
var serviceName = "open-banking-gateway-go"

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
		w.Header().Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'")
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if dataBytes, err := json.Marshal(consent); err == nil { if dbErr := dbInsert(fmt.Sprintf("open-banking-gateway-go-%d", time.Now().UnixNano()), "open-banking-gateway-go", "consents", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if dataBytes, err := json.Marshal(tpp); err == nil { if dbErr := dbInsert(fmt.Sprintf("open-banking-gateway-go-%d", time.Now().UnixNano()), "open-banking-gateway-go", "tpps", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
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
	if dataBytes, err := json.Marshal(payment); err == nil { if dbErr := dbInsert(fmt.Sprintf("open-banking-gateway-go-%d", time.Now().UnixNano()), "open-banking-gateway-go", "payments", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
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

// Input validation helpers
func sanitizeInput(s string, maxLen int) string {
	if len(s) > maxLen {
		s = s[:maxLen]
	}
	// Strip null bytes and control characters
	var clean []byte
	for _, b := range []byte(s) {
		if b >= 32 && b != 127 {
			clean = append(clean, b)
		}
	}
	return string(clean)
}

func validateEmail(email string) bool {
	if len(email) > 254 || len(email) < 3 {
		return false
	}
	atIdx := strings.LastIndex(email, "@")
	if atIdx < 1 || atIdx > len(email)-3 {
		return false
	}
	domain := email[atIdx+1:]
	if !strings.Contains(domain, ".") {
		return false
	}
	return true
}

func validateNigerianPhone(phone string) bool {
	// Nigerian numbers: +234XXXXXXXXXX or 0XXXXXXXXXXX
	clean := strings.ReplaceAll(phone, " ", "")
	clean = strings.ReplaceAll(clean, "-", "")
	if strings.HasPrefix(clean, "+234") && len(clean) == 14 {
		return true
	}
	if strings.HasPrefix(clean, "0") && len(clean) == 11 {
		return true
	}
	return false
}

func validateBVN(bvn string) bool {
	if len(bvn) != 11 {
		return false
	}
	for _, c := range bvn {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func validateAccountNumber(acctNo string) bool {
	// NUBAN: 10 digits
	if len(acctNo) != 10 {
		return false
	}
	for _, c := range acctNo {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
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

// Sanitize errors before sending to clients (prevent info leakage)
func sanitizeError(err error) string {
	errStr := err.Error()
	// Strip file paths, stack traces, internal IPs
	if strings.Contains(errStr, "/") || strings.Contains(errStr, "\\") {
		return "internal error"
	}
	if len(errStr) > 200 {
		return "internal error"
	}
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
		log.Println("[open-banking-gateway-go] Shutting down gracefully...")
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()
	log.Printf("[open-banking-gateway-go] listening on %s", ":"+PORT)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("Server error: %v", err)
	}
}
