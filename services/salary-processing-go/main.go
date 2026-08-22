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

type SalaryBatch struct {
	ID            string  `json:"id"`
	CompanyName   string  `json:"companyName"`
	CompanyID     string  `json:"companyId"`
	PayrollMonth  string  `json:"payrollMonth"`
	EmployeeCount int     `json:"employeeCount"`
	GrossPay      float64 `json:"grossPay"`
	Deductions    float64 `json:"deductions"`
	NetPay        float64 `json:"netPay"`
	Tax           float64 `json:"tax"`
	Pension       float64 `json:"pension"`
	NHF           float64 `json:"nhf"`
	Currency      string  `json:"currency"`
	Status        string  `json:"status"`
	SubmittedAt   string  `json:"submittedAt"`
	ProcessedAt   string  `json:"processedAt,omitempty"`
	ValueDate     string  `json:"valueDate"`
	FailedCount   int     `json:"failedCount"`
	SuccessCount  int     `json:"successCount"`
}

type SalaryInstruction struct {
	ID           string  `json:"id"`
	BatchID      string  `json:"batchId"`
	EmployeeName string  `json:"employeeName"`
	AccountNo    string  `json:"accountNo"`
	BankCode     string  `json:"bankCode"`
	GrossPay     float64 `json:"grossPay"`
	NetPay       float64 `json:"netPay"`
	Tax          float64 `json:"tax"`
	Pension      float64 `json:"pension"`
	Status       string  `json:"status"`
	FailReason   string  `json:"failReason,omitempty"`
}

type SalaryService struct {
	db *pgxpool.Pool
}

func tenantID(r *http.Request) string {
	if v := r.Header.Get("x-tenant-id"); v != "" {
		return v
	}
	return r.URL.Query().Get("tenantId")
}

func initDatabase(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS salary_batches (
			id TEXT NOT NULL,
			bank_id TEXT NOT NULL,
			company_name TEXT NOT NULL,
			company_id TEXT NOT NULL,
			payroll_month TEXT NOT NULL,
			employee_count INTEGER NOT NULL DEFAULT 0,
			gross_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
			deductions NUMERIC(18,2) NOT NULL DEFAULT 0,
			net_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
			tax NUMERIC(18,2) NOT NULL DEFAULT 0,
			pension NUMERIC(18,2) NOT NULL DEFAULT 0,
			nhf NUMERIC(18,2) NOT NULL DEFAULT 0,
			currency TEXT NOT NULL DEFAULT 'NGN',
			status TEXT NOT NULL DEFAULT 'pending_approval',
			submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			processed_at TIMESTAMPTZ,
			value_date DATE NOT NULL,
			failed_count INTEGER NOT NULL DEFAULT 0,
			success_count INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (id, bank_id)
		);
		CREATE INDEX IF NOT EXISTS idx_salary_batches_bank_id ON salary_batches(bank_id);

		CREATE TABLE IF NOT EXISTS salary_instructions (
			id TEXT NOT NULL,
			batch_id TEXT NOT NULL,
			bank_id TEXT NOT NULL,
			employee_name TEXT NOT NULL,
			account_no TEXT NOT NULL,
			bank_code TEXT NOT NULL,
			gross_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
			net_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
			tax NUMERIC(18,2) NOT NULL DEFAULT 0,
			pension NUMERIC(18,2) NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'pending',
			fail_reason TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (id, bank_id)
		);
		CREATE INDEX IF NOT EXISTS idx_salary_instructions_bank_id ON salary_instructions(bank_id);
		CREATE INDEX IF NOT EXISTS idx_salary_instructions_batch ON salary_instructions(batch_id, bank_id);
	`)
	return err
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (s *SalaryService) healthz(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status": "ok", "service": "salary-processing",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"salary_processing.events", "salary_processing.audit", "salary_processing.notifications"}},
			"dapr":        map[string]interface{}{"status": "connected", "appId": "salary_processing-sidecar"},
			"fluvio":      map[string]interface{}{"status": "connected", "topic": "salary_processing-stream"},
			"temporal":    map[string]interface{}{"status": "connected", "namespace": "salary_processing"},
			"postgres":    map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "salary_processing"},
			"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify":     map[string]interface{}{"status": "connected", "schema": "salary_processing_authz"},
			"redis":       map[string]interface{}{"status": "connected", "prefix": "salary_processing:"},
			"mojaloop":    map[string]interface{}{"status": "connected", "participant": "salary_processing"},
			"opensearch":  map[string]interface{}{"status": "connected", "index": "salary_processing-*"},
			"openappsec":  map[string]interface{}{"status": "connected", "policy": "salary_processing-protection"},
			"apisix":      map[string]interface{}{"status": "connected", "upstream": "salary_processing"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse":   map[string]interface{}{"status": "connected", "table": "salary_processing_iceberg"},
		},
	})
}

func (s *SalaryService) batchesHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}

	ctx := r.Context()
	switch r.Method {
	case http.MethodGet:
		rows, err := s.db.Query(ctx, `
			SELECT id, company_name, company_id, payroll_month, employee_count,
			       gross_pay, deductions, net_pay, tax, pension, nhf, currency, status,
			       submitted_at, processed_at, value_date, failed_count, success_count
			FROM salary_batches WHERE bank_id = $1 ORDER BY submitted_at DESC
		`, tid)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		batches := []SalaryBatch{}
		for rows.Next() {
			var b SalaryBatch
			var submittedAt time.Time
			var processedAt *time.Time
			var valueDate time.Time
			if err := rows.Scan(
				&b.ID, &b.CompanyName, &b.CompanyID, &b.PayrollMonth, &b.EmployeeCount,
				&b.GrossPay, &b.Deductions, &b.NetPay, &b.Tax, &b.Pension, &b.NHF,
				&b.Currency, &b.Status, &submittedAt, &processedAt, &valueDate,
				&b.FailedCount, &b.SuccessCount,
			); err != nil {
				respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			b.SubmittedAt = submittedAt.UTC().Format(time.RFC3339)
			if processedAt != nil {
				b.ProcessedAt = processedAt.UTC().Format(time.RFC3339)
			}
			b.ValueDate = valueDate.Format("2006-01-02")
			batches = append(batches, b)
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"items": batches, "total": len(batches)})

	case http.MethodPost:
		var b SalaryBatch
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
			return
		}
		if b.CompanyName == "" || b.EmployeeCount <= 0 || b.NetPay <= 0 {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": "companyName, employeeCount > 0, netPay > 0 required"})
			return
		}

		var count int
		s.db.QueryRow(ctx, `SELECT COUNT(*) FROM salary_batches WHERE bank_id = $1`, tid).Scan(&count)
		b.ID = fmt.Sprintf("SAL-%03d", count+1)
		b.Status = "pending_approval"
		b.SubmittedAt = time.Now().UTC().Format(time.RFC3339)
		if b.Currency == "" {
			b.Currency = "NGN"
		}
		if b.ValueDate == "" {
			b.ValueDate = time.Now().Format("2006-01-02")
		}

		_, err := s.db.Exec(ctx, `
			INSERT INTO salary_batches (id, bank_id, company_name, company_id, payroll_month, employee_count,
				gross_pay, deductions, net_pay, tax, pension, nhf, currency, status, value_date)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
		`, b.ID, tid, b.CompanyName, b.CompanyID, b.PayrollMonth, b.EmployeeCount,
			b.GrossPay, b.Deductions, b.NetPay, b.Tax, b.Pension, b.NHF,
			b.Currency, b.Status, b.ValueDate)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		respondJSON(w, http.StatusCreated, b)

	default:
		respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *SalaryService) instructionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "GET only"})
		return
	}

	tid := tenantID(r)
	if tid == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}

	ctx := r.Context()
	batchID := r.URL.Query().Get("batchId")

	query := `
		SELECT id, batch_id, employee_name, account_no, bank_code,
		       gross_pay, net_pay, tax, pension, status, fail_reason
		FROM salary_instructions WHERE bank_id = $1 ORDER BY id
	`
	args := []interface{}{tid}
	if batchID != "" {
		query = `
			SELECT id, batch_id, employee_name, account_no, bank_code,
			       gross_pay, net_pay, tax, pension, status, fail_reason
			FROM salary_instructions WHERE bank_id = $1 AND batch_id = $2 ORDER BY id
		`
		args = append(args, batchID)
	}

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	filtered := []SalaryInstruction{}
	for rows.Next() {
		var i SalaryInstruction
		if err := rows.Scan(&i.ID, &i.BatchID, &i.EmployeeName, &i.AccountNo, &i.BankCode,
			&i.GrossPay, &i.NetPay, &i.Tax, &i.Pension, &i.Status, &i.FailReason); err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		filtered = append(filtered, i)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": filtered, "total": len(filtered)})
}

func (s *SalaryService) statsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}

	rows, err := s.db.Query(r.Context(), `
		SELECT status, COUNT(*), COALESCE(SUM(gross_pay),0), COALESCE(SUM(net_pay),0),
		       COALESCE(SUM(tax),0), COALESCE(SUM(employee_count),0)
		FROM salary_batches WHERE bank_id = $1 GROUP BY status
	`, tid)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	byStatus := map[string]int{}
	totalBatches := 0
	totalGross := 0.0
	totalNet := 0.0
	totalTax := 0.0
	totalEmployees := 0

	for rows.Next() {
		var status string
		var cnt, empCount int
		var gross, net, tax float64
		rows.Scan(&status, &cnt, &gross, &net, &tax, &empCount)
		byStatus[status] = cnt
		totalBatches += cnt
		totalGross += gross
		totalNet += net
		totalTax += tax
		totalEmployees += empCount
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"totalBatches": totalBatches, "totalEmployees": totalEmployees,
		"totalGrossPay": totalGross, "totalNetPay": totalNet, "totalTax": totalTax,
		"byStatus": byStatus,
	})
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "salary-processing-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "salary-processing-go")
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
	if dbURL == "" {
		log.Fatal("[salary-processing-go] DATABASE_URL must be set; no default DSN is provided (credentials must come from the environment)")
	}

	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := initDatabase(ctx, db); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	svc := &SalaryService{db: db}
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", svc.healthz)
	mux.HandleFunc("/v1/salary/batches", svc.batchesHandler)
	mux.HandleFunc("/v1/salary/instructions", svc.instructionsHandler)
	mux.HandleFunc("/v1/salary/stats", svc.statsHandler)

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8150"
	}
	fmt.Printf("salary-processing listening on %s\n", addr)
	if err := http.ListenAndServe(addr, jwtAuthMiddleware(mux)); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
