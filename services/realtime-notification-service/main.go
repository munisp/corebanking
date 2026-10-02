// realtime-notification-service — WebSocket and SSE push notifications for 54Bank
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

type PushEvent struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	EventType string `json:"eventType"`
	Payload   string `json:"payload"`
	Channel   string `json:"channel"`
	SentAt    string `json:"sentAt"`
	Delivered bool   `json:"delivered"`
}

// ── Postgres persistence (W12 C3-P2-B5) ─────────────────────────────────────
// The in-memory `evts` slice was removed. push_events is authoritative;
// mutations are real PG writes and reads are served from PG. When DATABASE_URL
// is unset/unreachable the mutation/list endpoints fail closed (503) — no
// in-memory fallback claims durability Postgres lacks.

var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[realtime-notification-service] DATABASE_URL not set — push event endpoints fail closed (503)")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[realtime-notification-service] DB open failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[realtime-notification-service] DB ping failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(`CREATE TABLE IF NOT EXISTS push_events (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL DEFAULT '',
		event_type TEXT NOT NULL DEFAULT '',
		payload JSONB NOT NULL DEFAULT '{}',
		channel TEXT NOT NULL DEFAULT '',
		sent_at TEXT NOT NULL DEFAULT '',
		delivered BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Printf("[realtime-notification-service] DDL failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(`CREATE SEQUENCE IF NOT EXISTS push_events_seq START 3`); err != nil {
		log.Printf("[realtime-notification-service] sequence DDL failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	// Idempotent boot seeds (previously the in-memory fixtures).
	seed := `INSERT INTO push_events (id, user_id, event_type, payload, channel, sent_at, delivered) VALUES
		('EVT-001', 'USR-001', 'transaction.completed', '{"amount":50000,"type":"credit"}', 'websocket', '2026-05-20T08:00:05Z', TRUE),
		('EVT-002', 'USR-002', 'fraud.alert', '{"severity":"HIGH","action":"block"}', 'websocket', '2026-05-20T08:01:00Z', TRUE)
		ON CONFLICT (id) DO NOTHING`
	if _, err = db.Exec(seed); err != nil {
		log.Printf("[realtime-notification-service] seed failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	log.Printf("[realtime-notification-service] Postgres connected (pool: 10/2), push_events ready")
}

// insertPushEvent persists a queued push event in one atomic INSERT … RETURNING.
func insertPushEvent(ev *PushEvent) error {
	return db.QueryRow(`INSERT INTO push_events
		(id, user_id, event_type, payload, channel, sent_at, delivered)
		VALUES ('EVT-' || LPAD(nextval('push_events_seq')::text, 3, '0'), $1, $2, $3::jsonb, $4, $5, $6)
		RETURNING id`,
		ev.UserID, ev.EventType, ev.Payload, ev.Channel, ev.SentAt, ev.Delivered,
	).Scan(&ev.ID)
}

func listPushEvents() ([]PushEvent, error) {
	rows, err := db.Query(`SELECT id, user_id, event_type, payload, channel, sent_at, delivered
		FROM push_events ORDER BY created_at, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PushEvent{}
	for rows.Next() {
		var ev PushEvent
		if err := rows.Scan(&ev.ID, &ev.UserID, &ev.EventType, &ev.Payload, &ev.Channel, &ev.SentAt, &ev.Delivered); err != nil {
			return nil, err
		}
		out = append(out, ev)
	}
	return out, rows.Err()
}

func main() {
	initDB()
	port := getEnv("PORT", "9171")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":     "realtime-notification-service",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"transports":  []string{"websocket", "sse", "long-polling"},
			"middleware": map[string]string{
				"kafka": "notifications.realtime",
				"redis": "presence_store, pub_sub",
			},
		})
	})

	mux.HandleFunc("/v1/notifications/push", permifyAuthzGuard("notification", "push", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			UserID    string `json:"userId"`
			EventType string `json:"eventType"`
			Payload   string `json:"payload"`
			Channel   string `json:"channel"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if db == nil {
			respondJSON(w, 503, map[string]string{"error": "push event store unavailable (postgres down)"})
			return
		}
		ev := PushEvent{
			UserID:    req.UserID,
			EventType: req.EventType,
			Payload:   req.Payload,
			Channel:   req.Channel,
			SentAt:    time.Now().UTC().Format(time.RFC3339),
			Delivered: true,
		}
		if err := insertPushEvent(&ev); err != nil {
			log.Printf("[realtime-notification-service] insert failed: %v", err)
			respondJSON(w, 503, map[string]string{"error": "push event store unavailable (postgres down)"})
			return
		}
		respondJSON(w, 202, map[string]interface{}{"eventId": ev.ID, "queued": true})
	}))

	mux.HandleFunc("/v1/notifications/events", permifyAuthzGuard("notification", "events", func(w http.ResponseWriter, _ *http.Request) {
		if db == nil {
			respondJSON(w, 503, map[string]string{"error": "push event store unavailable (postgres down)"})
			return
		}
		evts, err := listPushEvents()
		if err != nil {
			log.Printf("[realtime-notification-service] list failed: %v", err)
			respondJSON(w, 503, map[string]string{"error": "push event store unavailable (postgres down)"})
			return
		}
		respondJSON(w, 200, map[string]interface{}{"events": evts, "total": len(evts)})
	}))

	mux.HandleFunc("/v1/notifications/ws/stats", permifyAuthzGuard("notification", "view", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"activeConnections": 8420,
			"eventsDelivered":   284000,
			"avgDeliveryMs":     45,
			"reconnectRate":     0.02,
		})
	}))

	log.Printf("[realtime-notification-service] Realtime push notifications on :%s", port)
	log.Fatal((&http.Server{Addr: ":" + port, Handler: jwtAuthMiddleware(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe())
}
