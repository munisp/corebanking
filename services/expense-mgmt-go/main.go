package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func tenantID(r *http.Request) string {
	if v := r.Header.Get("x-tenant-id"); v != "" {
		return v
	}
	return r.URL.Query().Get("tenantId")
}

type Expense struct {
	ID          string  `json:"id"`
	Category    string  `json:"category"`
	Department  string  `json:"department"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	ApprovedBy  string  `json:"approved_by"`
	Date        string  `json:"date"`
	Status      string  `json:"status"`
}

type ExpenseService struct {
	db *pgxpool.Pool
}

func initDatabase(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS expenses (
			id TEXT NOT NULL,
			bank_id TEXT NOT NULL,
			category TEXT NOT NULL,
			department TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			amount NUMERIC(18,2) NOT NULL,
			currency TEXT NOT NULL DEFAULT 'NGN',
			approved_by TEXT NOT NULL DEFAULT '',
			date DATE NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (id, bank_id)
		);
		CREATE INDEX IF NOT EXISTS idx_expenses_bank_id ON expenses(bank_id);
	`)
	return err
}

func (s *ExpenseService) healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "expense-mgmt-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379")},
			"postgres":    map[string]interface{}{"url": os.Getenv("DATABASE_URL")},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "expense-mgmt-go"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003")},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233")},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002")},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000")},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181")},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080")},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000")},
		},
	})
}

func (s *ExpenseService) listItems(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		http.Error(w, "x-tenant-id header required", http.StatusBadRequest)
		return
	}

	rows, err := s.db.Query(r.Context(), `
		SELECT id, category, department, description, amount, currency, approved_by, date, status
		FROM expenses WHERE bank_id = $1 ORDER BY date DESC
	`, tid)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []Expense{}
	for rows.Next() {
		var e Expense
		var date time.Time
		if err := rows.Scan(&e.ID, &e.Category, &e.Department, &e.Description, &e.Amount, &e.Currency, &e.ApprovedBy, &date, &e.Status); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		e.Date = date.Format("2006-01-02")
		items = append(items, e)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"items": items, "total": len(items)})
}

func (s *ExpenseService) createItem(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		http.Error(w, "x-tenant-id header required", http.StatusBadRequest)
		return
	}

	var e Expense
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if e.ID == "" || e.Category == "" || e.Department == "" || e.Amount <= 0 {
		http.Error(w, "id, category, department, amount required", http.StatusBadRequest)
		return
	}
	if e.Currency == "" {
		e.Currency = "NGN"
	}
	if e.Status == "" {
		e.Status = "pending"
	}
	if e.Date == "" {
		e.Date = time.Now().Format("2006-01-02")
	}

	_, err := s.db.Exec(r.Context(), `
		INSERT INTO expenses (id, bank_id, category, department, description, amount, currency, approved_by, date, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, e.ID, tid, e.Category, e.Department, e.Description, e.Amount, e.Currency, e.ApprovedBy, e.Date, e.Status)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(e)
}

func (s *ExpenseService) getStats(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		http.Error(w, "x-tenant-id header required", http.StatusBadRequest)
		return
	}

	var total int
	var totalAmount float64
	if err := s.db.QueryRow(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM expenses WHERE bank_id = $1
	`, tid).Scan(&total, &totalAmount); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"total_expenses": total, "total_amount": totalAmount})
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "expense-mgmt-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "expense-mgmt-go")
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

	godotenv.Load()
	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := initDatabase(ctx, db); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	svc := &ExpenseService{db: db}

	http.HandleFunc("/healthz", svc.healthz)
	http.HandleFunc("/v1/expense-mgmt-go/list", svc.listItems)
	http.HandleFunc("/v1/expense-mgmt-go/stats", svc.getStats)
	http.HandleFunc("/v1/expense-mgmt-go", svc.createItem)

	port := envOr("PORT", "8192")
	fmt.Printf("Expense Management Service running on port %s\n", port)
	http.ListenAndServe(":"+port, jwtAuthMiddleware(http.DefaultServeMux))
}
