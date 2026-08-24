package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

var port = getEnv("PORT", "8252")

type GroupLoan struct {
	GroupID      string  `json:"groupId"`
	GroupName    string  `json:"groupName"`
	CenterName   string  `json:"centerName"`
	Members      int     `json:"memberCount"`
	TotalAmount  float64 `json:"totalAmount"`
	RepaidAmount float64 `json:"repaidAmount"`
	WeeklyRate   float64 `json:"weeklyRate"`
	Weeks        int     `json:"weeksTotal"`
	WeeksPaid    int     `json:"weeksPaid"`
	Officer      string  `json:"loanOfficer"`
	Status       string  `json:"status"`
}

type Member struct {
	ID          string `json:"id"`
	GroupID     string `json:"groupId"`
	Name        string `json:"name"`
	Phone       string `json:"phone"`
	Business    string `json:"business"`
	LoanShare   string `json:"loanShare"`
	SavingsBal  string `json:"savingsBalance"`
	MeetingRate string `json:"meetingAttendance"`
}

type Center struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Location string `json:"location"`
	Groups   int    `json:"groupCount"`
	Members  int    `json:"memberCount"`
	Officer  string `json:"officer"`
}

var (
	groupLoans []GroupLoan
	members    []Member
	centers    []Center
)

func init() {
	groupLoans = []GroupLoan{}
	members = []Member{}
	centers = []Center{}
}

var middlewareStatus = map[string]interface{}{
	"kafka":       map[string]interface{}{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "microfinance.disbursements,microfinance.repayments,microfinance.meetings"},
	"dapr":        map[string]interface{}{"url": getEnv("DAPR_URL", "http://localhost:3500"), "app_id": "microfinance-engine"},
	"fluvio":      map[string]interface{}{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "microfinance-repayments"},
	"temporal":    map[string]interface{}{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflows": "GroupLendingWorkflow,RepaymentWorkflow,MeetingWorkflow"},
	"postgres":    map[string]interface{}{"url": os.Getenv("DATABASE_URL"), "tables": "group_loans,members,centers,repayment_schedules"},
	"keycloak":    map[string]interface{}{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
	"permify":     map[string]interface{}{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "microfinance_rbac"},
	"redis":       map[string]interface{}{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "session,cache"},
	"mojaloop":    map[string]interface{}{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "microloan settlement"},
	"opensearch":  map[string]interface{}{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "microfinance-*"},
	"openappsec":  map[string]interface{}{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "microfinance-protection"},
	"apisix":      map[string]interface{}{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/v1/microfinance/*"},
	"tigerbeetle": map[string]interface{}{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "microloan ledger"},
	"lakehouse":   map[string]interface{}{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "microfinance_analytics"},
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

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
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "microfinance-engine-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "microfinance-engine-go")
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
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
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

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/v1/microfinance/groups", handleGroups)
	mux.HandleFunc("/v1/microfinance/members", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			var m Member
			json.NewDecoder(r.Body).Decode(&m)
			m.ID = fmt.Sprintf("M-%d", len(members)+1)
			members = append(members, m)
			jsonResponse(w, 201, m)
			return
		}
		jsonResponse(w, 200, map[string]interface{}{"items": members, "total": len(members)})
	})
	mux.HandleFunc("/v1/microfinance/centers", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, 200, map[string]interface{}{"items": centers, "total": len(centers)})
	})
	mux.HandleFunc("/v1/microfinance/stats", func(w http.ResponseWriter, r *http.Request) {
		totalLoaned := 0.0
		totalRepaid := 0.0
		activeLoans := 0
		for _, gl := range groupLoans {
			totalLoaned += gl.TotalAmount
			totalRepaid += gl.RepaidAmount
			if gl.Status == "active" {
				activeLoans++
			}
		}
		repaymentRate := 0.0
		if totalLoaned > 0 {
			repaymentRate = (totalRepaid / totalLoaned) * 100
		}
		jsonResponse(w, 200, map[string]interface{}{
			"totalGroupLoans": len(groupLoans), "activeLoans": activeLoans,
			"totalMembers": len(members), "totalCenters": len(centers),
			"totalLoaned": totalLoaned, "totalRepaid": totalRepaid,
			"repaymentRate": repaymentRate,
		})
	})

	fmt.Printf("Microfinance Engine on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, rateLimitMiddleware(jwtAuthMiddleware(countingMiddleware(mux)))))
}

// healthz serves /healthz (extracted from the inline closure in main; behavior unchanged).
func healthz(w http.ResponseWriter, r *http.Request) {
	totalLoaned := 0.0
	totalRepaid := 0.0
	for _, gl := range groupLoans {
		totalLoaned += gl.TotalAmount
		totalRepaid += gl.RepaidAmount
	}
	jsonResponse(w, 200, map[string]interface{}{
		"status": "healthy", "service": "microfinance-engine",
		"groups": len(groupLoans), "members": len(members), "centers": len(centers),
		"totalLoaned": totalLoaned, "totalRepaid": totalRepaid,
		"middleware": middlewareStatus,
	})
}

// handleGroups serves /v1/microfinance/groups (extracted from the inline closure in main; behavior unchanged).
func handleGroups(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		var gl GroupLoan
		json.NewDecoder(r.Body).Decode(&gl)
		gl.Status = "pending"
		groupLoans = append(groupLoans, gl)
		jsonResponse(w, 201, gl)
		return
	}
	jsonResponse(w, 200, map[string]interface{}{"items": groupLoans, "total": len(groupLoans)})
}

// --- Request metrics (restored fleet-canonical block) ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

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

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"microfinance-engine-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"microfinance-engine-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"microfinance-engine-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"microfinance-engine-go"}`)
}

// --- Rate limiting (restored fleet-canonical token bucket: 100 rps) ---
var _rlTokens int64 = 100
var _rlLastRefill int64

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr-atomic.LoadInt64(&_rlLastRefill) >= 1000 {
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
