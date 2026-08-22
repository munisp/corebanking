// kpi-engine-go — KPI computation and business metrics engine for 54Bank
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
	"time"
)

var startTime = time.Now()

func getEnv(k, v string) string {
	if val := os.Getenv(k); val != "" {
		return val
	}
	return v
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

type KPI struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Category   string  `json:"category"`
	Value      float64 `json:"value"`
	Target     float64 `json:"target"`
	Unit       string  `json:"unit"`
	Period     string  `json:"period"`
	Trend      string  `json:"trend"`
	TrendValue float64 `json:"trendValue"`
	ComputedAt string  `json:"computedAt"`
}

type KPIAlert struct {
	KPIID       string  `json:"kpiId"`
	KPIName     string  `json:"kpiName"`
	Message     string  `json:"message"`
	Severity    string  `json:"severity"`
	ActualValue float64 `json:"actualValue"`
	TargetValue float64 `json:"targetValue"`
	CreatedAt   string  `json:"createdAt"`
}

var (
	mu      sync.RWMutex
	counter int
	kpis    = []KPI{
		{ID: "kpi-001", Name: "Transaction Success Rate", Category: "operations", Value: 98.7, Target: 99.0, Unit: "%", Period: "daily", Trend: "up", TrendValue: 0.3, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-002", Name: "Average Transaction Time", Category: "operations", Value: 1.2, Target: 2.0, Unit: "seconds", Period: "daily", Trend: "down", TrendValue: -0.1, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-003", Name: "Customer Acquisition Rate", Category: "growth", Value: 320, Target: 300, Unit: "customers/day", Period: "daily", Trend: "up", TrendValue: 12.5, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-004", Name: "Loan Approval Rate", Category: "credit", Value: 74.2, Target: 70.0, Unit: "%", Period: "weekly", Trend: "up", TrendValue: 2.1, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-005", Name: "Non-Performing Loan Ratio", Category: "credit", Value: 2.1, Target: 3.0, Unit: "%", Period: "monthly", Trend: "stable", TrendValue: 0.0, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-006", Name: "Revenue per Customer", Category: "finance", Value: 4250.0, Target: 4000.0, Unit: "NGN", Period: "monthly", Trend: "up", TrendValue: 6.25, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-007", Name: "Agent Network Coverage", Category: "agent_banking", Value: 87.3, Target: 90.0, Unit: "%", Period: "monthly", Trend: "up", TrendValue: 1.8, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-008", Name: "Fraud Detection Rate", Category: "risk", Value: 96.4, Target: 95.0, Unit: "%", Period: "daily", Trend: "stable", TrendValue: 0.1, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
	}
)

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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "kpi-engine-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "kpi-engine-go")
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

	port := getEnv("PORT", "9173")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":      "kpi-engine-go",
			"status":       "healthy",
			"uptime_secs":  int(time.Since(startTime).Seconds()),
			"kpis_tracked": len(kpis),
			"categories":   []string{"operations", "growth", "credit", "finance", "agent_banking", "risk"},
		})
	})

	// GET all KPIs (optionally filtered by category)
	mux.HandleFunc("/v1/kpis", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		category := r.URL.Query().Get("category")
		mu.RLock()
		result := make([]KPI, 0, len(kpis))
		for _, k := range kpis {
			if category == "" || k.Category == category {
				result = append(result, k)
			}
		}
		mu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{"kpis": result, "total": len(result)})
	})

	// POST trigger recomputation of all KPIs
	mux.HandleFunc("/v1/kpis/recompute", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		mu.Lock()
		counter++
		// Update computedAt to simulate recompute
		for i := range kpis {
			kpis[i].ComputedAt = time.Now().UTC().Format(time.RFC3339)
		}
		mu.Unlock()
		respondJSON(w, 200, map[string]interface{}{
			"message":    "KPI recomputation triggered",
			"job_id":     fmt.Sprintf("job-%03d", counter),
			"kpis_count": len(kpis),
			"started_at": time.Now().UTC().Format(time.RFC3339),
		})
	})

	// GET KPI by ID
	mux.HandleFunc("/v1/kpis/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		id := r.URL.Path[len("/v1/kpis/"):]
		mu.RLock()
		for _, k := range kpis {
			if k.ID == id {
				mu.RUnlock()
				respondJSON(w, 200, k)
				return
			}
		}
		mu.RUnlock()
		respondJSON(w, 404, map[string]string{"error": "KPI not found"})
	})

	// GET KPI alerts (targets breached)
	mux.HandleFunc("/v1/kpis/alerts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		mu.RLock()
		alerts := []KPIAlert{}
		for _, k := range kpis {
			if k.Trend == "down" && k.Value < k.Target {
				alerts = append(alerts, KPIAlert{
					KPIID:       k.ID,
					KPIName:     k.Name,
					Message:     fmt.Sprintf("%s is below target: %.2f %s (target: %.2f)", k.Name, k.Value, k.Unit, k.Target),
					Severity:    "warning",
					ActualValue: k.Value,
					TargetValue: k.Target,
					CreatedAt:   time.Now().UTC().Format(time.RFC3339),
				})
			}
		}
		mu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{"alerts": alerts, "total": len(alerts)})
	})

	// GET summary stats
	mux.HandleFunc("/v1/kpis/stats", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		mu.RLock()
		onTarget, belowTarget := 0, 0
		for _, k := range kpis {
			if k.Value >= k.Target {
				onTarget++
			} else {
				belowTarget++
			}
		}
		mu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{
			"total_kpis":    len(kpis),
			"on_target":     onTarget,
			"below_target":  belowTarget,
			"last_computed": time.Now().UTC().Format(time.RFC3339),
			"categories":    []string{"operations", "growth", "credit", "finance", "agent_banking", "risk"},
		})
	})

	log.Printf("[kpi-engine-go] KPI engine on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, jwtAuthMiddleware(mux)))
}
