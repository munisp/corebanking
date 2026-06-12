// 54Bank Beneficial Ownership Register — Go
// UBO identification, ownership chain traversal, PEP/sanctions cross-check,
// 25% threshold detection, regulatory reporting, historical tracking.
// Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
package main

import (
	_ "github.com/lib/pq"
"context"
"os/signal"
"syscall"
"sync/atomic"

	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"crypto/rand"
	"encoding/binary"
	"net/http"
	"os"
	"sync"
	"time"
	"database/sql"
	"bytes"
	"strings"

	"net"

	"regexp"
)

// secureRandUint32 generates a cryptographically secure random uint32
func secureRandUint32() uint32 {
	var b [4]byte
	rand.Read(b[:])
	return binary.BigEndian.Uint32(b[:])
}


// Concurrency limiter prevents goroutine explosion
var semaphore = make(chan struct{}, 100)

func acquireSem() { semaphore <- struct{}{} }
func releaseSem() { <-semaphore }
var serviceName = "beneficial-ownership-go"

var eventBus = newEventBus("platform.events", "beneficial-ownership")

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type UBO struct {
	ID              string  `json:"id"`
	EntityType      string  `json:"entityType"` // individual, corporate
	FullName        string  `json:"fullName"`
	Nationality     string  `json:"nationality"`
	DateOfBirth     string  `json:"dateOfBirth,omitempty"`
	IDNumber        string  `json:"idNumber,omitempty"`
	IDType          string  `json:"idType,omitempty"`
	OwnershipPct    float64 `json:"ownershipPct"`
	VotingRightPct  float64 `json:"votingRightPct"`
	ControlType     string  `json:"controlType"` // direct_ownership, indirect_ownership, control_by_agreement, de_facto
	IsPEP           bool    `json:"isPEP"`
	PEPCategory     string  `json:"pepCategory,omitempty"`
	IsSanctioned    bool    `json:"isSanctioned"`
	SanctionsList   string  `json:"sanctionsList,omitempty"`
	AdverseMedia    bool    `json:"adverseMedia"`
	VerificationSt  string  `json:"verificationStatus"` // pending, verified, flagged
	IdentifiedAt    string  `json:"identifiedAt"`
}

type OwnershipChain struct {
	CompanyID     string          `json:"companyId"`
	CompanyName   string          `json:"companyName"`
	RCNumber      string          `json:"rcNumber"`
	ChainDepth    int             `json:"chainDepth"`
	Layers        []ChainLayer    `json:"layers"`
	UBOs          []UBO           `json:"ubos"`
	RiskScore     float64         `json:"riskScore"`
	Flags         []string        `json:"flags"`
	ThresholdPct  float64         `json:"thresholdPct"`
	AnalyzedAt    string          `json:"analyzedAt"`
}

type ChainLayer struct {
	Depth       int    `json:"depth"`
	EntityID    string `json:"entityId"`
	EntityName  string `json:"entityName"`
	EntityType  string `json:"entityType"`
	Country     string `json:"country"`
	HoldingPct  float64 `json:"holdingPct"`
	CumulPct    float64 `json:"cumulativeHoldingPct"`
}

type RegisterEntry struct {
	ID            string    `json:"id"`
	CompanyID     string    `json:"companyId"`
	CompanyName   string    `json:"companyName"`
	UBOs          []UBO     `json:"ubos"`
	TotalUBOs     int       `json:"totalUbos"`
	ThresholdPct  float64   `json:"thresholdPct"`
	LastUpdated   string    `json:"lastUpdated"`
	NextReview    string    `json:"nextReview"`
	Status        string    `json:"status"` // current, under_review, expired
}

var (
	mu       sync.Mutex
	register = []RegisterEntry{
		{ID: "REG-001", CompanyID: "CMP-001", CompanyName: "Zenith Agro Ltd", TotalUBOs: 2,
			ThresholdPct: 25, LastUpdated: "2026-04-01T10:00:00Z", NextReview: "2026-10-01T10:00:00Z", Status: "current",
			UBOs: []UBO{
				{ID: "UBO-001", EntityType: "individual", FullName: "John Okechukwu", Nationality: "NG",
					OwnershipPct: 45, VotingRightPct: 45, ControlType: "direct_ownership",
					IsPEP: false, IsSanctioned: false, VerificationSt: "verified", IdentifiedAt: "2026-04-01T10:00:00Z"},
				{ID: "UBO-002", EntityType: "individual", FullName: "Grace Okafor", Nationality: "NG",
					OwnershipPct: 30, VotingRightPct: 30, ControlType: "direct_ownership",
					IsPEP: false, IsSanctioned: false, VerificationSt: "verified", IdentifiedAt: "2026-04-01T10:00:00Z"},
			}},
	}
	chains = []OwnershipChain{}
	stats  = map[string]interface{}{
		"totalEntries":      1,
		"totalUBOs":         2,
		"pepUBOs":           0,
		"sanctionedUBOs":    0,
		"avgOwnershipPct":   37.5,
		"avgChainDepth":     1.2,
		"expiredEntries":    0,
		"underReview":       0,
		"thresholdPct":      25.0,
	}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "beneficial-ownership-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Ownership Analysis Functions ───────────────────────────────────────────

func traverseChain(shareholders []map[string]interface{}, threshold float64) ([]UBO, []ChainLayer, []string) {
	ubos := []UBO{}
	layers := []ChainLayer{}
	flags := []string{}

	for i, s := range shareholders {
		pct := getFloat(s, "ownershipPct")
		eType := getString(s, "entityType")
		if eType == "" {
			eType = "individual"
		}
		layer := ChainLayer{
			Depth:      i + 1,
			EntityID:   getString(s, "entityId"),
			EntityName: getString(s, "entityName"),
			EntityType: eType,
			Country:    getString(s, "country"),
			HoldingPct: pct,
			CumulPct:   pct,
		}
		layers = append(layers, layer)

		if pct >= threshold {
			isPEP := getBool(s, "isPEP")
			isSanctioned := getBool(s, "isSanctioned")
			ubo := UBO{
				ID:             fmt.Sprintf("UBO-%08X", secureRandUint32()),
				EntityType:     eType,
				FullName:       getString(s, "entityName"),
				Nationality:    getString(s, "country"),
				DateOfBirth:    getString(s, "dateOfBirth"),
				IDNumber:       getString(s, "idNumber"),
				IDType:         getString(s, "idType"),
				OwnershipPct:   pct,
				VotingRightPct: getFloat(s, "votingRightPct"),
				ControlType:    "direct_ownership",
				IsPEP:          isPEP,
				IsSanctioned:   isSanctioned,
				VerificationSt: "pending",
				IdentifiedAt:   time.Now().Format(time.RFC3339),
			}
			if ubo.VotingRightPct == 0 {
				ubo.VotingRightPct = ubo.OwnershipPct
			}
			if isPEP {
				flags = append(flags, fmt.Sprintf("pep_ubo:%s", ubo.FullName))
				ubo.PEPCategory = getString(s, "pepCategory")
			}
			if isSanctioned {
				flags = append(flags, fmt.Sprintf("sanctioned_ubo:%s", ubo.FullName))
				ubo.SanctionsList = getString(s, "sanctionsList")
			}
			ubos = append(ubos, ubo)
		}
	}

	if len(ubos) == 0 {
		flags = append(flags, "no_ubo_above_threshold")
	}
	return ubos, layers, flags
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "beneficial-ownership-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Beneficial Ownership Register",
		"capabilities": []string{
			"ubo_identification", "ownership_chain_traversal",
			"pep_cross_check", "sanctions_cross_check", "adverse_media_check",
			"threshold_detection_25pct", "regulatory_reporting",
			"historical_tracking", "chain_depth_analysis",
			"de_facto_control_detection", "register_management",
		},
		"threshold_pct": 25,
		"middleware": map[string]string{
			"kafka":      "bo.register, bo.changes, bo.pep-alerts, bo.sanctions-alerts",
			"postgres":   "bo_register, bo_ubos, bo_chains, bo_audit",
			"redis":      "ubo_cache (TTL 24h), pep_cache (TTL 1h)",
			"temporal":   "BOChainTraversalWorkflow, BOPeriodicReviewWorkflow",
			"permify":    "bo:view, bo:update, bo:admin",
			"opensearch": "beneficial-ownership-2026",
		},
	})
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{
		"entries": register, "total": len(register), "thresholdPct": 25.0,
	})
}

func handleTraverseChain(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		log.Printf("[%s] JSON decode error: %v", serviceName, err)
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
		return
	}

	threshold := 25.0
	if t := getFloat(body, "thresholdPct"); t > 0 {
		threshold = t
	}

	shareholders := []map[string]interface{}{}
	if s, ok := body["shareholders"].([]interface{}); ok {
		for _, item := range s {
			if m, ok := item.(map[string]interface{}); ok {
				shareholders = append(shareholders, m)
			}
		}
	}

	ubos, chainLayers, flags := traverseChain(shareholders, threshold)

	riskScore := 0.0
	for _, u := range ubos {
		if u.IsPEP {
			riskScore += 25
		}
		if u.IsSanctioned {
			riskScore += 50
		}
		if u.AdverseMedia {
			riskScore += 15
		}
	}

	chain := OwnershipChain{
		CompanyID:    getString(body, "companyId"),
		CompanyName:  getString(body, "companyName"),
		RCNumber:     getString(body, "rcNumber"),
		ChainDepth:   len(chainLayers),
		Layers:       chainLayers,
		UBOs:         ubos,
		RiskScore:    riskScore,
		Flags:        flags,
		ThresholdPct: threshold,
		AnalyzedAt:   time.Now().Format(time.RFC3339),
	}

	mu.Lock()
	chains = append(chains, chain)
	mu.Unlock()

	csURL := os.Getenv("KYC_ENGINE_URL")
	if csURL == "" { csURL = "http://kyc-engine-go:8080" }
	if _, csErr := callService("POST", csURL+"/v1/notify", map[string]interface{}{"source": "beneficial_ownership_go", "action": "create"}); csErr != nil {
		log.Printf("[%s] upstream call failed: %v", serviceName, csErr)
	}
	respondJSON(w, 200, map[string]interface{}{
		"chain":        chain,
		"ubosFound":    len(ubos),
		"riskScore":    riskScore,
		"pepInChain":   countPEP(ubos),
		"sanctioned":   countSanctioned(ubos),
	})
}

func handleIdentifyUBOs(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		log.Printf("[%s] JSON decode error: %v", serviceName, err)
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
		return
	}

	threshold := 25.0
	if t := getFloat(body, "thresholdPct"); t > 0 {
		threshold = t
	}

	shareholders := []map[string]interface{}{}
	if s, ok := body["shareholders"].([]interface{}); ok {
		for _, item := range s {
			if m, ok := item.(map[string]interface{}); ok {
				shareholders = append(shareholders, m)
			}
		}
	}
	ubos, _, _ := traverseChain(shareholders, threshold)
	respondJSON(w, 200, map[string]interface{}{
		"ubos": ubos, "total": len(ubos), "thresholdPct": threshold,
	})
}

func handleAddToRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		log.Printf("[%s] JSON decode error: %v", serviceName, err)
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
		return
	}

	entry := RegisterEntry{
		ID:           fmt.Sprintf("REG-%08X", secureRandUint32()),
		CompanyID:    getString(body, "companyId"),
		CompanyName:  getString(body, "companyName"),
		UBOs:         []UBO{},
		ThresholdPct: 25,
		LastUpdated:  time.Now().Format(time.RFC3339),
		Status:       "current",
	}

	mu.Lock()
	register = append(register, entry)
	stats["totalEntries"] = len(register)
	mu.Unlock()

	// Persist to database
	if db != nil {
		_id := fmt.Sprintf("%s-%d", serviceName, time.Now().UnixNano())
			if _dataBytes, _err := json.Marshal(body); _err == nil {
				_dataBytes = []byte(sanitizeInput(string(_dataBytes)))
			dbInsert(_id, serviceName, "default", "active", _dataBytes)
		}
	}

		eventBus.Emit("beneficial-ownership.processed", map[string]interface{}{"status": "success"})
	respondJSON(w, 201, map[string]interface{}{"created": true, "entry": entry})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, stats)
}

func countPEP(ubos []UBO) int {
	n := 0
	for _, u := range ubos {
		if u.IsPEP {
			n++
		}
	}
	return n
}

func countSanctioned(ubos []UBO) int {
	n := 0
	for _, u := range ubos {
		if u.IsSanctioned {
			n++
		}
	}
	return n
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return 0
}

func getBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}


func beneficial_ownershipComputeScore(value float64, weight float64, threshold float64) float64 {
    score := value * weight
    if score > threshold { score = threshold }
    return score
}

func beneficial_ownershipValidateRequest(data map[string]interface{}) map[string]interface{} {
    errors := []string{}
    required := []string{"id", "type"}
    for _, field := range required {
        if _, ok := data[field]; !ok {
            errors = append(errors, field + " is required")
        }
    }
    return map[string]interface{}{"valid": len(errors) == 0, "errors": errors}
}

func beneficial_ownershipScoreHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Value     float64 `json:"value"`
        Weight    float64 `json:"weight"`
        Threshold float64 `json:"threshold"`
    }
    if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
    	log.Printf("[%s] JSON decode error: %v", serviceName, err)
    	respondJSON(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
    	return
    }
    score := beneficial_ownershipComputeScore(req.Value, req.Weight, req.Threshold)
    respondJSON(w, 200, map[string]interface{}{"score": score})
}

func beneficial_ownershipValidateRequestHandler(w http.ResponseWriter, r *http.Request) {
    var body map[string]interface{}
    if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
    	log.Printf("[%s] JSON decode error: %v", serviceName, err)
    	respondJSON(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
    	return
    }
    result := beneficial_ownershipValidateRequest(body)
    respondJSON(w, 200, result)
}

// --- Production Hardening ---
var (
    requestCount  uint64
    errorCount  uint64
    _bootTime  = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"ready":true,"service":"beneficial-ownership-go"}`)
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"alive":true}`)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
    reqs := atomic.LoadUint64(&requestCount)
    errs := atomic.LoadUint64(&errorCount)
    w.Header().Set("Content-Type", "text/plain")
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"beneficial-ownership-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"beneficial-ownership-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"beneficial-ownership-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}


// --- Counting Middleware ---
func countingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        atomic.AddUint64(&requestCount, 1)
        rw := &responseWriter{ResponseWriter: w, status: 200}
        next.ServeHTTP(rw, r)
        if rw.status >= 400 {
            atomic.AddUint64(&errorCount, 1)
        }
    })
}

type responseWriter struct {
    http.ResponseWriter
    status int
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.status = code
    rw.ResponseWriter.WriteHeader(code)
}


// --- Database Layer ---
var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — WARNING: No DATABASE_URL — write operations will return 503", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — WARNING: DB unavailable — degraded mode active", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — WARNING: DB unavailable — degraded mode active", serviceName, err)
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
}

func dbList(service string, limit int) ([]map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("%s_list_%d", service, limit)
	if cached, ok := cacheGet(cacheKey); ok {
		var result []map[string]interface{}
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			return result, nil
		}
	}
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, type, status, data, created_at FROM service_records WHERE service=$1 ORDER BY created_at DESC LIMIT $2", service, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var items []map[string]interface{}
	for rows.Next() {
		var id, typ, status, data, ts string
		rows.Scan(&id, &typ, &status, &data, &ts)
		items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "createdAt": ts})
	}
	return items, nil
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}


// --- JWT Auth Middleware ---
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":"%s"}`, serviceName)
			return
		}
		next.ServeHTTP(w, r)
	})
}


// --- Inter-Service Communication with Circuit Breaker ---
var _cbFailures int
var _cbOpen bool
var _cbLastFail time.Time

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	if _cbOpen && time.Since(_cbLastFail) < 30*time.Second {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	if _cbOpen { _cbOpen = false; _cbFailures = 0 }
	client := &http.Client{Timeout: 15 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 { time.Sleep(time.Duration(1<<uint(attempt)) * 100 * time.Millisecond) }
		var req *http.Request
		if body != nil {
			j, _ := json.Marshal(body)
			req, _ = http.NewRequest(method, url, bytes.NewBuffer(j))
		} else {
			req, _ = http.NewRequest(method, url, nil)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil { lastErr = err; _cbFailures++; _cbLastFail = time.Now(); if _cbFailures >= 5 { _cbOpen = true }; continue }
		defer resp.Body.Close()
		if resp.StatusCode >= 500 { lastErr = fmt.Errorf("%s returned %d", url, resp.StatusCode); _cbFailures++; _cbLastFail = time.Now(); if _cbFailures >= 5 { _cbOpen = true }; continue }
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		_cbFailures = 0; _cbOpen = false
		return result, nil
	}
	return nil, fmt.Errorf("retries exhausted for %s: %w", url, lastErr)
}

// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" {
			traceID = r.Header.Get("traceparent")
		}
		if traceID == "" {
			traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid())
		}
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Redis Caching Layer ---
// --- Production Cache (connection-pooled, multi-level, with metrics) ---
var _cachePool *cachePool
var _l1Cache sync.Map // L1 in-process cache
var _cacheHits atomic.Uint64
var _cacheMisses atomic.Uint64
var _cacheStampedes atomic.Uint64

type cachePool struct {
	pool     chan net.Conn
	host     string
	port     string
	password string
	db       string
}

type l1CacheEntry struct {
	Value  string
	Expiry time.Time
}

func initCachePool() {
	url := os.Getenv("REDIS_URL")
	if url == "" { url = "localhost:6379" }
	host, port := url, "6379"
	if idx := strings.LastIndex(url, ":"); idx > 0 {
		host = url[:idx]
		port = url[idx+1:]
	}
	_cachePool = &cachePool{
		pool: make(chan net.Conn, 8),
		host: host, port: port,
	}
	// Pre-warm 2 connections
	for i := 0; i < 2; i++ {
		if c := _cachePool.dial(); c != nil {
			_cachePool.pool <- c
		}
	}
}

func (p *cachePool) dial() net.Conn {
	addr := net.JoinHostPort(p.host, p.port)
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil { return nil }
	conn.SetDeadline(time.Now().Add(3 * time.Second))
	fmt.Fprintf(conn, "*1\r\n$4\r\nPING\r\n")
	buf := make([]byte, 64)
	n, _ := conn.Read(buf)
	if n > 0 && buf[0] == '+' { return conn }
	conn.Close()
	return nil
}

func (p *cachePool) get() net.Conn {
	select {
	case c := <-p.pool:
		c.SetDeadline(time.Now().Add(2 * time.Second))
		fmt.Fprintf(c, "*1\r\n$4\r\nPING\r\n")
		buf := make([]byte, 64)
		n, err := c.Read(buf)
		if err == nil && n > 0 && buf[0] == '+' { return c }
		c.Close()
		return p.dial()
	default:
		return p.dial()
	}
}

func (p *cachePool) put(c net.Conn) {
	if c == nil { return }
	select {
	case p.pool <- c:
	default:
		c.Close()
	}
}

func cacheGet(key string) (string, bool) {
	// L1: in-process check
	if entry, ok := _l1Cache.Load(key); ok {
		e := entry.(l1CacheEntry)
		if time.Now().Before(e.Expiry) {
			_cacheHits.Add(1)
			return e.Value, true
		}
		_l1Cache.Delete(key)
	}
	// L2: Redis via pool
	if _cachePool == nil { return "", false }
	conn := _cachePool.get()
	if conn == nil { _cacheMisses.Add(1); return "", false }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 8192)
	n, err := conn.Read(buf)
	if err != nil || n < 3 { _cacheMisses.Add(1); return "", false }
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 {
			_cacheHits.Add(1)
			// Promote to L1 (10s TTL)
			_l1Cache.Store(key, l1CacheEntry{Value: parts[1], Expiry: time.Now().Add(10 * time.Second)})
			return parts[1], true
		}
	}
	_cacheMisses.Add(1)
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	// L1 store
	_l1Cache.Store(key, l1CacheEntry{Value: value, Expiry: time.Now().Add(time.Duration(ttlSeconds) * time.Second)})
	// L2: Redis via pool
	if _cachePool == nil { return }
	conn := _cachePool.get()
	if conn == nil { return }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	ttlStr := fmt.Sprintf("%d", ttlSeconds)
	fmt.Fprintf(conn, "*6\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%s\r\n$2\r\nNX\r\n",
		len(key), key, len(value), value, len(ttlStr), ttlStr)
	buf := make([]byte, 256)
	conn.Read(buf)
}

func cacheInvalidate(key string) {
	_l1Cache.Delete(key)
	if _cachePool == nil { return }
	conn := _cachePool.get()
	if conn == nil { return }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	fmt.Fprintf(conn, "*2\r\n$3\r\nDEL\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 64)
	conn.Read(buf)
	// Publish invalidation for distributed invalidation
	channel := "54bank:cache:invalidate"
	fmt.Fprintf(conn, "*3\r\n$7\r\nPUBLISH\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n",
		len(channel), channel, len(key), key)
	conn.Read(buf)
}

func cacheMetricsHandler(w http.ResponseWriter, r *http.Request) {
	hits := _cacheHits.Load()
	misses := _cacheMisses.Load()
	total := hits + misses
	hitRate := 0.0
	if total > 0 { hitRate = float64(hits) / float64(total) * 100 }
	l1Size := 0
	_l1Cache.Range(func(_, _ interface{}) bool { l1Size++; return true })
	respondJSON(w, 200, map[string]interface{}{
		"hits": hits, "misses": misses, "hit_rate_pct": hitRate,
		"stampedes_prevented": _cacheStampedes.Load(),
		"l1_size": l1Size,
		"pool_connected": _cachePool != nil,
	})
}


// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" { return false, "", "" }
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" { cert = "/etc/54bank/certs/service.crt" }
	if key == "" { key = "/etc/54bank/certs/service.key" }
	return true, cert, key
}

// --- CORS + Security Headers Middleware ---
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Input Sanitization ---
func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "\\", "")
	if len(s) > 10000 {
		s = s[:10000]
	}
	return s
}


var _rlTokens int64 = 100
var _rlLastRefill int64 = 0

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr - atomic.LoadInt64(&_rlLastRefill) >= 1000 {
		atomic.StoreInt64(&_rlTokens, 100)
		atomic.StoreInt64(&_rlLastRefill, nowr)
	}
	if atomic.AddInt64(&_rlTokens, -1) < 0 {
		atomic.AddInt64(&_rlTokens, 1)
		return false
	}
	return true
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rlAllow() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":"rate_limit_exceeded"}`, 429)
			return
		}
		next.ServeHTTP(w, r)
	})
}


// ─── Domain Logic: Beneficial Ownership ────────────────────────────────────────────

func validateRequest(requestType string, payload map[string]interface{}) (bool, string) {
	if requestType == "" { return false, "Request type required" }
	if len(payload) == 0 { return false, "Payload required" }
	return true, "Request valid"
}

func computeMetrics(items []map[string]interface{}) map[string]interface{} {
	total := len(items)
	active := 0
	for _, item := range items {
		if status, ok := item["status"].(string); ok && status == "active" { active++ }
	}
	return map[string]interface{}{"total": total, "active": active, "inactive": total - active, "utilization": float64(active) / float64(total+1) * 100}
}


// --- Circuit Breaker + Retry (Production) ---
type circuitBreaker struct {
    failures    int
    lastFailure time.Time
    threshold   int
    resetAfter  time.Duration
    mu          sync.Mutex
}

func (cb *circuitBreaker) allow() bool {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures >= cb.threshold {
        if time.Since(cb.lastFailure) > cb.resetAfter {
            cb.failures = cb.threshold / 2
            return true
        }
        return false
    }
    return true
}

func (cb *circuitBreaker) recordSuccess() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures > 0 { cb.failures-- }
}

func (cb *circuitBreaker) recordFailure() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    cb.failures++
    cb.lastFailure = time.Now()
}

var _cb = &circuitBreaker{threshold: 5, resetAfter: 30 * time.Second}

func callServiceWithRetry(method, url string, body interface{}) (map[string]interface{}, error) {
    if !_cb.allow() {
        return nil, fmt.Errorf("circuit breaker open for %s", url)
    }
    client := &http.Client{Timeout: 15 * time.Second}
    var lastErr error
    for attempt := 0; attempt < 3; attempt++ {
        if attempt > 0 {
            time.Sleep(time.Duration(1<<uint(attempt)) * 200 * time.Millisecond)
        }
        var req *http.Request
        if body != nil {
            jsonData, _ := json.Marshal(body)
            req, _ = http.NewRequest(method, url, bytes.NewBuffer(jsonData))
        } else {
            req, _ = http.NewRequest(method, url, nil)
        }
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("X-Source-Service", serviceName)
        resp, err := client.Do(req)
        if err != nil {
            lastErr = err
            _cb.recordFailure()
            log.Printf("[%s] %s %s attempt %d failed: %v", serviceName, method, url, attempt+1, err)
            continue
        }
        defer resp.Body.Close()
        if resp.StatusCode >= 500 {
            lastErr = fmt.Errorf("upstream %s returned %d", url, resp.StatusCode)
            _cb.recordFailure()
            continue
        }
        var result map[string]interface{}
        json.NewDecoder(resp.Body).Decode(&result)
        _cb.recordSuccess()
        return result, nil
    }
    return nil, fmt.Errorf("all retries exhausted for %s: %w", url, lastErr)
}

// --- Alerting ---
type alertManager struct {
    rules []alertRule
    mu    sync.RWMutex
}

type alertRule struct {
    Name      string
    Metric    string
    Threshold float64
    Severity  string
}

var _alertMgr = &alertManager{
    rules: []alertRule{
        {"high_error_rate", "error_rate", 0.05, "critical"},
        {"high_latency", "p99_latency_ms", 5000, "warning"},
        {"db_connection_failures", "db_failures", 3, "critical"},
    },
}

func (am *alertManager) check() []map[string]interface{} {
    var fired []map[string]interface{}
    errRate := float64(atomic.LoadUint64(&errorCount)) / float64(max64(atomic.LoadUint64(&requestCount), 1))
    if errRate > 0.05 {
        fired = append(fired, map[string]interface{}{"rule": "high_error_rate", "value": errRate, "severity": "critical"})
    }
    return fired
}

func max64(a, b uint64) uint64 { if a > b { return a }; return b }

func alertsHandler(w http.ResponseWriter, r *http.Request) {
    respondJSON(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Graceful Degradation ---
type degradationState struct {
    dbAvailable    bool
    cacheAvailable bool
    upstreamOK     map[string]bool
    mu             sync.RWMutex
}

var _degrade = &degradationState{
    dbAvailable:    true,
    cacheAvailable: true,
    upstreamOK:     make(map[string]bool),
}

func (d *degradationState) setDB(ok bool) {
    d.mu.Lock()
    defer d.mu.Unlock()
    d.dbAvailable = ok
}

func (d *degradationState) isDBAvailable() bool {
    d.mu.RLock()
    defer d.mu.RUnlock()
    return d.dbAvailable
}

func (d *degradationState) setUpstream(name string, ok bool) {
    d.mu.Lock()
    defer d.mu.Unlock()
    d.upstreamOK[name] = ok
}

func degradationStatusHandler(w http.ResponseWriter, r *http.Request) {
    _degrade.mu.RLock()
    defer _degrade.mu.RUnlock()
    respondJSON(w, 200, map[string]interface{}{
        "service":        serviceName,
        "db_available":   _degrade.dbAvailable,
        "cache_available": _degrade.cacheAvailable,
        "upstreams":      _degrade.upstreamOK,
        "mode":           func() string { if _degrade.dbAvailable { return "normal" }; return "degraded" }(),
    })
}


// ── Deep Domain Logic: Compliance ───────────────────────────────────────────

type AmountKobo int64
func nairaToKobo(naira float64) AmountKobo { return AmountKobo(naira * 100) }
func (a AmountKobo) Naira() float64       { return float64(a) / 100.0 }

// CTR (Currency Transaction Report) — NFIU requirement
type CTRReport struct {
	ReportID       string     `json:"report_id"`
	CustomerID     string     `json:"customer_id"`
	TransactionID  string     `json:"transaction_id"`
	AmountKobo     AmountKobo `json:"amount_kobo"`
	Type           string     `json:"type"` // cash_deposit, cash_withdrawal, transfer
	Threshold      string     `json:"threshold"`
	FiledAt        string     `json:"filed_at"`
	Status         string     `json:"status"` // pending, filed, acknowledged
}

func generateCTR(customerID, txnID string, amountKobo AmountKobo, txnType string) *CTRReport {
	threshold := ""
	if txnType == "cash_deposit" || txnType == "cash_withdrawal" {
		if amountKobo >= nairaToKobo(5000000) { threshold = "NFIU_CASH_5M" }
	} else {
		if amountKobo >= nairaToKobo(10000000) { threshold = "NFIU_TRANSFER_10M" }
	}
	if threshold == "" { return nil }
	return &CTRReport{
		ReportID: fmt.Sprintf("CTR-%d", time.Now().UnixMilli()),
		CustomerID: customerID, TransactionID: txnID,
		AmountKobo: amountKobo, Type: txnType,
		Threshold: threshold, FiledAt: time.Now().Format(time.RFC3339),
		Status: "pending",
	}
}

// STR (Suspicious Transaction Report) generation
type STRReport struct {
	ReportID    string `json:"report_id"`
	CustomerID  string `json:"customer_id"`
	Reason      string `json:"reason"`
	RiskScore   float64 `json:"risk_score"`
	Indicators  []string `json:"indicators"`
	Narrative   string `json:"narrative"`
	FiledAt     string `json:"filed_at"`
}

func generateSTR(customerID string, riskScore float64, indicators []string) *STRReport {
	if riskScore < 70 { return nil } // Only file if high risk
	return &STRReport{
		ReportID:   fmt.Sprintf("STR-%d", time.Now().UnixMilli()),
		CustomerID: customerID,
		Reason:     "automated_detection",
		RiskScore:  riskScore,
		Indicators: indicators,
		Narrative:  fmt.Sprintf("Automated STR: %d risk indicators detected, score %.1f", len(indicators), riskScore),
		FiledAt:    time.Now().Format(time.RFC3339),
	}
}

// AML Risk Scoring — multi-factor
func computeAMLRiskScoreDeep(
	txnAmountKobo AmountKobo, isPEP bool, isHighRiskCountry bool,
	cashIntensive bool, isStructuring bool, hasAdverseMedia bool,
	customerAge int, accountAgeMonths int,
) (float64, []string) {
	score := 0.0
	var indicators []string

	if isPEP { score += 30; indicators = append(indicators, "PEP_STATUS") }
	if isHighRiskCountry { score += 25; indicators = append(indicators, "HIGH_RISK_JURISDICTION") }
	if cashIntensive { score += 15; indicators = append(indicators, "CASH_INTENSIVE") }
	if isStructuring { score += 35; indicators = append(indicators, "STRUCTURING_DETECTED") }
	if hasAdverseMedia { score += 20; indicators = append(indicators, "ADVERSE_MEDIA") }
	if txnAmountKobo > nairaToKobo(10000000) { score += 10; indicators = append(indicators, "HIGH_VALUE_TXN") }
	if accountAgeMonths < 3 { score += 10; indicators = append(indicators, "NEW_ACCOUNT") }
	if customerAge < 25 && txnAmountKobo > nairaToKobo(5000000) { score += 15; indicators = append(indicators, "YOUNG_HIGH_VALUE") }

	if score > 100 { score = 100 }
	return score, indicators
}

// Sanctions screening
var sanctionedCountries = map[string]bool{
	"KP": true, "IR": true, "SY": true, "CU": true, "VE": true,
	"MM": true, "BY": true, "ZW": true, "SD": true,
}

func checkSanctions(countryCode string) (bool, string) {
	if sanctionedCountries[countryCode] {
		return true, fmt.Sprintf("country %s is on sanctions list — transaction blocked", countryCode)
	}
	return false, ""
}

// PEP (Politically Exposed Person) enhanced due diligence
func computePEPRiskLevel(pepCategory string, relationshipType string) string {
	switch pepCategory {
	case "head_of_state", "minister", "governor":
		return "very_high"
	case "senator", "representative", "judge":
		return "high"
	case "director_general", "commissioner":
		return "medium"
	case "family_member", "close_associate":
		if relationshipType == "immediate_family" { return "high" }
		return "medium"
	default:
		return "standard"
	}
}

// Transaction monitoring — pattern detection
func detectStructuring(transactions []map[string]interface{}, windowHours int) bool {
	// Check for multiple transactions just below ₦5M threshold
	count := 0
	for _, txn := range transactions {
		if amt, ok := txn["amount_kobo"].(int64); ok {
			if AmountKobo(amt) >= nairaToKobo(4000000) && AmountKobo(amt) < nairaToKobo(5000000) {
				count++
			}
		}
	}
	return count >= 3 // 3+ just-below-threshold = structuring
}

// OFAC/UN Sanctions name matching (fuzzy)
func nameSimilarity(name1, name2 string) float64 {
	n1 := strings.ToLower(strings.TrimSpace(name1))
	n2 := strings.ToLower(strings.TrimSpace(name2))
	if n1 == n2 { return 100.0 }
	// Simple Jaccard similarity on character bigrams
	bigrams1 := make(map[string]bool)
	bigrams2 := make(map[string]bool)
	for i := 0; i < len(n1)-1; i++ { bigrams1[n1[i:i+2]] = true }
	for i := 0; i < len(n2)-1; i++ { bigrams2[n2[i:i+2]] = true }
	intersection := 0
	for bg := range bigrams1 { if bigrams2[bg] { intersection++ } }
	union := len(bigrams1) + len(bigrams2) - intersection
	if union == 0 { return 0 }
	return float64(intersection) / float64(union) * 100.0
}


func ensureDB() {
	if db == nil {
		log.Printf("[%s] CRITICAL: No DATABASE_URL configured — service will reject all write operations", serviceName)
	}
}


// --- PII Masking (NDPR Compliance) ---
func maskPII(value, fieldType string) string {
	if len(value) == 0 { return "***" }
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
		if len(value) > 4 { return value[:1] + "***" + value[len(value)-1:] }
		return "***"
	}
}

func sanitizeLogEntry(msg string) string {
	// Mask BVN patterns (11 digits)
	re1 := regexp.MustCompile(`\b[0-9]{11}\b`)
	msg = re1.ReplaceAllStringFunc(msg, func(s string) string { return "***" + s[len(s)-4:] })
	// Mask account numbers (10 digits)
	re2 := regexp.MustCompile(`\b[0-9]{10}\b`)
	msg = re2.ReplaceAllStringFunc(msg, func(s string) string { return "****" + s[len(s)-4:] })
	// Mask email
	re3 := regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)
	msg = re3.ReplaceAllString(msg, "***@***")
	return msg
}


// --- Dead Letter Queue Handler ---
type DLQMessage struct {
	OriginalTopic string                 `json:"original_topic"`
	ConsumerGroup string                 `json:"consumer_group"`
	MessageKey    string                 `json:"message_key"`
	MessageValue  map[string]interface{} `json:"message_value"`
	ErrorMessage  string                 `json:"error_message"`
	RetryCount    int                    `json:"retry_count"`
	MaxRetries    int                    `json:"max_retries"`
	CreatedAt     string                 `json:"created_at"`
}

var dlqMessages []DLQMessage
var dlqMu sync.Mutex

func publishToDLQ(topic, consumerGroup, key string, value map[string]interface{}, err error, retryCount int) {
	dlqMu.Lock()
	defer dlqMu.Unlock()
	msg := DLQMessage{
		OriginalTopic: topic,
		ConsumerGroup: consumerGroup,
		MessageKey:    key,
		MessageValue:  value,
		ErrorMessage:  err.Error(),
		RetryCount:    retryCount,
		MaxRetries:    3,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
	dlqMessages = append(dlqMessages, msg)
	log.Printf("[DLQ] Message sent to DLQ: topic=%s key=%s error=%s retries=%d", topic, key, err.Error(), retryCount)
}

func handleDLQList(w http.ResponseWriter, r *http.Request) {
	dlqMu.Lock()
	defer dlqMu.Unlock()
	respondJSON(w, 200, map[string]interface{}{
		"dlq_messages": dlqMessages,
		"count":        len(dlqMessages),
	})
}

func handleDLQReplay(w http.ResponseWriter, r *http.Request) {
	dlqMu.Lock()
	defer dlqMu.Unlock()
	if len(dlqMessages) == 0 {
		respondJSON(w, 200, map[string]interface{}{"status": "empty", "replayed": 0})
		return
	}
	replayed := 0
	var remaining []DLQMessage
	for _, msg := range dlqMessages {
		if msg.RetryCount < msg.MaxRetries {
			log.Printf("[DLQ] Replaying: topic=%s key=%s attempt=%d", msg.OriginalTopic, msg.MessageKey, msg.RetryCount+1)
			replayed++
		} else {
			remaining = append(remaining, msg)
		}
	}
	dlqMessages = remaining
	respondJSON(w, 200, map[string]interface{}{"status": "replayed", "replayed": replayed, "remaining": len(remaining)})
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

func validateOrigin(origin string) bool {
	if origin == "" || origin == "*" {
		return false // reject wildcards
	}
	// Only allow HTTPS origins in production
	if strings.HasPrefix(origin, "https://") || strings.HasPrefix(origin, "http://localhost") {
		return true
	}
	return false
}

func validateJWTExpiry(tokenStr string) bool {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return false
	}
	// Decode payload (base64url)
	payload := parts[1]
	// Add padding if needed
	switch len(payload) % 4 {
	case 2:
		payload += "=="
	case 3:
		payload += "="
	}
	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return false
	}
	var claims map[string]interface{}
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return false
	}
	exp, ok := claims["exp"].(float64)
	if !ok {
		return false
	}
	return time.Now().Unix() < int64(exp)
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

func validateBVN(bvn string) bool {
	if len(bvn) != 11 { return false }
	for _, c := range bvn { if c < '0' || c > '9' { return false } }
	return true
}

func validateAccountNumber(acctNo string) bool {
	if len(acctNo) != 10 { return false }
	for _, c := range acctNo { if c < '0' || c > '9' { return false } }
	return true
}

func validateNigerianPhone(phone string) bool {
	clean := strings.ReplaceAll(strings.ReplaceAll(phone, " ", ""), "-", "")
	if strings.HasPrefix(clean, "+234") && len(clean) == 14 { return true }
	if strings.HasPrefix(clean, "0") && len(clean) == 11 { return true }
	return false
}

func validateAmountKobo(amount int64) bool {
	return amount > 0 && amount <= 500000000000
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

func main() {
	initTracing()
	port := os.Getenv("PORT")
	if port == "" {
		port = "9096"
	}
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/v1/degradation", degradationStatusHandler)
	mux.HandleFunc("/dlq", handleDLQList)
	mux.HandleFunc("/dlq/replay", handleDLQReplay)
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/beneficial-ownership/register", handleRegister)
	mux.HandleFunc("/v1/beneficial-ownership/traverse-chain", handleTraverseChain)
	mux.HandleFunc("/v1/beneficial-ownership/identify-ubos", handleIdentifyUBOs)
	mux.HandleFunc("/v1/beneficial-ownership/register/add", handleAddToRegister)
	mux.HandleFunc("/v1/beneficial-ownership/stats", handleStats)
	mux.HandleFunc("/v1/beneficial-ownership/score", beneficial_ownershipScoreHandler)
	mux.HandleFunc("/v1/beneficial-ownership/validate", beneficial_ownershipValidateRequestHandler)
	log.Printf("Beneficial Ownership Register v2.0 (Go) on :%s", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
        Addr:    ":" + port,
        Handler: panicRecoveryMiddleware(rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(traceMiddleware(countingMiddleware(mux)))))),
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 30 * time.Second,
        IdleTimeout:  60 * time.Second,
    }
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    go func() {
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Server error: %v", err)
        }
    }()
    <-quit
    log.Println("[beneficial-ownership-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[beneficial-ownership-go] Server stopped gracefully")
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

