package main

import (
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
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

var serviceName = "sanctions-streaming-go"

type SanctionEntry struct {
	EntryID    string `json:"entry_id"`
	ListSource string `json:"list_source"`
	FullName   string `json:"full_name"`
	AliasNames string `json:"alias_names"`
	EntityType string `json:"entity_type"`
	Country    string `json:"country"`
	Programs   string `json:"programs"`
	AddedDate  string `json:"added_date"`
}

type ScreenResult struct {
	ResultID      string    `json:"result_id"`
	SubjectName   string    `json:"subject_name"`
	SubjectType   string    `json:"subject_type"`
	MatchedEntry  string    `json:"matched_entry"`
	MatchScore    float64   `json:"match_score"`
	ListSource    string    `json:"list_source"`
	Status        string    `json:"status"`
	ScreenedAt    time.Time `json:"screened_at"`
	TransactionID string    `json:"transaction_id,omitempty"`
	ReviewedBy    string    `json:"reviewed_by,omitempty"`
}

type App struct {
	db *sql.DB
}

var app = &App{}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://localhost:5432/corebanking?sslmode=disable"
	}
	var err error
	app.db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB connection failed: %v", serviceName, err)
		return
	}
	app.db.SetMaxOpenConns(25)
	app.db.SetMaxIdleConns(5)
	app.db.SetConnMaxLifetime(5 * time.Minute)

	schema := `CREATE TABLE IF NOT EXISTS sanction_entries (
		entry_id TEXT PRIMARY KEY,
		list_source TEXT NOT NULL,
		full_name TEXT NOT NULL,
		alias_names TEXT NOT NULL DEFAULT '',
		entity_type TEXT NOT NULL DEFAULT 'individual',
		country TEXT NOT NULL DEFAULT '',
		programs TEXT NOT NULL DEFAULT '',
		added_date TEXT NOT NULL DEFAULT ''
	);
	CREATE INDEX IF NOT EXISTS idx_sanctions_name ON sanction_entries(full_name);
	CREATE INDEX IF NOT EXISTS idx_sanctions_source ON sanction_entries(list_source);

	CREATE TABLE IF NOT EXISTS screen_results (
		result_id TEXT PRIMARY KEY,
		subject_name TEXT NOT NULL,
		subject_type TEXT NOT NULL DEFAULT 'individual',
		matched_entry TEXT NOT NULL DEFAULT '',
		match_score DOUBLE PRECISION NOT NULL DEFAULT 0,
		list_source TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'clear',
		screened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		transaction_id TEXT NOT NULL DEFAULT '',
		reviewed_by TEXT NOT NULL DEFAULT ''
	);
	CREATE INDEX IF NOT EXISTS idx_screen_status ON screen_results(status);`
	if _, err := app.db.Exec(schema); err != nil {
		log.Printf("[%s] Schema init failed: %v", serviceName, err)
	}

	seedSanctions()
	log.Printf("[%s] PostgreSQL connected, schema ready", serviceName)
}

func seedSanctions() {
	if app.db == nil {
		return
	}
	seeds := []SanctionEntry{
		{"OFAC-001", "OFAC_SDN", "Test Sanctioned Person", "TSP", "individual", "NG", "SDGT", "2024-01-01"},
		{"EU-001", "EU_SANCTIONS", "Test EU Entity", "", "entity", "RU", "UKRAINE_CRISIS", "2024-03-01"},
		{"UN-001", "UN_CONSOLIDATED", "Test UN Listed", "TUL", "individual", "SY", "UN_1267", "2023-06-15"},
		{"NFIU-001", "NFIU_WATCHLIST", "Test NFIU Person", "", "individual", "NG", "NFIU_DOMESTIC", "2024-06-01"},
		{"OFAC-002", "OFAC_SDN", "Test Corporation", "TC,TestCo", "entity", "IR", "IRAN_TRA", "2024-02-15"},
	}
	for _, s := range seeds {
		app.db.Exec(`INSERT INTO sanction_entries (entry_id, list_source, full_name, alias_names, entity_type, country, programs, added_date)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (entry_id) DO NOTHING`,
			s.EntryID, s.ListSource, s.FullName, s.AliasNames, s.EntityType, s.Country, s.Programs, s.AddedDate)
	}
}

func screenName(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name          string `json:"name"`
		SubjectType   string `json:"subject_type"`
		TransactionID string `json:"transaction_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	if req.SubjectType == "" {
		req.SubjectType = "individual"
	}

	rows, err := app.db.Query(`SELECT entry_id, list_source, full_name, alias_names, entity_type, country, programs FROM sanction_entries`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()

	var matches []map[string]interface{}
	nameUpper := strings.ToUpper(req.Name)
	for rows.Next() {
		var e SanctionEntry
		if err := rows.Scan(&e.EntryID, &e.ListSource, &e.FullName, &e.AliasNames, &e.EntityType, &e.Country, &e.Programs); err != nil {
			continue
		}
		score := fuzzyMatch(nameUpper, strings.ToUpper(e.FullName))
		aliasScore := 0.0
		if e.AliasNames != "" {
			for _, alias := range strings.Split(e.AliasNames, ",") {
				s := fuzzyMatch(nameUpper, strings.ToUpper(strings.TrimSpace(alias)))
				if s > aliasScore {
					aliasScore = s
				}
			}
		}
		if aliasScore > score {
			score = aliasScore
		}
		if score >= 0.75 {
			matches = append(matches, map[string]interface{}{
				"entry_id": e.EntryID, "list_source": e.ListSource,
				"matched_name": e.FullName, "match_score": score, "programs": e.Programs,
			})
		}
	}

	status := "clear"
	if len(matches) > 0 {
		status = "potential_match"
		for _, m := range matches {
			if m["match_score"].(float64) >= 0.95 {
				status = "confirmed_match"
				break
			}
		}
	}

	resultID := fmt.Sprintf("SCR-%x", sha256.Sum256([]byte(fmt.Sprintf("%s-%d", req.Name, time.Now().UnixNano()))))[0:22]
	matchedEntry := ""
	matchScore := 0.0
	listSource := ""
	if len(matches) > 0 {
		matchedEntry = matches[0]["matched_name"].(string)
		matchScore = matches[0]["match_score"].(float64)
		listSource = matches[0]["list_source"].(string)
	}

	app.db.Exec(`INSERT INTO screen_results (result_id, subject_name, subject_type, matched_entry, match_score, list_source, status, screened_at, transaction_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		resultID, req.Name, req.SubjectType, matchedEntry, matchScore, listSource, status, time.Now(), req.TransactionID)

	respondJSON(w, 200, map[string]interface{}{
		"result_id": resultID, "subject_name": req.Name,
		"status": status, "matches_count": len(matches),
		"matches": matches, "screened_at": time.Now().Format(time.RFC3339),
		"action_required": status != "clear",
	})
}

func fuzzyMatch(a, b string) float64 {
	if a == b {
		return 1.0
	}
	if strings.Contains(a, b) || strings.Contains(b, a) {
		shorter := len(a)
		if len(b) < shorter {
			shorter = len(b)
		}
		longer := len(a)
		if len(b) > longer {
			longer = len(b)
		}
		return float64(shorter) / float64(longer)
	}
	common := 0
	for _, c := range a {
		if strings.ContainsRune(b, c) {
			common++
		}
	}
	return float64(common) / float64(len(a)+len(b)) * 2
}

func getScreenHistory(w http.ResponseWriter, r *http.Request) {
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	rows, err := app.db.Query(`SELECT result_id, subject_name, subject_type, matched_entry, match_score, list_source, status, screened_at, transaction_id
		FROM screen_results ORDER BY screened_at DESC LIMIT 100`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()
	results := make([]ScreenResult, 0)
	for rows.Next() {
		var sr ScreenResult
		if err := rows.Scan(&sr.ResultID, &sr.SubjectName, &sr.SubjectType, &sr.MatchedEntry, &sr.MatchScore, &sr.ListSource, &sr.Status, &sr.ScreenedAt, &sr.TransactionID); err != nil {
			continue
		}
		results = append(results, sr)
	}
	respondJSON(w, 200, map[string]interface{}{"count": len(results), "results": results})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	dbStatus := "disconnected"
	if app.db != nil {
		if err := app.db.Ping(); err == nil {
			dbStatus = "connected"
		}
	}
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName, "version": "1.0.0", "database": dbStatus,
		"lists": []string{"OFAC_SDN", "EU_SANCTIONS", "UN_CONSOLIDATED", "NFIU_WATCHLIST"},
	})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "sanctions-streaming-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "sanctions-streaming-go")
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

	initDB()
	port := os.Getenv("PORT")
	if port == "" {
		port = "9050"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/sanctions/screen", screenName)
	mux.HandleFunc("/api/v1/sanctions/history", getScreenHistory)
	srv := &http.Server{Addr: ":" + port, Handler: jwtAuthMiddleware(mux)}
	go func() {
		log.Printf("[%s] Starting on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[%s] error: %v", serviceName, err)
		}
	}()
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	if app.db != nil {
		app.db.Close()
	}
	log.Printf("[%s] Shutdown complete", serviceName)
}
