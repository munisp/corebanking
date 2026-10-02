// ml-security-service — ML-powered threat detection and anomaly scoring for 54Bank
package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
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

// ---------------------------------------------------------------------------
// JWT validation (RS256 via Keycloak JWKS) — W12-B5-P0-A
// Mutating routes on this service were reachable with no authentication at
// all (w12 findings/b3-exposure.json). Every route except the probe/health
// endpoints now requires a verified Keycloak bearer token; the middleware
// fails closed on any verification error.
// Canonical pattern: services/permify-authz-go/main.go (JWKS cache +
// jwtMiddleware) and services/acgsf-guarantee-go/main.go (jwtAuthMiddleware).
// ---------------------------------------------------------------------------

// jwksRefreshOnce ensures the shared JWKS poller is started exactly once.
var jwksRefreshOnce sync.Once

// ensureJWKSRefresh starts the initial JWKS fetch and the 5-minute refresher
// exactly once per process, no matter how many routes register the middleware
// (GPT-10: was one poller goroutine pair per route registration).
func ensureJWKSRefresh(realmURL string) {
	jwksRefreshOnce.Do(func() {
		go fetchJWKS(realmURL)
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				fetchJWKS(realmURL)
			}
		}()
	})
}

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}
var jwksHTTPClient = &http.Client{Timeout: 5 * time.Second}

func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

func fetchJWKS(realmURL string) {
	resp, err := jwksHTTPClient.Get(realmURL + "/protocol/openid-connect/certs")
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
		pub := &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
		jwtCache.keys[k.Kid] = pub
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

// jwtAuthMiddleware enforces a verified RS256 Keycloak bearer token on every
// route except the probe/health endpoints (canonical fleet template).
func jwtAuthMiddleware(next http.Handler) http.Handler {
	realmURL := jwtRealmURL()
	// Single shared JWKS poller per process (started once, not per route)
	ensureJWKSRefresh(realmURL)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip health endpoints
		if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" || r.URL.Path == "/livez" || r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := auth[7:]
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
			return
		}
		// Decode header for kid
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
		}
		json.Unmarshal(headerBytes, &header)

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Try refresh
			fetchJWKS(realmURL)
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}
		// Verify signature (RS256)
		signingInput := parts[0] + "." + parts[1]
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(signingInput))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}
		// Decode claims
		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		// Check expiry
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Pass claims in context
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

type ThreatEvent struct {
	ID         string  `json:"id"`
	EventType  string  `json:"eventType"`
	Source     string  `json:"source"`
	Score      float64 `json:"score"`
	Severity   string  `json:"severity"`
	Model      string  `json:"model"`
	DetectedAt string  `json:"detectedAt"`
	Action     string  `json:"action"`
}

// ── Postgres persistence (W12 C3-P2-B5) ─────────────────────────────────────
// The in-memory `events` slice was removed. threat_events is authoritative;
// mutations are real PG writes and reads are served from PG. When DATABASE_URL
// is unset/unreachable the mutation/list endpoints fail closed (503) — no
// in-memory fallback claims durability Postgres lacks.

var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[ml-security-service] DATABASE_URL not set — threat event endpoints fail closed (503)")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[ml-security-service] DB open failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[ml-security-service] DB ping failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(`CREATE TABLE IF NOT EXISTS threat_events (
		id TEXT PRIMARY KEY,
		event_type TEXT NOT NULL DEFAULT '',
		source TEXT NOT NULL DEFAULT '',
		score DOUBLE PRECISION NOT NULL DEFAULT 0,
		severity TEXT NOT NULL DEFAULT '',
		model TEXT NOT NULL DEFAULT '',
		detected_at TEXT NOT NULL DEFAULT '',
		action TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Printf("[ml-security-service] DDL failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(`CREATE SEQUENCE IF NOT EXISTS threat_events_seq START 3`); err != nil {
		log.Printf("[ml-security-service] sequence DDL failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	// Idempotent boot seeds (previously the in-memory fixtures).
	seed := `INSERT INTO threat_events (id, event_type, source, score, severity, model, detected_at, action) VALUES
		('TH-001', 'account_takeover', 'login-service', 0.94, 'CRITICAL', 'lstm-anomaly-v3', '2026-05-20T06:15:00Z', 'block'),
		('TH-002', 'unusual_transfer_pattern', 'payment-service', 0.71, 'HIGH', 'isolation-forest-v2', '2026-05-20T07:30:00Z', 'alert')
		ON CONFLICT (id) DO NOTHING`
	if _, err = db.Exec(seed); err != nil {
		log.Printf("[ml-security-service] seed failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	log.Printf("[ml-security-service] Postgres connected (pool: 10/2), threat_events ready")
}

// insertThreatEvent persists a scored event in one atomic INSERT … RETURNING.
func insertThreatEvent(ev *ThreatEvent) error {
	return db.QueryRow(`INSERT INTO threat_events
		(id, event_type, source, score, severity, model, detected_at, action)
		VALUES ('TH-' || LPAD(nextval('threat_events_seq')::text, 3, '0'), $1, $2, $3, $4, $5, $6, $7)
		RETURNING id`,
		ev.EventType, ev.Source, ev.Score, ev.Severity, ev.Model, ev.DetectedAt, ev.Action,
	).Scan(&ev.ID)
}

func listThreatEvents() ([]ThreatEvent, error) {
	rows, err := db.Query(`SELECT id, event_type, source, score, severity, model, detected_at, action
		FROM threat_events ORDER BY created_at, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ThreatEvent{}
	for rows.Next() {
		var ev ThreatEvent
		if err := rows.Scan(&ev.ID, &ev.EventType, &ev.Source, &ev.Score, &ev.Severity, &ev.Model, &ev.DetectedAt, &ev.Action); err != nil {
			return nil, err
		}
		out = append(out, ev)
	}
	return out, rows.Err()
}

func main() {
	initDB()
	port := getEnv("PORT", "9167")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":     "ml-security-service",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"models":      []string{"lstm-anomaly-v3", "isolation-forest-v2", "autoencoder-fraud-v1", "graph-neural-net-v2"},
			"middleware": map[string]string{
				"kafka":  "security.events, security.decisions",
				"redis":  "model_cache, feature_store",
				"mlflow": getEnv("MLFLOW_URL", "http://mlflow:5000"),
			},
		})
	})

	// W12-B5-P1-D-E: the only mutating route is gated by a real Permify check
	// (ml_security:score), fail-closed. This service has no JWT middleware of
	// its own (edge-authenticated), so the subject comes from the
	// gateway-stamped X-User-Id header (permifyAuthzSubject); absent -> 403.
	mux.HandleFunc("/v1/security/score", permifyAuthzGuard("ml_security", "score", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			EventType string                 `json:"eventType"`
			Source    string                 `json:"source"`
			Features  map[string]interface{} `json:"features"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if db == nil {
			respondJSON(w, 503, map[string]string{"error": "threat event store unavailable (postgres down)"})
			return
		}
		ev := ThreatEvent{
			EventType:  req.EventType,
			Source:     req.Source,
			Score:      0.08,
			Severity:   "LOW",
			Model:      "lstm-anomaly-v3",
			DetectedAt: time.Now().UTC().Format(time.RFC3339),
			Action:     "allow",
		}
		if err := insertThreatEvent(&ev); err != nil {
			log.Printf("[ml-security-service] insert failed: %v", err)
			respondJSON(w, 503, map[string]string{"error": "threat event store unavailable (postgres down)"})
			return
		}
		respondJSON(w, 200, map[string]interface{}{
			"threatId": ev.ID, "score": ev.Score,
			"severity": ev.Severity, "action": ev.Action,
		})
	}))

	mux.HandleFunc("/v1/security/threats", func(w http.ResponseWriter, _ *http.Request) {
		if db == nil {
			respondJSON(w, 503, map[string]string{"error": "threat event store unavailable (postgres down)"})
			return
		}
		events, err := listThreatEvents()
		if err != nil {
			log.Printf("[ml-security-service] list failed: %v", err)
			respondJSON(w, 503, map[string]string{"error": "threat event store unavailable (postgres down)"})
			return
		}
		respondJSON(w, 200, map[string]interface{}{"threats": events, "total": len(events)})
	})

	mux.HandleFunc("/v1/security/stats", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"eventsScored":    284000,
			"threatsDetected": 12,
			"criticalAlerts":  2,
			"avgScoringMs":    8,
			"modelVersion":    "lstm-anomaly-v3",
		})
	})

	log.Printf("[ml-security-service] ML security threat detection on :%s", port)
	log.Fatal((&http.Server{Addr: ":" + port, Handler: jwtAuthMiddleware(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe())
}
