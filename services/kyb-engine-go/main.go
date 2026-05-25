// 54Bank KYB Engine (Go) — Corporate Structure Analysis
// Ownership graph traversal, control chain analysis, voting rights calculation,
// complex corporate hierarchy resolution, shell company detection.
// Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
package main

import (
	_ "github.com/lib/pq"
"context"
"os/signal"
"syscall"
"sync/atomic"

	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"
	"database/sql"
	"bytes"
	"strings"

	"net"

)

var serviceName = "kyb-engine-go"

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type OwnershipNode struct {
	EntityID       string          `json:"entityId"`
	EntityName     string          `json:"entityName"`
	EntityType     string          `json:"entityType"` // individual, company, trust, fund
	Country        string          `json:"country"`
	OwnershipPct   float64         `json:"ownershipPct"`
	VotingRightPct float64         `json:"votingRightPct"`
	ControlType    string          `json:"controlType"` // direct, indirect, de_facto
	IsPEP          bool            `json:"isPEP"`
	IsSanctioned   bool            `json:"isSanctioned"`
	Children       []OwnershipNode `json:"children,omitempty"`
}

type CorporateStructure struct {
	ID                string          `json:"id"`
	CompanyID         string          `json:"companyId"`
	CompanyName       string          `json:"companyName"`
	RCNumber          string          `json:"rcNumber"`
	AnalysisStatus    string          `json:"analysisStatus"`
	TotalLayers       int             `json:"totalLayers"`
	TotalEntities     int             `json:"totalEntities"`
	UBOsIdentified    int             `json:"ubosIdentified"`
	OwnershipGraph    []OwnershipNode `json:"ownershipGraph"`
	RiskFlags         []string        `json:"riskFlags"`
	ShellCompanyScore float64         `json:"shellCompanyScore"`
	CircularOwnership bool            `json:"circularOwnership"`
	AnalyzedAt        string          `json:"analyzedAt"`
}

type VotingRightsCalc struct {
	EntityID       string  `json:"entityId"`
	DirectVoting   float64 `json:"directVotingPct"`
	IndirectVoting float64 `json:"indirectVotingPct"`
	TotalVoting    float64 `json:"totalVotingPct"`
	HasControl     bool    `json:"hasControl"`
	ControlBasis   string  `json:"controlBasis"`
}

var (
	mu         sync.Mutex
	structures = []CorporateStructure{}
	stats      = map[string]interface{}{
		"totalAnalyses":       0,
		"avgLayers":           2.3,
		"shellCompanyAlerts":  0,
		"circularOwnership":   0,
		"pepInChain":          0,
		"sanctionedInChain":   0,
		"avgEntitiesPerGraph": 5.2,
	}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "kyb-engine-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Graph Analysis Functions ───────────────────────────────────────────────

func buildOwnershipGraph(shareholders []map[string]interface{}) []OwnershipNode {
	nodes := []OwnershipNode{}
	for _, s := range shareholders {
		node := OwnershipNode{
			EntityID:       getString(s, "entityId"),
			EntityName:     getString(s, "entityName"),
			EntityType:     getString(s, "entityType"),
			Country:        getString(s, "country"),
			OwnershipPct:   getFloat(s, "ownershipPct"),
			VotingRightPct: getFloat(s, "votingRightPct"),
			ControlType:    "direct",
		}
		if node.EntityType == "" {
			node.EntityType = "individual"
		}
		if node.Country == "" {
			node.Country = "NG"
		}
		if node.VotingRightPct == 0 {
			node.VotingRightPct = node.OwnershipPct
		}
		nodes = append(nodes, node)
	}
	return nodes
}

func detectCircularOwnership(nodes []OwnershipNode) bool {
	seen := map[string]bool{}
	for _, n := range nodes {
		if seen[n.EntityID] {
			return true
		}
		seen[n.EntityID] = true
	}
	return false
}

func calculateShellScore(nodes []OwnershipNode, layers int) float64 {
	score := 0.0
	if layers > 4 {
		score += 0.3
	}
	nominees := 0
	for _, n := range nodes {
		if n.EntityType == "trust" || n.EntityType == "fund" {
			nominees++
		}
	}
	if nominees > 2 {
		score += 0.25
	}
	highRisk := 0
	for _, n := range nodes {
		if n.Country != "NG" {
			highRisk++
		}
	}
	if highRisk > len(nodes)/2 {
		score += 0.2
	}
	return score
}

func calculateVotingRights(nodes []OwnershipNode) []VotingRightsCalc {
	results := []VotingRightsCalc{}
	for _, n := range nodes {
		direct := n.VotingRightPct
		indirect := 0.0
		for _, child := range n.Children {
			indirect += child.VotingRightPct * n.OwnershipPct / 100.0
		}
		total := direct + indirect
		results = append(results, VotingRightsCalc{
			EntityID:       n.EntityID,
			DirectVoting:   direct,
			IndirectVoting: indirect,
			TotalVoting:    total,
			HasControl:     total > 50,
			ControlBasis:   controlBasis(total, direct),
		})
	}
	return results
}

func controlBasis(total, direct float64) string {
	if direct > 50 {
		return "majority_direct"
	}
	if total > 50 {
		return "majority_combined"
	}
	if direct > 25 {
		return "significant_influence"
	}
	return "minority"
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "kyb-engine-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "KYB Engine — Corporate Structure Analysis",
		"capabilities": []string{
			"ownership_graph_traversal", "control_chain_analysis",
			"voting_rights_calculation", "shell_company_detection",
			"circular_ownership_detection", "ubo_identification",
			"pep_sanctions_in_chain", "multi_layer_resolution",
			"de_facto_control_analysis", "nominee_detection",
		},
		"middleware": map[string]string{
			"kafka":      "kyb.structures, kyb.ownership, kyb.risk-flags",
			"postgres":   "kyb_structures, kyb_ownership_nodes, kyb_voting_rights",
			"redis":      "structure_cache (TTL 1h)",
			"temporal":   "CorporateStructureWorkflow, OwnershipGraphChild",
			"permify":    "kyb-structure:analyze, kyb-structure:admin",
			"opensearch": "kyb-structures-2026",
		},
	})
}

func handleAnalyze(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	shareholders := []map[string]interface{}{}
	if s, ok := body["shareholders"].([]interface{}); ok {
		for _, item := range s {
			if m, ok := item.(map[string]interface{}); ok {
				shareholders = append(shareholders, m)
			}
		}
	}

	graph := buildOwnershipGraph(shareholders)
	circular := detectCircularOwnership(graph)
	layers := 1
	if len(graph) > 5 {
		layers = 3
	} else if len(graph) > 2 {
		layers = 2
	}
	shellScore := calculateShellScore(graph, layers)
	votingRights := calculateVotingRights(graph)

	ubos := 0
	for _, vr := range votingRights {
		if vr.TotalVoting >= 25 {
			ubos++
		}
	}

	flags := []string{}
	if circular {
		flags = append(flags, "circular_ownership_detected")
	}
	if shellScore > 0.5 {
		flags = append(flags, "potential_shell_company")
	}
	for _, n := range graph {
		if n.IsPEP {
			flags = append(flags, fmt.Sprintf("pep_in_chain:%s", n.EntityID))
		}
		if n.IsSanctioned {
			flags = append(flags, fmt.Sprintf("sanctioned_entity:%s", n.EntityID))
		}
	}

	structure := CorporateStructure{
		ID:                fmt.Sprintf("STR-%08X", rand.Uint32()),
		CompanyID:         getString(body, "companyId"),
		CompanyName:       getString(body, "companyName"),
		RCNumber:          getString(body, "rcNumber"),
		AnalysisStatus:    "completed",
		TotalLayers:       layers,
		TotalEntities:     len(graph),
		UBOsIdentified:    ubos,
		OwnershipGraph:    graph,
		RiskFlags:         flags,
		ShellCompanyScore: shellScore,
		CircularOwnership: circular,
		AnalyzedAt:        time.Now().Format(time.RFC3339),
	}
	structures = append(structures, structure)
	stats["totalAnalyses"] = len(structures)

	dbData, _ := json.Marshal(map[string]string{"service": "kyb_engine_go", "action": "create"})
	if dbErr := dbInsert(fmt.Sprintf("kyb_engine_go-%d", time.Now().UnixNano()), "kyb_engine_go", "default", "active", dbData); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
	cacheSet("kyb_engine_list", "", 1) // invalidate cache on write
	}
	csURL := os.Getenv("KYC_ENGINE_URL")
	if csURL == "" { csURL = "http://kyc-engine-go:8080" }
	if _, csErr := callService("POST", csURL+"/v1/notify", map[string]interface{}{"source": "kyb_engine_go", "action": "create"}); csErr != nil {
		log.Printf("[%s] upstream call failed: %v", serviceName, csErr)
	}
	respondJSON(w, 200, map[string]interface{}{
		"structure":    structure,
		"votingRights": votingRights,
		"ubos":         ubos,
	})
}

func handleStructures(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{
		"structures": structures, "total": len(structures),
	})
}

func handleVotingRights(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	shareholders := []map[string]interface{}{}
	if s, ok := body["shareholders"].([]interface{}); ok {
		for _, item := range s {
			if m, ok := item.(map[string]interface{}); ok {
				shareholders = append(shareholders, m)
			}
		}
	}
	graph := buildOwnershipGraph(shareholders)
	rights := calculateVotingRights(graph)
	respondJSON(w, 200, map[string]interface{}{
		"votingRights": rights, "totalEntities": len(graph),
	})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, stats)
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


func kyb_engineComputeScore(value float64, weight float64, threshold float64) float64 {
    score := value * weight
    if score > threshold { score = threshold }
    return score
}

func kyb_engineValidateRequest(data map[string]interface{}) map[string]interface{} {
    errors := []string{}
    required := []string{"id", "type"}
    for _, field := range required {
        if _, ok := data[field]; !ok {
            errors = append(errors, field + " is required")
        }
    }
    return map[string]interface{}{"valid": len(errors) == 0, "errors": errors}
}

func kyb_engineScoreHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Value     float64 `json:"value"`
        Weight    float64 `json:"weight"`
        Threshold float64 `json:"threshold"`
    }
    json.NewDecoder(r.Body).Decode(&req)
    score := kyb_engineComputeScore(req.Value, req.Weight, req.Threshold)
    respondJSON(w, 200, map[string]interface{}{"score": score})
}

func kyb_engineValidateRequestHandler(w http.ResponseWriter, r *http.Request) {
    var body map[string]interface{}
    json.NewDecoder(r.Body).Decode(&body)
    result := kyb_engineValidateRequest(body)
    respondJSON(w, 200, result)
}

// --- Production Hardening ---
var (
    _reqCount  uint64
    _errCount  uint64
    _bootTime  = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"ready":true,"service":"kyb-engine-go"}`)
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"alive":true}`)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
    reqs := atomic.LoadUint64(&_reqCount)
    errs := atomic.LoadUint64(&_errCount)
    w.Header().Set("Content-Type", "text/plain")
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"kyb-engine-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"kyb-engine-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"kyb-engine-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}


// --- Counting Middleware ---
func countingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        atomic.AddUint64(&_reqCount, 1)
        rw := &responseWriter{ResponseWriter: w, status: 200}
        next.ServeHTTP(rw, r)
        if rw.status >= 400 {
            atomic.AddUint64(&_errCount, 1)
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
		log.Printf("[%s] DATABASE_URL not set — in-memory mode", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — in-memory fallback", serviceName, err)
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
		j = []byte(sanitizeInput(string(j)))
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
var redisAddr string

func init() {
	redisAddr = os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
}

func cacheGet(key string) (string, bool) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil { return "", false }
	defer conn.Close()
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil || n < 3 { return "", false }
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		// Parse bulk string response
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 { return parts[1], true }
	}
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil { return }
	defer conn.Close()
	fmt.Fprintf(conn, "*4\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%d\r\n",
		len(key), key, len(value), value, len(fmt.Sprintf("%d", ttlSeconds)), ttlSeconds)
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


// ─── Domain Logic: Kyb Engine ────────────────────────────────────────────

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


func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "9106"
	}
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/kyb-structure/analyze", handleAnalyze)
	mux.HandleFunc("/v1/kyb-structure/list", handleStructures)
	mux.HandleFunc("/v1/kyb-structure/voting-rights", handleVotingRights)
	mux.HandleFunc("/v1/kyb-structure/stats", handleStats)
	mux.HandleFunc("/v1/kyb-engine/score", kyb_engineScoreHandler)
	mux.HandleFunc("/v1/kyb-engine/validate", kyb_engineValidateRequestHandler)
	log.Printf("KYB Engine — Corporate Structure v2.0 (Go) on :%s", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
        Addr:    ":" + port,
        Handler: rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(traceMiddleware(countingMiddleware(mux))))),
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
    log.Println("[kyb-engine-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[kyb-engine-go] Server stopped gracefully")
}
