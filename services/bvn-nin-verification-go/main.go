// BVN/NIN Verification Service — Production Implementation
//
// Calls real identity verification APIs for BVN (via NIBSS or a licensed
// provider such as Prembly/Smile Identity) and NIN (via NIMC or licensed
// provider).  Results are cached in-memory with a 24-hour TTL to respect
// upstream rate limits, persisted in PostgreSQL for audit, and published
// to Dapr pub/sub on success.
//
// Port: 8281
//
// Required environment variables:
//   BVN_API_URL        — upstream BVN endpoint (e.g. https://api.prembly.com/identitypass/verification/bvn)
//   BVN_API_KEY        — x-api-key header for BVN provider
//   NIN_API_URL        — upstream NIN endpoint
//   NIN_API_KEY        — x-api-key header for NIN provider
//   DATABASE_URL       — PostgreSQL DSN (postgresql://user:pass@host/db)
//   DAPR_URL           — Dapr sidecar URL (default: http://localhost:3500)
//   DAPR_PUBSUB        — Dapr pub/sub component name (default: bvn-nin-pubsub)
//   VERIFICATION_CACHE_TTL_HOURS — TTL for cached results (default: 24)
//
// If BVN_API_URL or NIN_API_URL are absent, the respective endpoint returns
// HTTP 503 — never fake data.

package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

// ── Configuration ─────────────────────────────────────────────────────────────

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

var (
	bvnAPIURL   = os.Getenv("BVN_API_URL")
	bvnAPIKey   = os.Getenv("BVN_API_KEY")
	ninAPIURL   = os.Getenv("NIN_API_URL")
	ninAPIKey   = os.Getenv("NIN_API_KEY")
	databaseURL = os.Getenv("DATABASE_URL")
	daprURL     = env("DAPR_URL", "http://localhost:3500")
	daprPubsub  = env("DAPR_PUBSUB", "bvn-nin-pubsub")
	cacheTTLHrs = func() time.Duration {
		h, _ := strconv.Atoi(env("VERIFICATION_CACHE_TTL_HOURS", "24"))
		if h <= 0 {
			h = 24
		}
		return time.Duration(h) * time.Hour
	}()
)

// ── Types ─────────────────────────────────────────────────────────────────────

type BVNVerification struct {
	BVN          string  `json:"bvn"`
	FirstName    string  `json:"firstName"`
	MiddleName   string  `json:"middleName"`
	LastName     string  `json:"lastName"`
	DOB          string  `json:"dateOfBirth"`
	Phone        string  `json:"phoneNumber"`
	Gender       string  `json:"gender"`
	LGA          string  `json:"lgaOfOrigin"`
	State        string  `json:"stateOfOrigin"`
	NINLinked    bool    `json:"ninLinked"`
	LinkedNIN    string  `json:"linkedNIN"`
	Verified     bool    `json:"verified"`
	MatchScore   float64 `json:"nameMatchScore"`
	VerifiedAt   string  `json:"verifiedAt"`
	APIProvider  string  `json:"apiProvider"`
	ResponseTime int     `json:"responseTimeMs"`
}

type NINVerification struct {
	NIN          string  `json:"nin"`
	FirstName    string  `json:"firstName"`
	MiddleName   string  `json:"middleName"`
	LastName     string  `json:"lastName"`
	DOB          string  `json:"dateOfBirth"`
	Phone        string  `json:"phoneNumber"`
	Gender       string  `json:"gender"`
	Address      string  `json:"residentialAddress"`
	BirthState   string  `json:"birthState"`
	BVNLinked    bool    `json:"bvnLinked"`
	LinkedBVN    string  `json:"linkedBVN"`
	Verified     bool    `json:"verified"`
	MatchScore   float64 `json:"nameMatchScore"`
	VerifiedAt   string  `json:"verifiedAt"`
	APIProvider  string  `json:"apiProvider"`
	ResponseTime int     `json:"responseTimeMs"`
}

type BVNNINLinkage struct {
	BVN           string   `json:"bvn"`
	NIN           string   `json:"nin"`
	CustomerID    string   `json:"customerId"`
	NameMatch     bool     `json:"namesMatch"`
	DOBMatch      bool     `json:"dobMatch"`
	GenderMatch   bool     `json:"genderMatch"`
	LinkStatus    string   `json:"linkageStatus"`
	VerifiedAt    string   `json:"verifiedAt"`
	Discrepancies []string `json:"discrepancies"`
}

// ── In-memory TTL cache ───────────────────────────────────────────────────────

type cacheEntry struct {
	value   interface{}
	expires time.Time
}

type ttlCache struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry
}

func newTTLCache() *ttlCache {
	c := &ttlCache{entries: make(map[string]cacheEntry)}
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			c.evict()
		}
	}()
	return c
}

func (c *ttlCache) get(key string) (interface{}, bool) {
	c.mu.RLock()
	e, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok || time.Now().After(e.expires) {
		return nil, false
	}
	return e.value, true
}

func (c *ttlCache) set(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	c.entries[key] = cacheEntry{value: value, expires: time.Now().Add(ttl)}
	c.mu.Unlock()
}

func (c *ttlCache) evict() {
	now := time.Now()
	c.mu.Lock()
	for k, e := range c.entries {
		if now.After(e.expires) {
			delete(c.entries, k)
		}
	}
	c.mu.Unlock()
}

var cache = newTTLCache()

// ── PostgreSQL persistence ─────────────────────────────────────────────────────

var db *sql.DB

func initDB() error {
	if databaseURL == "" {
		log.Println("WARN: DATABASE_URL not set — verification results will not be persisted")
		return nil
	}
	var err error
	db, err = sql.Open("postgres", databaseURL)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("ping db: %w", err)
	}
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS bvn_verifications (
			id           SERIAL PRIMARY KEY,
			bvn          TEXT NOT NULL,
			tenant_id    TEXT NOT NULL,
			first_name   TEXT,
			last_name    TEXT,
			dob          TEXT,
			verified     BOOLEAN NOT NULL,
			provider     TEXT NOT NULL,
			raw_response JSONB,
			created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE (bvn, tenant_id)
		);
		CREATE TABLE IF NOT EXISTS nin_verifications (
			id           SERIAL PRIMARY KEY,
			nin          TEXT NOT NULL,
			tenant_id    TEXT NOT NULL,
			first_name   TEXT,
			last_name    TEXT,
			dob          TEXT,
			verified     BOOLEAN NOT NULL,
			provider     TEXT NOT NULL,
			raw_response JSONB,
			created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE (nin, tenant_id)
		);
		CREATE TABLE IF NOT EXISTS bvn_nin_linkages (
			id          SERIAL PRIMARY KEY,
			bvn         TEXT NOT NULL,
			nin         TEXT NOT NULL,
			tenant_id   TEXT NOT NULL,
			customer_id TEXT,
			link_status TEXT NOT NULL,
			created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE (bvn, nin, tenant_id)
		);
	`)
	return err
}

func persistBVN(tenantID string, v *BVNVerification, raw []byte) {
	if db == nil {
		return
	}
	_, err := db.Exec(`
		INSERT INTO bvn_verifications (bvn, tenant_id, first_name, last_name, dob, verified, provider, raw_response)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (bvn, tenant_id) DO UPDATE
		  SET first_name=$3, last_name=$4, dob=$5, verified=$6, provider=$7, raw_response=$8`,
		v.BVN, tenantID, v.FirstName, v.LastName, v.DOB, v.Verified, v.APIProvider, raw,
	)
	if err != nil {
		log.Printf("WARN: persist BVN %s: %v", v.BVN, err)
	}
}

func persistNIN(tenantID string, v *NINVerification, raw []byte) {
	if db == nil {
		return
	}
	_, err := db.Exec(`
		INSERT INTO nin_verifications (nin, tenant_id, first_name, last_name, dob, verified, provider, raw_response)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (nin, tenant_id) DO UPDATE
		  SET first_name=$3, last_name=$4, dob=$5, verified=$6, provider=$7, raw_response=$8`,
		v.NIN, tenantID, v.FirstName, v.LastName, v.DOB, v.Verified, v.APIProvider, raw,
	)
	if err != nil {
		log.Printf("WARN: persist NIN %s: %v", v.NIN, err)
	}
}

// ── Dapr event publishing ─────────────────────────────────────────────────────

func publishEvent(topic string, payload interface{}) {
	b, err := json.Marshal(payload)
	if err != nil {
		log.Printf("WARN: marshal event for topic %s: %v", topic, err)
		return
	}
	url := fmt.Sprintf("%s/v1.0/publish/%s/%s", daprURL, daprPubsub, topic)
	resp, err := httpClient.Post(url, "application/json", bytes.NewReader(b))
	if err != nil {
		log.Printf("WARN: publish event topic=%s: %v", topic, err)
		return
	}
	resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("WARN: Dapr publish non-2xx topic=%s status=%d", topic, resp.StatusCode)
	}
}

// ── HTTP client ───────────────────────────────────────────────────────────────

var httpClient = &http.Client{
	Timeout: 15 * time.Second,
}

// ── NIBSS / BVN provider client ───────────────────────────────────────────────

// callBVNAPI calls the configured BVN verification API.
// Expected provider response (Prembly-compatible):
//
//	{ "status": true, "detail": { "first_name": "...", "last_name": "..., ... } }
//
// Adapt the field mapping below to match your specific provider's schema.
func callBVNAPI(bvn string) (*BVNVerification, []byte, error) {
	if bvnAPIURL == "" || bvnAPIKey == "" {
		return nil, nil, fmt.Errorf("BVN_API_URL and BVN_API_KEY are required for BVN verification")
	}

	payload, _ := json.Marshal(map[string]string{"number": bvn})
	req, err := http.NewRequest("POST", bvnAPIURL, bytes.NewReader(payload))
	if err != nil {
		return nil, nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", bvnAPIKey)
	req.Header.Set("app-id", env("BVN_APP_ID", ""))

	start := time.Now()
	resp, err := httpClient.Do(req)
	elapsed := int(time.Since(start).Milliseconds())
	if err != nil {
		return nil, nil, fmt.Errorf("upstream BVN API unreachable: %w", err)
	}
	defer resp.Body.Close()

	var buf bytes.Buffer
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return nil, nil, fmt.Errorf("read response: %w", err)
	}
	raw := buf.Bytes()

	if resp.StatusCode == 404 {
		return nil, raw, fmt.Errorf("BVN not found in NIBSS records")
	}
	if resp.StatusCode >= 400 {
		return nil, raw, fmt.Errorf("BVN API error HTTP %d: %.200s", resp.StatusCode, string(raw))
	}

	// Parse provider response — Prembly-compatible schema.
	var outer struct {
		Status  bool            `json:"status"`
		Detail  json.RawMessage `json:"detail"`
		Message string          `json:"message"`
	}
	if err := json.Unmarshal(raw, &outer); err != nil {
		return nil, raw, fmt.Errorf("parse BVN response: %w", err)
	}
	if !outer.Status {
		return nil, raw, fmt.Errorf("BVN verification rejected: %s", outer.Message)
	}

	var detail struct {
		FirstName  string `json:"first_name"`
		MiddleName string `json:"middle_name"`
		LastName   string `json:"last_name"`
		DOB        string `json:"date_of_birth"`
		Phone      string `json:"phone_number"`
		Gender     string `json:"gender"`
		LGA        string `json:"lga_of_origin"`
		State      string `json:"state_of_origin"`
		NINLinked  bool   `json:"nin_linked"`
		LinkedNIN  string `json:"nin"`
	}
	if err := json.Unmarshal(outer.Detail, &detail); err != nil {
		return nil, raw, fmt.Errorf("parse BVN detail: %w", err)
	}

	v := &BVNVerification{
		BVN:          bvn,
		FirstName:    detail.FirstName,
		MiddleName:   detail.MiddleName,
		LastName:     detail.LastName,
		DOB:          detail.DOB,
		Phone:        detail.Phone,
		Gender:       detail.Gender,
		LGA:          detail.LGA,
		State:        detail.State,
		NINLinked:    detail.NINLinked,
		LinkedNIN:    detail.LinkedNIN,
		Verified:     true,
		MatchScore:   1.0,
		VerifiedAt:   time.Now().UTC().Format(time.RFC3339),
		APIProvider:  bvnAPIURL,
		ResponseTime: elapsed,
	}
	return v, raw, nil
}

// ── NIMC / NIN provider client ────────────────────────────────────────────────

func callNINAPI(nin string) (*NINVerification, []byte, error) {
	if ninAPIURL == "" || ninAPIKey == "" {
		return nil, nil, fmt.Errorf("NIN_API_URL and NIN_API_KEY are required for NIN verification")
	}

	payload, _ := json.Marshal(map[string]string{"number": nin})
	req, err := http.NewRequest("POST", ninAPIURL, bytes.NewReader(payload))
	if err != nil {
		return nil, nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", ninAPIKey)
	req.Header.Set("app-id", env("NIN_APP_ID", ""))

	start := time.Now()
	resp, err := httpClient.Do(req)
	elapsed := int(time.Since(start).Milliseconds())
	if err != nil {
		return nil, nil, fmt.Errorf("upstream NIN API unreachable: %w", err)
	}
	defer resp.Body.Close()

	var buf bytes.Buffer
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return nil, nil, fmt.Errorf("read response: %w", err)
	}
	raw := buf.Bytes()

	if resp.StatusCode == 404 {
		return nil, raw, fmt.Errorf("NIN not found in NIMC records")
	}
	if resp.StatusCode >= 400 {
		return nil, raw, fmt.Errorf("NIN API error HTTP %d: %.200s", resp.StatusCode, string(raw))
	}

	var outer struct {
		Status  bool            `json:"status"`
		Detail  json.RawMessage `json:"detail"`
		Message string          `json:"message"`
	}
	if err := json.Unmarshal(raw, &outer); err != nil {
		return nil, raw, fmt.Errorf("parse NIN response: %w", err)
	}
	if !outer.Status {
		return nil, raw, fmt.Errorf("NIN verification rejected: %s", outer.Message)
	}

	var detail struct {
		FirstName  string `json:"first_name"`
		MiddleName string `json:"middle_name"`
		LastName   string `json:"last_name"`
		DOB        string `json:"date_of_birth"`
		Phone      string `json:"phone_number"`
		Gender     string `json:"gender"`
		Address    string `json:"residential_address"`
		BirthState string `json:"birth_state"`
		BVNLinked  bool   `json:"bvn_linked"`
		LinkedBVN  string `json:"bvn"`
	}
	if err := json.Unmarshal(outer.Detail, &detail); err != nil {
		return nil, raw, fmt.Errorf("parse NIN detail: %w", err)
	}

	v := &NINVerification{
		NIN:          nin,
		FirstName:    detail.FirstName,
		MiddleName:   detail.MiddleName,
		LastName:     detail.LastName,
		DOB:          detail.DOB,
		Phone:        detail.Phone,
		Gender:       detail.Gender,
		Address:      detail.Address,
		BirthState:   detail.BirthState,
		BVNLinked:    detail.BVNLinked,
		LinkedBVN:    detail.LinkedBVN,
		Verified:     true,
		MatchScore:   1.0,
		VerifiedAt:   time.Now().UTC().Format(time.RFC3339),
		APIProvider:  ninAPIURL,
		ResponseTime: elapsed,
	}
	return v, raw, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func tenantID(r *http.Request) string {
	if t := r.Header.Get("X-Tenant-ID"); t != "" {
		return t
	}
	return r.Header.Get("x-tenant-id")
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func handleBVNVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}
	var req struct {
		BVN        string `json:"bvn"`
		CustomerID string `json:"customerId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.BVN) == "" {
		writeError(w, http.StatusBadRequest, "bvn is required")
		return
	}
	bvn := strings.TrimSpace(req.BVN)
	tid := tenantID(r)

	cacheKey := fmt.Sprintf("bvn:%s:%s", tid, bvn)
	if cached, ok := cache.get(cacheKey); ok {
		writeJSON(w, http.StatusOK, cached)
		return
	}

	v, raw, err := callBVNAPI(bvn)
	if err != nil {
		if strings.Contains(err.Error(), "required") {
			writeError(w, http.StatusServiceUnavailable, "BVN verification service not configured: "+err.Error())
		} else if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, err.Error())
		} else {
			log.Printf("ERROR: BVN API call bvn=%s: %v", bvn, err)
			writeError(w, http.StatusBadGateway, "upstream BVN verification failed: "+err.Error())
		}
		return
	}

	cache.set(cacheKey, v, cacheTTLHrs)
	persistBVN(tid, v, raw)
	go publishEvent("kyc.bvn-verified", map[string]interface{}{
		"bvn":        bvn,
		"tenantId":   tid,
		"customerId": req.CustomerID,
		"verifiedAt": v.VerifiedAt,
	})

	writeJSON(w, http.StatusOK, v)
}

func handleNINVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}
	var req struct {
		NIN        string `json:"nin"`
		CustomerID string `json:"customerId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.NIN) == "" {
		writeError(w, http.StatusBadRequest, "nin is required")
		return
	}
	nin := strings.TrimSpace(req.NIN)
	tid := tenantID(r)

	cacheKey := fmt.Sprintf("nin:%s:%s", tid, nin)
	if cached, ok := cache.get(cacheKey); ok {
		writeJSON(w, http.StatusOK, cached)
		return
	}

	v, raw, err := callNINAPI(nin)
	if err != nil {
		if strings.Contains(err.Error(), "required") {
			writeError(w, http.StatusServiceUnavailable, "NIN verification service not configured: "+err.Error())
		} else if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, err.Error())
		} else {
			log.Printf("ERROR: NIN API call nin=%s: %v", nin, err)
			writeError(w, http.StatusBadGateway, "upstream NIN verification failed: "+err.Error())
		}
		return
	}

	cache.set(cacheKey, v, cacheTTLHrs)
	persistNIN(tid, v, raw)
	go publishEvent("kyc.nin-verified", map[string]interface{}{
		"nin":        nin,
		"tenantId":   tid,
		"customerId": req.CustomerID,
		"verifiedAt": v.VerifiedAt,
	})

	writeJSON(w, http.StatusOK, v)
}

func handleBVNNINLinkage(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}
	var req struct {
		BVN        string `json:"bvn"`
		NIN        string `json:"nin"`
		CustomerID string `json:"customerId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	bvn := strings.TrimSpace(req.BVN)
	nin := strings.TrimSpace(req.NIN)
	if bvn == "" || nin == "" {
		writeError(w, http.StatusBadRequest, "bvn and nin are required")
		return
	}
	tid := tenantID(r)

	cacheKey := fmt.Sprintf("link:%s:%s:%s", tid, bvn, nin)
	if cached, ok := cache.get(cacheKey); ok {
		writeJSON(w, http.StatusOK, cached)
		return
	}

	// Verify both independently and cross-check demographic fields.
	bvnResult, _, bvnErr := callBVNAPI(bvn)
	ninResult, _, ninErr := callNINAPI(nin)

	if bvnErr != nil || ninErr != nil {
		code := http.StatusBadGateway
		msg := fmt.Sprintf("BVN error: %v | NIN error: %v", bvnErr, ninErr)
		if strings.Contains(fmt.Sprintf("%v%v", bvnErr, ninErr), "required") {
			code = http.StatusServiceUnavailable
		}
		writeError(w, code, msg)
		return
	}

	discrepancies := []string{}
	nameMatch := strings.EqualFold(bvnResult.LastName, ninResult.LastName) &&
		strings.EqualFold(bvnResult.FirstName, ninResult.FirstName)
	dobMatch := bvnResult.DOB == ninResult.DOB
	genderMatch := strings.EqualFold(bvnResult.Gender, ninResult.Gender)

	if !nameMatch {
		discrepancies = append(discrepancies, "name_mismatch")
	}
	if !dobMatch {
		discrepancies = append(discrepancies, "dob_mismatch")
	}
	if !genderMatch {
		discrepancies = append(discrepancies, "gender_mismatch")
	}

	status := "verified"
	if len(discrepancies) > 0 {
		status = "discrepancy_detected"
	}

	linkage := &BVNNINLinkage{
		BVN:           bvn,
		NIN:           nin,
		CustomerID:    req.CustomerID,
		NameMatch:     nameMatch,
		DOBMatch:      dobMatch,
		GenderMatch:   genderMatch,
		LinkStatus:    status,
		VerifiedAt:    time.Now().UTC().Format(time.RFC3339),
		Discrepancies: discrepancies,
	}

	cache.set(cacheKey, linkage, cacheTTLHrs)

	if db != nil {
		_, err := db.Exec(`
			INSERT INTO bvn_nin_linkages (bvn, nin, tenant_id, customer_id, link_status)
			VALUES ($1,$2,$3,$4,$5)
			ON CONFLICT (bvn, nin, tenant_id) DO UPDATE SET link_status=$5`,
			bvn, nin, tid, req.CustomerID, status,
		)
		if err != nil {
			log.Printf("WARN: persist linkage bvn=%s nin=%s: %v", bvn, nin, err)
		}
	}

	topic := "kyc.bvn-nin-linked"
	if len(discrepancies) > 0 {
		topic = "kyc.verification-failed"
	}
	go publishEvent(topic, map[string]interface{}{
		"bvn":           bvn,
		"nin":           nin,
		"tenantId":      tid,
		"customerId":    req.CustomerID,
		"linkStatus":    status,
		"discrepancies": discrepancies,
	})

	writeJSON(w, http.StatusOK, linkage)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	checks := map[string]string{}

	// DB check
	if db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			checks["postgres"] = "unreachable: " + err.Error()
		} else {
			checks["postgres"] = "connected"
		}
	} else {
		checks["postgres"] = "not configured"
	}

	// BVN provider config
	if bvnAPIURL != "" {
		checks["bvn_provider"] = "configured"
	} else {
		checks["bvn_provider"] = "NOT CONFIGURED — BVN_API_URL missing"
	}

	// NIN provider config
	if ninAPIURL != "" {
		checks["nin_provider"] = "configured"
	} else {
		checks["nin_provider"] = "NOT CONFIGURED — NIN_API_URL missing"
	}

	// Determine overall health
	healthy := bvnAPIURL != "" && ninAPIURL != ""
	status := "healthy"
	code := http.StatusOK
	if !healthy {
		status = "degraded"
		code = http.StatusServiceUnavailable
	}

	writeJSON(w, code, map[string]interface{}{
		"service": "bvn-nin-verification-go",
		"status":  status,
		"checks":  checks,
	})
}

// ── Entry point ───────────────────────────────────────────────────────────────

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jwtRealmURL() string {
	return getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
}

func fetchJWKS(realmURL string) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, _ := base64.RawURLEncoding.DecodeString(k.N)
		eBytes, _ := base64.RawURLEncoding.DecodeString(k.E)
		if len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		for range time.Tick(5 * time.Minute) {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// tenantFromClaims derives the tenant ONLY from verified token claims — never
// from caller-supplied headers or parameters.
func tenantFromClaims(claims map[string]interface{}) string {
	for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
		if s, ok := claims[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + expiry). Fail-closed: requests without a verifiable token
// get 401. Only health/metrics probes are exempt. Tenant identity is derived
// from the verified claims and stamped onto X-Tenant-ID, overwriting any
// caller-supplied value.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "bvn-nin-verification-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "bvn-nin-verification-go")
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		json.Unmarshal(headerBytes, &header)
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}

		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}

		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		if sub, ok := claims["sub"].(string); ok {
			r.Header.Set("X-User-Id", sub)
		}
		// Tenant identity comes ONLY from verified claims; overwrite any
		// caller-supplied tenant header before invoking the handler.
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func main() {
	startJWKSRefresh()

	log.SetFlags(log.LstdFlags | log.Lshortfile)

	if err := initDB(); err != nil {
		log.Printf("WARN: database init failed: %v — proceeding without persistence", err)
	}

	if bvnAPIURL == "" {
		log.Println("WARN: BVN_API_URL not set — BVN verification endpoints will return 503")
	}
	if ninAPIURL == "" {
		log.Println("WARN: NIN_API_URL not set — NIN verification endpoints will return 503")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/api/bvn/verify", handleBVNVerify)
	mux.HandleFunc("/api/nin/verify", handleNINVerify)
	mux.HandleFunc("/api/bvn-nin/check", handleBVNNINLinkage)

	port := env("PORT", "8281")
	log.Printf("bvn-nin-verification-go listening on :%s", port)
	if err := http.ListenAndServe(":"+port, jwtAuthMiddleware(mux)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
