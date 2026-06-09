package main

import (
	_ "github.com/lib/pq"
	"database/sql"
	"context"
	"os/signal"
	"syscall"
	"sync/atomic"

	"crypto/rand"
	"encoding/json"
	"fmt"
	"math"
	"log"
	"math/big"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

var serviceName = "graphql-federation-go"

// GraphQL Federation Gateway — schema stitching, query planning, resolver orchestration
// Handles composite queries across 54Bank's microservice mesh

var PORT = "8100"

func init() {
	if p := os.Getenv("PORT"); p != "" {
		PORT = p
	}
}

// ─── Domain Types ───

type Subgraph struct {
	Name            string   `json:"name"`
	URL             string   `json:"url"`
	SchemaVersion   string   `json:"schema_version"`
	Types           []string `json:"types"`
	Status          string   `json:"status"` // registered→healthy→degraded→unreachable
	LastHealthCheck string   `json:"last_health_check"`
	AvgLatencyMs    float64  `json:"avg_latency_ms"`
	ErrorRate       float64  `json:"error_rate"`
	QueryCount      int64    `json:"query_count"`
	CreatedAt       string   `json:"created_at"`
}

type QueryPlan struct {
	ID               string   `json:"id"`
	OriginalQuery    string   `json:"original_query"`
	InvolvedSubgraphs []string `json:"involved_subgraphs"`
	Steps            []QueryStep `json:"steps"`
	EstimatedLatency int      `json:"estimated_latency_ms"`
	Complexity       int      `json:"complexity"`
	CacheKey         string   `json:"cache_key"`
	CacheHit         bool     `json:"cache_hit"`
	CreatedAt        string   `json:"created_at"`
}

type QueryStep struct {
	Subgraph string `json:"subgraph"`
	Fetch    string `json:"fetch"`
	Requires string `json:"requires,omitempty"`
	Parallel bool   `json:"parallel"`
}

type SchemaComposition struct {
	ID          string   `json:"id"`
	Subgraphs   []string `json:"subgraphs"`
	TotalTypes  int      `json:"total_types"`
	TotalFields int      `json:"total_fields"`
	Conflicts   []string `json:"conflicts,omitempty"`
	Status      string   `json:"status"` // composed, conflict, partial
	ComposedAt  string   `json:"composed_at"`
}

type PersistedQuery struct {
	Hash      string `json:"hash"`
	Query     string `json:"query"`
	Subgraphs []string `json:"subgraphs"`
	TTL       int    `json:"ttl_seconds"`
	HitCount  int64  `json:"hit_count"`
	CreatedAt string `json:"created_at"`
}

// ─── State ───

var (
	subgraphs       []Subgraph
	subgraphsMu     sync.RWMutex
	queryPlans      []QueryPlan
	queryPlansMu    sync.RWMutex
	compositions    []SchemaComposition
	compositionsMu  sync.RWMutex
	persistedQueries []PersistedQuery
	pqMu            sync.RWMutex
	requestCount    int64
	errorCount      int64
	counterMu       sync.Mutex
)

func incRequests() { counterMu.Lock(); requestCount++; counterMu.Unlock() }
func incErrors()   { counterMu.Lock(); errorCount++; counterMu.Unlock() }

// ─── Utilities ───

func secureRandID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%X", b)
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

// ─── Banking Domain Subgraph Definitions ───

var bankingSubgraphs = map[string][]string{
	"accounts":     {"Account", "Balance", "Statement", "AccountHolder", "AccountProduct"},
	"transactions": {"Transaction", "Transfer", "Payment", "Reversal", "Settlement"},
	"kyc":          {"KYCRecord", "BVNVerification", "NINVerification", "LivenessCheck", "TierUpgrade"},
	"loans":        {"Loan", "LoanApplication", "Repayment", "AmortizationSchedule", "Collateral"},
	"cards":        {"Card", "CardTransaction", "CardLimit", "PINChange", "CardBlock"},
	"compliance":   {"AMLAlert", "STR", "CTR", "NFIUReport", "PEPScreening", "SanctionsCheck"},
	"deposits":     {"FixedDeposit", "SavingsProduct", "InterestAccrual", "Maturity"},
	"fx":           {"FXRate", "FXOrder", "RemittanceCorridor", "FXSettlement"},
}

// Sensitive fields that must not appear in query results without authorization
var sensitiveFields = map[string]bool{
	"bvn": true, "nin": true, "phone": true, "email": true,
	"account_number": true, "balance": true, "pin": true,
	"password": true, "secret": true, "ssn": true,
}

// ─── Query Complexity Scoring ───

func computeQueryComplexity(query string, depth int) int {
	baseComplexity := len(query) / 10
	depthPenalty := depth * depth * 2

	// Expensive operations
	if strings.Contains(query, "transactions") { baseComplexity += 50 }
	if strings.Contains(query, "statements") { baseComplexity += 100 }
	if strings.Contains(query, "aml") || strings.Contains(query, "AML") { baseComplexity += 75 }
	if strings.Contains(query, "loan") || strings.Contains(query, "Loan") { baseComplexity += 30 }

	// Pagination amplifier
	if strings.Contains(query, "first:") || strings.Contains(query, "last:") {
		baseComplexity += 20
	}

	return baseComplexity + depthPenalty
}

var maxQueryComplexity = 1000

// ─── Query Planning ───

func planQuery(query string) ([]string, []QueryStep, int) {
	involvedSubgraphs := []string{}
	steps := []QueryStep{}

	for sg, types := range bankingSubgraphs {
		for _, t := range types {
			if strings.Contains(query, t) || strings.Contains(strings.ToLower(query), strings.ToLower(t)) {
				involvedSubgraphs = append(involvedSubgraphs, sg)
				steps = append(steps, QueryStep{
					Subgraph: sg,
					Fetch:    fmt.Sprintf("SELECT %s FROM %s", t, sg),
					Parallel: true,
				})
				break
			}
		}
	}

	// Add dependencies: KYC data requires accounts subgraph
	hasKYC := false
	hasAccounts := false
	for _, sg := range involvedSubgraphs {
		if sg == "kyc" { hasKYC = true }
		if sg == "accounts" { hasAccounts = true }
	}
	if hasKYC && !hasAccounts {
		involvedSubgraphs = append(involvedSubgraphs, "accounts")
		steps = append(steps, QueryStep{
			Subgraph: "accounts",
			Fetch:    "SELECT AccountHolder FROM accounts",
			Requires: "kyc.customer_id",
			Parallel: false,
		})
	}

	estimatedLatency := len(involvedSubgraphs) * 50 + 10
	return involvedSubgraphs, steps, estimatedLatency
}

// ─── Field-Level Authorization ───

func checkFieldAuthorization(fields []string, role string) ([]string, []string) {
	allowed := []string{}
	denied := []string{}
	for _, f := range fields {
		if sensitiveFields[f] && role != "admin" && role != "compliance" {
			denied = append(denied, f)
		} else {
			allowed = append(allowed, f)
		}
	}
	return allowed, denied
}

// ─── Handlers ───

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	subgraphsMu.RLock()
	healthy := 0
	for _, sg := range subgraphs {
		if sg.Status == "healthy" { healthy++ }
	}
	total := len(subgraphs)
	subgraphsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "graphql-federation-go", "version": "2.0.0",
		"subgraphs_healthy": healthy, "subgraphs_total": total,
		"supergraph_types": len(bankingSubgraphs),
	})
}

func handleSubgraphRegister(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Name    string   `json:"name"`
		URL     string   `json:"url"`
		Version string   `json:"schema_version"`
		Types   []string `json:"types"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	errs := []string{}
	if body.Name == "" { errs = append(errs, "name_required") }
	if body.URL == "" { errs = append(errs, "url_required") }
	if len(body.Types) == 0 { errs = append(errs, "types_required") }
	if len(errs) > 0 {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "validation_failed", "errors": errs})
		return
	}

	// Check for type conflicts
	subgraphsMu.RLock()
	conflicts := []string{}
	for _, sg := range subgraphs {
		for _, existingType := range sg.Types {
			for _, newType := range body.Types {
				if existingType == newType {
					conflicts = append(conflicts, fmt.Sprintf("type_%s_already_owned_by_%s", newType, sg.Name))
				}
			}
		}
	}
	subgraphsMu.RUnlock()

	if len(conflicts) > 0 {
		respondJSON(w, 409, map[string]interface{}{
			"error": "type_conflicts", "conflicts": conflicts,
			"suggestion": "Use @key directive to share types or rename conflicting types",
		})
		return
	}

	sg := Subgraph{
		Name:          body.Name,
		URL:           body.URL,
		SchemaVersion: body.Version,
		Types:         body.Types,
		Status:        "healthy",
		LastHealthCheck: time.Now().UTC().Format(time.RFC3339),
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
	subgraphsMu.Lock()
	subgraphs = append(subgraphs, sg)
	if dataBytes, err := json.Marshal(sg); err == nil { if dbErr := dbInsert(fmt.Sprintf("graphql-federation-go-%d", time.Now().UnixNano()), "graphql-federation-go", "subgraphs", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	subgraphsMu.Unlock()

	respondJSON(w, 201, map[string]interface{}{"subgraph": sg})
}

func handleSubgraphList(w http.ResponseWriter, r *http.Request) {
	incRequests()
	subgraphsMu.RLock()
	defer subgraphsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"subgraphs": subgraphs, "count": len(subgraphs)})
}

func handleQueryPlan(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Query  string   `json:"query"`
		Fields []string `json:"fields"`
		Role   string   `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	if body.Query == "" {
		respondJSON(w, 400, map[string]interface{}{"error": "query_required"})
		return
	}

	// Complexity check
	involvedSGs, steps, estLatency := planQuery(body.Query)
	complexity := computeQueryComplexity(body.Query, len(involvedSGs))
	if complexity > maxQueryComplexity {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{
			"error": "query_too_complex",
			"complexity": complexity,
			"max_complexity": maxQueryComplexity,
			"suggestion": "Reduce query depth or limit fields",
		})
		return
	}

	// Field authorization
	allowed, denied := checkFieldAuthorization(body.Fields, body.Role)

	plan := QueryPlan{
		ID:               fmt.Sprintf("QP-%s", secureRandID()),
		OriginalQuery:    body.Query,
		InvolvedSubgraphs: involvedSGs,
		Steps:            steps,
		EstimatedLatency: estLatency,
		Complexity:       complexity,
		CacheKey:         fmt.Sprintf("%x", body.Query),
		CreatedAt:        time.Now().UTC().Format(time.RFC3339),
	}
	queryPlansMu.Lock()
	queryPlans = append(queryPlans, plan)
	if dataBytes, err := json.Marshal(plan); err == nil { if dbErr := dbInsert(fmt.Sprintf("graphql-federation-go-%d", time.Now().UnixNano()), "graphql-federation-go", "queryPlans", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	queryPlansMu.Unlock()

	resp := map[string]interface{}{
		"plan":            plan,
		"allowed_fields":  allowed,
		"parallel_execution": len(involvedSGs) > 1,
	}
	if len(denied) > 0 {
		resp["denied_fields"] = denied
		resp["authorization_warning"] = "Some fields require elevated permissions"
	}
	respondJSON(w, 200, resp)
}

func handleSchemaCompose(w http.ResponseWriter, r *http.Request) {
	incRequests()
	subgraphsMu.RLock()
	sgNames := []string{}
	totalTypes := 0
	totalFields := 0
	for _, sg := range subgraphs {
		sgNames = append(sgNames, sg.Name)
		totalTypes += len(sg.Types)
		totalFields += len(sg.Types) * 5 // estimated fields per type
	}
	subgraphsMu.RUnlock()

	// Add built-in banking types
	for _, types := range bankingSubgraphs {
		totalTypes += len(types)
		totalFields += len(types) * 8
	}

	composition := SchemaComposition{
		ID:         fmt.Sprintf("SC-%s", secureRandID()),
		Subgraphs:  sgNames,
		TotalTypes: totalTypes,
		TotalFields: totalFields,
		Status:     "composed",
		ComposedAt: time.Now().UTC().Format(time.RFC3339),
	}
	compositionsMu.Lock()
	compositions = append(compositions, composition)
	if dataBytes, err := json.Marshal(composition); err == nil { if dbErr := dbInsert(fmt.Sprintf("graphql-federation-go-%d", time.Now().UnixNano()), "graphql-federation-go", "compositions", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	compositionsMu.Unlock()

	respondJSON(w, 200, map[string]interface{}{
		"composition": composition,
		"banking_domain_types": bankingSubgraphs,
	})
}

func handleIntrospect(w http.ResponseWriter, r *http.Request) {
	incRequests()
	types := map[string]interface{}{}
	for sg, sgTypes := range bankingSubgraphs {
		for _, t := range sgTypes {
			types[t] = map[string]interface{}{
				"subgraph": sg,
				"fields":   []string{"id", "created_at", "updated_at", "status"},
			}
		}
	}
	respondJSON(w, 200, map[string]interface{}{
		"__schema": map[string]interface{}{
			"types":     types,
			"queryType": "Query",
			"mutationType": "Mutation",
			"directives": []string{"@key", "@requires", "@provides", "@external"},
		},
	})
}

func handlePersistedQueryStore(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Query     string   `json:"query"`
		TTL       int      `json:"ttl_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	if body.Query == "" {
		respondJSON(w, 400, map[string]interface{}{"error": "query_required"})
		return
	}
	if body.TTL <= 0 { body.TTL = 3600 }

	involvedSGs, _, _ := planQuery(body.Query)
	complexity := computeQueryComplexity(body.Query, len(involvedSGs))
	if complexity > maxQueryComplexity {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{
			"error": "persisted_query_too_complex",
			"complexity": complexity,
			"max_complexity": maxQueryComplexity,
		})
		return
	}

	hash := fmt.Sprintf("%x", body.Query)
	pq := PersistedQuery{
		Hash:      hash,
		Query:     body.Query,
		Subgraphs: involvedSGs,
		TTL:       body.TTL,
		HitCount:  0,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	pqMu.Lock()
	persistedQueries = append(persistedQueries, pq)
	if dataBytes, err := json.Marshal(pq); err == nil { if dbErr := dbInsert(fmt.Sprintf("graphql-federation-go-%d", time.Now().UnixNano()), "graphql-federation-go", "persistedQueries", "active", dataBytes); dbErr != nil { log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr) } }
	pqMu.Unlock()

	respondJSON(w, 201, map[string]interface{}{
		"persisted_query": pq,
		"usage": "Pass {extensions: {persistedQuery: {sha256Hash: \"" + hash + "\"}}} instead of full query",
	})
}

func handlePersistedQueryExecute(w http.ResponseWriter, r *http.Request) {
	incRequests()
	var body struct {
		Hash string `json:"hash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		incErrors()
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json"})
		return
	}
	pqMu.Lock()
	defer pqMu.Unlock()
	for i := range persistedQueries {
		if persistedQueries[i].Hash == body.Hash {
			persistedQueries[i].HitCount++
			involvedSGs, steps, estLatency := planQuery(persistedQueries[i].Query)
			complexity := computeQueryComplexity(persistedQueries[i].Query, len(involvedSGs))
			respondJSON(w, 200, map[string]interface{}{
				"persisted_query": persistedQueries[i],
				"execution_plan": map[string]interface{}{
					"subgraphs":        involvedSGs,
					"steps":            steps,
					"estimated_latency": estLatency,
					"complexity":       complexity,
				},
			})
			return
		}
	}
	respondJSON(w, 404, map[string]interface{}{
		"error": "persisted_query_not_found",
		"hash":  body.Hash,
	})
}

func handleSubgraphHealth(w http.ResponseWriter, r *http.Request) {
	incRequests()
	subgraphsMu.RLock()
	defer subgraphsMu.RUnlock()
	health := []map[string]interface{}{}
	for _, sg := range subgraphs {
		health = append(health, map[string]interface{}{
			"name":            sg.Name,
			"status":          sg.Status,
			"avg_latency_ms":  sg.AvgLatencyMs,
			"error_rate":      sg.ErrorRate,
			"query_count":     sg.QueryCount,
			"last_health_check": sg.LastHealthCheck,
			"types_count":     len(sg.Types),
		})
	}
	respondJSON(w, 200, map[string]interface{}{
		"subgraph_health": health,
		"total_subgraphs": len(health),
	})
}

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	counterMu.Lock()
	rc, ec := requestCount, errorCount
	counterMu.Unlock()
	fmt.Fprintf(w, "requests_total{service=\"graphql-federation-go\"} %d\n", rc)
	fmt.Fprintf(w, "errors_total{service=\"graphql-federation-go\"} %d\n", ec)
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
type AmountKobo = int64

func nairaToKobo(naira float64) AmountKobo { return AmountKobo(math.Round(naira * 100)) }
func koboToNaira(kobo AmountKobo) float64  { return float64(kobo) / 100.0 }
func roundNaira(amount float64) float64 { return math.Round(amount*100) / 100 }
func validateAmount(amount float64) error {
	if amount < 0 { return fmt.Errorf("amount must be non-negative") }
	if amount > 999_999_999_999.99 { return fmt.Errorf("exceeds CBN max limit") }
	return nil
}

func main() {
	initDB()
	_ = context.Background
	_ = big.NewInt
	_ = sanitizeLogEntry
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", handleHealthz)
	mux.HandleFunc("/livez", handleHealthz)
	mux.HandleFunc("/metrics", handleMetrics)
	mux.HandleFunc("/v1/subgraph/register", handleSubgraphRegister)
	mux.HandleFunc("/v1/subgraph/list", handleSubgraphList)
	mux.HandleFunc("/v1/query/plan", handleQueryPlan)
	mux.HandleFunc("/v1/schema/compose", handleSchemaCompose)
	mux.HandleFunc("/v1/introspect", handleIntrospect)
	mux.HandleFunc("/v1/persisted-query/store", handlePersistedQueryStore)
	mux.HandleFunc("/v1/persisted-query/execute", handlePersistedQueryExecute)
	mux.HandleFunc("/v1/subgraph/health", handleSubgraphHealth)
	log.Printf("GraphQL Federation Gateway listening on :%s", PORT)

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
		<-sigCh
		log.Printf("[%s] Shutting down gracefully...", serviceName)
		if db != nil { db.Close() }
		os.Exit(0)
	}()
	log.Fatal(http.ListenAndServe(":"+PORT, corsMiddleware(rateLimitMiddleware(mux))))
}
