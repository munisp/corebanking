package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
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

	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// sharedHTTPClient is a process-wide pooled HTTP client for outbound calls
// (replaces per-call &http.Client{} construction).
var sharedHTTPClient = &http.Client{
	Timeout: 10 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 25,
		IdleConnTimeout:     90 * time.Second,
	},
}

type GamificationServer struct {
	router *mux.Router
	engine *GamificationEngine
}

type AwardPointsRequest struct {
	TenantID   string                 `json:"tenant_id"`
	CustomerID string                 `json:"customer_id"`
	Action     string                 `json:"action"`
	Points     int                    `json:"points"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

type AwardPointsResponse struct {
	TransactionID string `json:"transaction_id"`
	CustomerID    string `json:"customer_id"`
	PointsAwarded int    `json:"points_awarded"`
	TotalPoints   int    `json:"total_points"`
	NewLevel      string `json:"new_level,omitempty"`
}

type RedeemPointsRequest struct {
	TenantID   string `json:"tenant_id"`
	CustomerID string `json:"customer_id"`
	Points     int    `json:"points"`
	RewardID   string `json:"reward_id"`
}

type RedeemPointsResponse struct {
	TransactionID   string                 `json:"transaction_id"`
	PointsRedeemed  int                    `json:"points_redeemed"`
	RemainingPoints int                    `json:"remaining_points"`
	RewardDetails   map[string]interface{} `json:"reward_details"`
}

// NOTE (C3-P2-B5-go-2): these three API types were renamed
// (LeaderboardEntry→leaderboardRow, Achievement→achievementDef,
// Challenge→challengeDef) because gamification.go declares same-named types
// with incompatible shapes — the pristine tree did not compile (pre-existing
// duplicate-declaration break). JSON tags are unchanged, so the wire contract
// is preserved.

type leaderboardRow struct {
	Rank       int      `json:"rank"`
	CustomerID string   `json:"customer_id"`
	Name       string   `json:"name"`
	Points     int      `json:"points"`
	Level      string   `json:"level"`
	Badges     []string `json:"badges"`
}

type achievementDef struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Points      int    `json:"points"`
	Icon        string `json:"icon"`
	UnlockedAt  string `json:"unlocked_at,omitempty"`
}

type challengeDef struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Target      int    `json:"target"`
	Progress    int    `json:"progress"`
	Reward      int    `json:"reward"`
	ExpiresAt   string `json:"expires_at"`
	Status      string `json:"status"`
}

func NewGamificationServer() *GamificationServer {
	server := &GamificationServer{
		router: mux.NewRouter(),
		engine: NewGamificationEngine(),
	}
	server.setupRoutes()
	return server
}

func (s *GamificationServer) setupRoutes() {
	s.router.HandleFunc("/health", s.healthHandler).Methods("GET")
	s.router.HandleFunc("/ready", s.readyHandler).Methods("GET")
	s.router.Handle("/metrics", promhttp.Handler())

	api := s.router.PathPrefix("/api/v1").Subrouter()

	// Points management
	api.HandleFunc("/gamification/points/award", permifyAuthzGuard("gamification_service", "award", s.awardPointsHandler)).Methods("POST")
	api.HandleFunc("/gamification/points/redeem", permifyAuthzGuard("gamification_service", "redeem", s.redeemPointsHandler)).Methods("POST")
	api.HandleFunc("/gamification/points/{customerId}", permifyAuthzGuard("gamification_service", "view", s.getPointsHandler)).Methods("GET")
	api.HandleFunc("/gamification/points/{customerId}/history", permifyAuthzGuard("gamification_service", "view", s.getPointsHistoryHandler)).Methods("GET")

	// Leaderboards
	api.HandleFunc("/gamification/leaderboard", permifyAuthzGuard("gamification_service", "view", s.getLeaderboardHandler)).Methods("GET")
	api.HandleFunc("/gamification/leaderboard/{customerId}/rank", permifyAuthzGuard("gamification_service", "view", s.getCustomerRankHandler)).Methods("GET")

	// Achievements and badges
	api.HandleFunc("/gamification/achievements", permifyAuthzGuard("gamification_service", "view", s.getAchievementsHandler)).Methods("GET")
	api.HandleFunc("/gamification/achievements/{customerId}", permifyAuthzGuard("gamification_service", "view", s.getCustomerAchievementsHandler)).Methods("GET")
	api.HandleFunc("/gamification/badges/{customerId}", permifyAuthzGuard("gamification_service", "view", s.getCustomerBadgesHandler)).Methods("GET")

	// Challenges
	api.HandleFunc("/gamification/challenges", permifyAuthzGuard("gamification_service", "view", s.getChallengesHandler)).Methods("GET")
	api.HandleFunc("/gamification/challenges/{customerId}", permifyAuthzGuard("gamification_service", "view", s.getCustomerChallengesHandler)).Methods("GET")
	api.HandleFunc("/gamification/challenges/{challengeId}/join", permifyAuthzGuard("gamification_service", "join", s.joinChallengeHandler)).Methods("POST")
	api.HandleFunc("/gamification/challenges/{challengeId}/progress", permifyAuthzGuard("gamification_service", "progress", s.updateChallengeProgressHandler)).Methods("POST")

	// Rewards catalog
	api.HandleFunc("/gamification/rewards", permifyAuthzGuard("gamification_service", "view", s.getRewardsCatalogHandler)).Methods("GET")
	api.HandleFunc("/gamification/rewards/{rewardId}", permifyAuthzGuard("gamification_service", "view", s.getRewardDetailsHandler)).Methods("GET")

	// Levels and tiers
	api.HandleFunc("/gamification/levels", permifyAuthzGuard("gamification_service", "view", s.getLevelsHandler)).Methods("GET")
	api.HandleFunc("/gamification/levels/{customerId}", permifyAuthzGuard("gamification_service", "view", s.getCustomerLevelHandler)).Methods("GET")
}

// writeEngineError maps engine errors to responses: store failures
// (errStore) fail closed with 503 persistence_unavailable; domain errors keep
// the caller-supplied status (C3-P2-B5-go-2).
func writeEngineError(w http.ResponseWriter, err error, status int) {
	if errors.Is(err, errStore) {
		http.Error(w, `{"error":"persistence_unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	http.Error(w, err.Error(), status)
}

func (s *GamificationServer) healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

func (s *GamificationServer) readyHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]bool{"ready": true})
}

func (s *GamificationServer) awardPointsHandler(w http.ResponseWriter, r *http.Request) {
	var req AwardPointsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.engine.AwardPoints(req.TenantID, req.CustomerID, req.Action, req.Points)
	if err != nil {
		writeEngineError(w, err, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *GamificationServer) redeemPointsHandler(w http.ResponseWriter, r *http.Request) {
	var req RedeemPointsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.engine.RedeemPoints(req.TenantID, req.CustomerID, req.Points, req.RewardID)
	if err != nil {
		writeEngineError(w, err, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *GamificationServer) getPointsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	points, err := s.engine.GetPoints(tenantID, customerID)
	if err != nil {
		writeEngineError(w, err, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(points)
}

func (s *GamificationServer) getPointsHistoryHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	history, err := s.engine.GetPointsHistory(tenantID, customerID)
	if err != nil {
		writeEngineError(w, err, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(history)
}

func (s *GamificationServer) getLeaderboardHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "weekly"
	}

	leaderboard, err := s.engine.GetLeaderboard(tenantID, period)
	if err != nil {
		writeEngineError(w, err, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(leaderboard)
}

func (s *GamificationServer) getCustomerRankHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	rank, err := s.engine.GetCustomerRank(tenantID, customerID)
	if err != nil {
		writeEngineError(w, err, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(rank)
}

func (s *GamificationServer) getAchievementsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	achievements, err := s.engine.GetAllAchievements(tenantID)
	if err != nil {
		writeEngineError(w, err, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(achievements)
}

func (s *GamificationServer) getCustomerAchievementsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	achievements, err := s.engine.GetCustomerAchievements(tenantID, customerID)
	if err != nil {
		writeEngineError(w, err, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(achievements)
}

func (s *GamificationServer) getCustomerBadgesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	badges, err := s.engine.GetCustomerBadges(tenantID, customerID)
	if err != nil {
		writeEngineError(w, err, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(badges)
}

func (s *GamificationServer) getChallengesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	challenges, err := s.engine.GetActiveChallenges(tenantID)
	if err != nil {
		writeEngineError(w, err, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(challenges)
}

func (s *GamificationServer) getCustomerChallengesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	challenges, err := s.engine.GetCustomerChallenges(tenantID, customerID)
	if err != nil {
		writeEngineError(w, err, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(challenges)
}

func (s *GamificationServer) joinChallengeHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	challengeID := vars["challengeId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	var req struct {
		CustomerID string `json:"customer_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.engine.JoinChallenge(tenantID, req.CustomerID, challengeID)
	if err != nil {
		writeEngineError(w, err, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *GamificationServer) updateChallengeProgressHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	challengeID := vars["challengeId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	var req struct {
		CustomerID string `json:"customer_id"`
		Progress   int    `json:"progress"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.engine.UpdateChallengeProgress(tenantID, req.CustomerID, challengeID, req.Progress)
	if err != nil {
		writeEngineError(w, err, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *GamificationServer) getRewardsCatalogHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	rewards, err := s.engine.GetRewardsCatalog(tenantID)
	if err != nil {
		writeEngineError(w, err, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(rewards)
}

func (s *GamificationServer) getRewardDetailsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	rewardID := vars["rewardId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	reward, err := s.engine.GetRewardDetails(tenantID, rewardID)
	if err != nil {
		writeEngineError(w, err, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(reward)
}

func (s *GamificationServer) getLevelsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	levels, err := s.engine.GetLevels(tenantID)
	if err != nil {
		writeEngineError(w, err, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(levels)
}

func (s *GamificationServer) getCustomerLevelHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	customerID := vars["customerId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	level, err := s.engine.GetCustomerLevel(tenantID, customerID)
	if err != nil {
		writeEngineError(w, err, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(level)
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + required exp claim). Fail-closed: any verification
// problem yields 401. Identity headers (X-User-Id, X-Keycloak-ID, X-Tenant-ID,
// X-User-Role) are overwritten from verified claims — caller-supplied values
// are never trusted.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	ensureJWKSRefresh()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if isProbePath(p) {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
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
		if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}
		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Unknown key — refresh once and retry (key rotation).
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
		claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			http.Error(w, `{"error":"invalid claims encoding"}`, http.StatusUnauthorized)
			return
		}
		var claims map[string]interface{}
		if err := json.Unmarshal(claimsBytes, &claims); err != nil {
			http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
			return
		}
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Identity headers come ONLY from verified claims; overwrite or drop any
		// caller-supplied values before invoking the handler.
		if sub, ok := claims["sub"].(string); ok && sub != "" {
			r.Header.Set("X-User-Id", sub)
			r.Header.Set("X-Keycloak-ID", sub)
		} else {
			r.Header.Del("X-User-Id")
			r.Header.Del("X-Keycloak-ID")
		}
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		r.Header.Del("X-User-Role")
		if ra, ok := claims["realm_access"].(map[string]interface{}); ok {
			if roleList, ok := ra["roles"].([]interface{}); ok {
				roles := make([]string, 0, len(roleList))
				for _, v := range roleList {
					if s, ok := v.(string); ok {
						roles = append(roles, s)
					}
				}
				if len(roles) > 0 {
					r.Header.Set("X-User-Role", strings.Join(roles, ","))
				}
			}
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// --- JWT Validation (Keycloak JWKS, RS256, fail-closed) ---

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

var jwksRefreshOnce sync.Once

// jwtRealmURL returns the Keycloak realm base URL used to fetch JWKS keys.
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

// fetchJWKS refreshes the RSA public keys used to verify Bearer tokens.
func fetchJWKS(realmURL string) {
	resp, err := sharedHTTPClient.Get(realmURL + "/protocol/openid-connect/certs")
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
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil || len(nBytes) == 0 {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil || len(eBytes) == 0 {
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

// ensureJWKSRefresh starts the initial JWKS fetch and the 5-minute refresher
// exactly once per process.
func ensureJWKSRefresh() {
	jwksRefreshOnce.Do(func() {
		go fetchJWKS(jwtRealmURL())
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				fetchJWKS(jwtRealmURL())
			}
		}()
	})
}

// isProbePath reports whether p is a health/metrics endpoint that must remain
// unauthenticated for orchestrators (exact or suffixed probe paths).
func isProbePath(p string) bool {
	switch p {
	case "/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics", "/ping":
		return true
	}
	for _, s := range []string{"/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics"} {
		if strings.HasSuffix(p, s) {
			return true
		}
	}
	return false
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

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := NewGamificationServer()

	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           jwtAuthMiddleware(server.router),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("Gamification service starting on port %s", port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down gamification service...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Gamification service stopped")
}

type rewardCatalogEntry struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	PointsRequired int    `json:"points_required"`
	Type           string `json:"type"`
}

// errStore is returned by every engine method when Postgres is unavailable.
// Gamification points are money-like balances: the engine fails closed (HTTP
// 503 via writeEngineError) rather than falling back to volatile in-memory
// state (C3-P2-B5-go-2).
var errStore = errors.New("persistence_unavailable")

// GamificationEngine is backed by Postgres: gamification_points +
// gamification_points_history (money-like customer balances, keyed by
// tenant+customer), gamification_achievements / gamification_reward_catalog /
// gamification_challenges (global catalogs, seeded idempotently at boot), and
// gamification_customer_challenges (per-customer join/progress state). All
// balance mutations are transactional upserts / conditional decrements —
// data survives restart; the former in-memory maps were removed.
type GamificationEngine struct {
	db *sql.DB
}

func NewGamificationEngine() *GamificationEngine {
	e := &GamificationEngine{}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[gamification] DATABASE_URL not set — persistence unavailable (fail-closed)")
		return e
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[gamification] db open failed: %v — persistence unavailable (fail-closed)", err)
		return e
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err := db.Ping(); err != nil {
		log.Printf("[gamification] db ping failed: %v — persistence unavailable (fail-closed)", err)
		return e
	}
	e.db = db
	e.initSchema()
	log.Printf("[gamification] Postgres connected (pool: 25/5)")
	return e
}

// initSchema creates the gamification tables idempotently and seeds the
// catalogs that were previously hard-coded in the engine constructor.
func (e *GamificationEngine) initSchema() {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS gamification_points (
			tenant_id TEXT NOT NULL,
			customer_id TEXT NOT NULL,
			points INTEGER NOT NULL DEFAULT 0,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (tenant_id, customer_id)
		)`,
		`CREATE TABLE IF NOT EXISTS gamification_points_history (
			id BIGSERIAL PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			customer_id TEXT NOT NULL,
			action TEXT NOT NULL,
			points INTEGER NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_gam_points_history_cust ON gamification_points_history(tenant_id, customer_id, created_at)`,
		`CREATE TABLE IF NOT EXISTS gamification_achievements (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			points INTEGER NOT NULL DEFAULT 0,
			icon TEXT NOT NULL DEFAULT ''
		)`,
		`CREATE TABLE IF NOT EXISTS gamification_reward_catalog (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			points_required INTEGER NOT NULL DEFAULT 0,
			type TEXT NOT NULL DEFAULT ''
		)`,
		`CREATE TABLE IF NOT EXISTS gamification_challenges (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			target INTEGER NOT NULL DEFAULT 0,
			reward INTEGER NOT NULL DEFAULT 0,
			expires_at TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'active'
		)`,
		`CREATE TABLE IF NOT EXISTS gamification_customer_challenges (
			tenant_id TEXT NOT NULL,
			customer_id TEXT NOT NULL,
			challenge_id TEXT NOT NULL,
			progress INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'active',
			challenge JSONB NOT NULL DEFAULT '{}'::jsonb,
			joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (tenant_id, customer_id, challenge_id)
		)`,
	}
	for _, stmt := range stmts {
		if _, err := e.db.Exec(stmt); err != nil {
			log.Fatalf("[gamification] schema init failed: %v", err)
		}
	}
	// Idempotent catalog seeds (previously in-memory constructor literals).
	seeds := []string{
		`INSERT INTO gamification_achievements (id, name, description, points, icon) VALUES
			('first_transfer', 'First Transfer', 'Complete your first transfer', 50, 'transfer'),
			('saver_1000', 'Saver 1000', 'Reach 1,000 points', 100, 'trophy')
			ON CONFLICT (id) DO NOTHING`,
		`INSERT INTO gamification_reward_catalog (id, name, points_required, type) VALUES
			('airtime_100', 'Airtime 100', 500, 'airtime'),
			('cashback_500', 'Cashback 500', 2000, 'cashback')
			ON CONFLICT (id) DO NOTHING`,
		fmt.Sprintf(`INSERT INTO gamification_challenges (id, name, description, target, reward, expires_at, status) VALUES
			('weekly_saver', 'Weekly Saver', 'Complete five qualifying savings actions this week', 5, 100, '%s', 'active'),
			('roundup_champion', 'Round-Up Champion', 'Complete ten round-up savings events', 10, 250, '%s', 'active')
			ON CONFLICT (id) DO NOTHING`,
			time.Now().Add(7*24*time.Hour).Format(time.RFC3339),
			time.Now().Add(14*24*time.Hour).Format(time.RFC3339)),
	}
	for _, stmt := range seeds {
		if _, err := e.db.Exec(stmt); err != nil {
			log.Printf("[gamification] catalog seed (may already exist): %v", err)
		}
	}
}

// normTenant keeps a stable partition key when the caller carries no tenant
// identity (the pre-PG engine ignored tenantID entirely; customer data is now
// keyed by (tenant_id, customer_id)).
func normTenant(t string) string {
	if t == "" {
		return "default"
	}
	return t
}

// pointsOf reads the current balance (0 when the customer has no row yet).
func (e *GamificationEngine) pointsOf(tenantID, customerID string) (int, error) {
	var points int
	err := e.db.QueryRow(`SELECT points FROM gamification_points WHERE tenant_id = $1 AND customer_id = $2`,
		normTenant(tenantID), customerID).Scan(&points)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		log.Printf("[gamification] pointsOf failed: %v", err)
		return 0, errStore
	}
	return points, nil
}

func (e *GamificationEngine) AwardPoints(tenantID, customerID, action string, points int) (*AwardPointsResponse, error) {
	if points <= 0 {
		return nil, fmt.Errorf("points must be positive")
	}
	if e.db == nil {
		return nil, errStore
	}
	tenantID = normTenant(tenantID)
	// Transactional: balance upsert + history entry commit atomically.
	tx, err := e.db.Begin()
	if err != nil {
		log.Printf("[gamification] AwardPoints begin tx failed: %v", err)
		return nil, errStore
	}
	defer tx.Rollback()
	var total int
	err = tx.QueryRow(
		`INSERT INTO gamification_points (tenant_id, customer_id, points)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (tenant_id, customer_id)
		 DO UPDATE SET points = gamification_points.points + EXCLUDED.points, updated_at = NOW()
		 RETURNING points`, tenantID, customerID, points).Scan(&total)
	if err != nil {
		log.Printf("[gamification] AwardPoints upsert failed: %v", err)
		return nil, errStore
	}
	if _, err := tx.Exec(
		`INSERT INTO gamification_points_history (tenant_id, customer_id, action, points) VALUES ($1, $2, $3, $4)`,
		tenantID, customerID, action, points); err != nil {
		log.Printf("[gamification] AwardPoints history failed: %v", err)
		return nil, errStore
	}
	if err := tx.Commit(); err != nil {
		log.Printf("[gamification] AwardPoints commit failed: %v", err)
		return nil, errStore
	}
	return &AwardPointsResponse{
		TransactionID: fmt.Sprintf("txn_%s_%d", customerID, time.Now().UnixNano()),
		CustomerID:    customerID,
		PointsAwarded: points,
		TotalPoints:   total,
		NewLevel:      levelForPoints(total),
	}, nil
}

func (e *GamificationEngine) RedeemPoints(tenantID, customerID string, points int, rewardID string) (*RedeemPointsResponse, error) {
	if points <= 0 {
		return nil, fmt.Errorf("points must be positive")
	}
	if e.db == nil {
		return nil, errStore
	}
	tenantID = normTenant(tenantID)
	// Transactional conditional decrement: the balance row is locked FOR
	// UPDATE, sufficiency is re-checked under the lock, and the reward is
	// validated before any deduction — money-like semantics, no double-spend.
	tx, err := e.db.Begin()
	if err != nil {
		log.Printf("[gamification] RedeemPoints begin tx failed: %v", err)
		return nil, errStore
	}
	defer tx.Rollback()
	var balance int
	err = tx.QueryRow(
		`SELECT points FROM gamification_points WHERE tenant_id = $1 AND customer_id = $2 FOR UPDATE`,
		tenantID, customerID).Scan(&balance)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("insufficient points")
	}
	if err != nil {
		log.Printf("[gamification] RedeemPoints balance failed: %v", err)
		return nil, errStore
	}
	if balance < points {
		return nil, fmt.Errorf("insufficient points")
	}
	var reward rewardCatalogEntry
	err = tx.QueryRow(
		`SELECT id, name, points_required, type FROM gamification_reward_catalog WHERE id = $1`, rewardID).
		Scan(&reward.ID, &reward.Name, &reward.PointsRequired, &reward.Type)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("reward not found")
	}
	if err != nil {
		log.Printf("[gamification] RedeemPoints reward lookup failed: %v", err)
		return nil, errStore
	}
	var remaining int
	err = tx.QueryRow(
		`UPDATE gamification_points SET points = points - $3, updated_at = NOW()
		 WHERE tenant_id = $1 AND customer_id = $2 AND points >= $3
		 RETURNING points`, tenantID, customerID, points).Scan(&remaining)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("insufficient points")
	}
	if err != nil {
		log.Printf("[gamification] RedeemPoints decrement failed: %v", err)
		return nil, errStore
	}
	if _, err := tx.Exec(
		`INSERT INTO gamification_points_history (tenant_id, customer_id, action, points) VALUES ($1, $2, $3, $4)`,
		tenantID, customerID, "redeem:"+rewardID, -points); err != nil {
		log.Printf("[gamification] RedeemPoints history failed: %v", err)
		return nil, errStore
	}
	if err := tx.Commit(); err != nil {
		log.Printf("[gamification] RedeemPoints commit failed: %v", err)
		return nil, errStore
	}
	return &RedeemPointsResponse{
		TransactionID:   fmt.Sprintf("txn_%s_%d", customerID, time.Now().UnixNano()),
		PointsRedeemed:  points,
		RemainingPoints: remaining,
		RewardDetails:   map[string]interface{}{"reward_id": reward.ID, "name": reward.Name, "type": reward.Type},
	}, nil
}

func (e *GamificationEngine) GetPoints(tenantID, customerID string) (map[string]interface{}, error) {
	if e.db == nil {
		return nil, errStore
	}
	points, err := e.pointsOf(tenantID, customerID)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"customer_id": customerID, "total_points": points, "level": levelForPoints(points)}, nil
}

func (e *GamificationEngine) GetPointsHistory(tenantID, customerID string) ([]map[string]interface{}, error) {
	if e.db == nil {
		return nil, errStore
	}
	rows, err := e.db.Query(
		`SELECT action, points, created_at FROM gamification_points_history
		 WHERE tenant_id = $1 AND customer_id = $2 ORDER BY created_at ASC, id ASC`,
		normTenant(tenantID), customerID)
	if err != nil {
		log.Printf("[gamification] GetPointsHistory failed: %v", err)
		return nil, errStore
	}
	defer rows.Close()
	result := make([]map[string]interface{}, 0)
	for rows.Next() {
		var action string
		var points int
		var createdAt time.Time
		if err := rows.Scan(&action, &points, &createdAt); err != nil {
			log.Printf("[gamification] GetPointsHistory scan failed: %v", err)
			return nil, errStore
		}
		result = append(result, map[string]interface{}{"action": action, "points": points, "timestamp": createdAt.Format(time.RFC3339)})
	}
	return result, nil
}

func (e *GamificationEngine) GetLeaderboard(tenantID, period string) ([]leaderboardRow, error) {
	if e.db == nil {
		return nil, errStore
	}
	rows, err := e.db.Query(
		`SELECT customer_id, points FROM gamification_points WHERE tenant_id = $1 ORDER BY points DESC, customer_id ASC`,
		normTenant(tenantID))
	if err != nil {
		log.Printf("[gamification] GetLeaderboard failed: %v", err)
		return nil, errStore
	}
	defer rows.Close()
	entries := make([]leaderboardRow, 0)
	for rows.Next() {
		var entry leaderboardRow
		if err := rows.Scan(&entry.CustomerID, &entry.Points); err != nil {
			log.Printf("[gamification] GetLeaderboard scan failed: %v", err)
			return nil, errStore
		}
		entry.Name = entry.CustomerID
		entry.Level = levelForPoints(entry.Points)
		entry.Badges = badgesForPoints(entry.Points)
		entries = append(entries, entry)
	}
	for i := range entries {
		entries[i].Rank = i + 1
	}
	return entries, nil
}

func (e *GamificationEngine) GetCustomerRank(tenantID, customerID string) (map[string]interface{}, error) {
	entries, err := e.GetLeaderboard(tenantID, "current")
	if err != nil {
		return nil, err
	}
	for _, entry := range entries {
		if entry.CustomerID == customerID {
			return map[string]interface{}{"rank": entry.Rank, "total_participants": len(entries)}, nil
		}
	}
	return map[string]interface{}{"rank": 0, "total_participants": len(entries)}, nil
}

func (e *GamificationEngine) GetAllAchievements(tenantID string) ([]achievementDef, error) {
	if e.db == nil {
		return nil, errStore
	}
	rows, err := e.db.Query(`SELECT id, name, description, points, icon FROM gamification_achievements ORDER BY id`)
	if err != nil {
		log.Printf("[gamification] GetAllAchievements failed: %v", err)
		return nil, errStore
	}
	defer rows.Close()
	result := make([]achievementDef, 0)
	for rows.Next() {
		var a achievementDef
		if err := rows.Scan(&a.ID, &a.Name, &a.Description, &a.Points, &a.Icon); err != nil {
			log.Printf("[gamification] GetAllAchievements scan failed: %v", err)
			return nil, errStore
		}
		result = append(result, a)
	}
	return result, nil
}

func (e *GamificationEngine) GetCustomerAchievements(tenantID, customerID string) ([]achievementDef, error) {
	if e.db == nil {
		return nil, errStore
	}
	points, err := e.pointsOf(tenantID, customerID)
	if err != nil {
		return nil, err
	}
	var historyCount int
	if err := e.db.QueryRow(
		`SELECT COUNT(*) FROM gamification_points_history WHERE tenant_id = $1 AND customer_id = $2`,
		normTenant(tenantID), customerID).Scan(&historyCount); err != nil {
		log.Printf("[gamification] GetCustomerAchievements history count failed: %v", err)
		return nil, errStore
	}
	catalog, err := e.GetAllAchievements(tenantID)
	if err != nil {
		return nil, err
	}
	unlocked := []achievementDef{}
	for _, achievement := range catalog {
		if achievement.ID == "first_transfer" && historyCount > 0 {
			achievement.UnlockedAt = time.Now().Format(time.RFC3339)
			unlocked = append(unlocked, achievement)
		}
		if achievement.ID == "saver_1000" && points >= 1000 {
			achievement.UnlockedAt = time.Now().Format(time.RFC3339)
			unlocked = append(unlocked, achievement)
		}
	}
	return unlocked, nil
}

func (e *GamificationEngine) GetCustomerBadges(tenantID, customerID string) ([]string, error) {
	if e.db == nil {
		return nil, errStore
	}
	points, err := e.pointsOf(tenantID, customerID)
	if err != nil {
		return nil, err
	}
	return badgesForPoints(points), nil
}

func (e *GamificationEngine) GetActiveChallenges(tenantID string) ([]challengeDef, error) {
	if e.db == nil {
		return nil, errStore
	}
	rows, err := e.db.Query(`SELECT id, name, description, target, reward, expires_at, status FROM gamification_challenges ORDER BY id`)
	if err != nil {
		log.Printf("[gamification] GetActiveChallenges failed: %v", err)
		return nil, errStore
	}
	defer rows.Close()
	result := make([]challengeDef, 0)
	for rows.Next() {
		var c challengeDef
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.Target, &c.Reward, &c.ExpiresAt, &c.Status); err != nil {
			log.Printf("[gamification] GetActiveChallenges scan failed: %v", err)
			return nil, errStore
		}
		result = append(result, c)
	}
	return result, nil
}

func (e *GamificationEngine) GetCustomerChallenges(tenantID, customerID string) ([]challengeDef, error) {
	if e.db == nil {
		return nil, errStore
	}
	// Catalog challenges LEFT JOIN per-customer state: joined customers see
	// their persisted snapshot (progress/status), others see the catalog row.
	rows, err := e.db.Query(
		`SELECT c.id, c.name, c.description, c.target, c.reward, c.expires_at, c.status, cc.challenge
		 FROM gamification_challenges c
		 LEFT JOIN gamification_customer_challenges cc
		   ON cc.challenge_id = c.id AND cc.tenant_id = $1 AND cc.customer_id = $2
		 ORDER BY c.id`, normTenant(tenantID), customerID)
	if err != nil {
		log.Printf("[gamification] GetCustomerChallenges failed: %v", err)
		return nil, errStore
	}
	defer rows.Close()
	result := make([]challengeDef, 0)
	for rows.Next() {
		var c challengeDef
		var snapshot []byte
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.Target, &c.Reward, &c.ExpiresAt, &c.Status, &snapshot); err != nil {
			log.Printf("[gamification] GetCustomerChallenges scan failed: %v", err)
			return nil, errStore
		}
		if len(snapshot) > 0 {
			var persisted challengeDef
			if err := json.Unmarshal(snapshot, &persisted); err == nil {
				c = persisted
			}
		}
		result = append(result, c)
	}
	return result, nil
}

func (e *GamificationEngine) JoinChallenge(tenantID, customerID, challengeID string) (map[string]interface{}, error) {
	if e.db == nil {
		return nil, errStore
	}
	challenge, ok, err := e.findChallenge(challengeID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("challenge not found")
	}
	copied := challenge
	copied.Progress = 0
	snapshot, _ := json.Marshal(copied)
	// Idempotent join: re-joining replays cleanly (ON CONFLICT DO NOTHING).
	if _, err := e.db.Exec(
		`INSERT INTO gamification_customer_challenges (tenant_id, customer_id, challenge_id, progress, status, challenge)
		 VALUES ($1, $2, $3, 0, 'active', $4)
		 ON CONFLICT (tenant_id, customer_id, challenge_id) DO NOTHING`,
		normTenant(tenantID), customerID, challengeID, string(snapshot)); err != nil {
		log.Printf("[gamification] JoinChallenge failed: %v", err)
		return nil, errStore
	}
	return map[string]interface{}{"joined": true, "challenge_id": challengeID}, nil
}

func (e *GamificationEngine) UpdateChallengeProgress(tenantID, customerID, challengeID string, progress int) (map[string]interface{}, error) {
	if e.db == nil {
		return nil, errStore
	}
	tenantID = normTenant(tenantID)
	// Transactional: state row locked FOR UPDATE; completion reward is a
	// balance upsert in the same tx, awarded ONLY on the transition into
	// 'completed' (the pre-PG code re-credited the reward on every call while
	// completed — money-like balances must not double-credit).
	tx, err := e.db.Begin()
	if err != nil {
		log.Printf("[gamification] UpdateChallengeProgress begin tx failed: %v", err)
		return nil, errStore
	}
	defer tx.Rollback()
	var status string
	var snapshot []byte
	err = tx.QueryRow(
		`SELECT status, challenge FROM gamification_customer_challenges
		 WHERE tenant_id = $1 AND customer_id = $2 AND challenge_id = $3 FOR UPDATE`,
		tenantID, customerID, challengeID).Scan(&status, &snapshot)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("challenge not joined")
	}
	if err != nil {
		log.Printf("[gamification] UpdateChallengeProgress load failed: %v", err)
		return nil, errStore
	}
	var challenge challengeDef
	if err := json.Unmarshal(snapshot, &challenge); err != nil {
		log.Printf("[gamification] UpdateChallengeProgress snapshot decode failed: %v", err)
		return nil, errStore
	}
	challenge.Progress = progress
	completed := progress >= challenge.Target
	newStatus := status
	if completed {
		challenge.Status = "completed"
		newStatus = "completed"
	}
	newSnapshot, _ := json.Marshal(challenge)
	if _, err := tx.Exec(
		`UPDATE gamification_customer_challenges
		 SET progress = $4, status = $5, challenge = $6, updated_at = NOW()
		 WHERE tenant_id = $1 AND customer_id = $2 AND challenge_id = $3`,
		tenantID, customerID, challengeID, progress, newStatus, string(newSnapshot)); err != nil {
		log.Printf("[gamification] UpdateChallengeProgress update failed: %v", err)
		return nil, errStore
	}
	if completed && status != "completed" {
		if _, err := tx.Exec(
			`INSERT INTO gamification_points (tenant_id, customer_id, points)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (tenant_id, customer_id)
			 DO UPDATE SET points = gamification_points.points + EXCLUDED.points, updated_at = NOW()`,
			tenantID, customerID, challenge.Reward); err != nil {
			log.Printf("[gamification] UpdateChallengeProgress reward failed: %v", err)
			return nil, errStore
		}
	}
	if err := tx.Commit(); err != nil {
		log.Printf("[gamification] UpdateChallengeProgress commit failed: %v", err)
		return nil, errStore
	}
	return map[string]interface{}{"progress": progress, "completed": completed}, nil
}

func (e *GamificationEngine) GetRewardsCatalog(tenantID string) ([]map[string]interface{}, error) {
	if e.db == nil {
		return nil, errStore
	}
	rows, err := e.db.Query(`SELECT id, name, points_required, type FROM gamification_reward_catalog ORDER BY id`)
	if err != nil {
		log.Printf("[gamification] GetRewardsCatalog failed: %v", err)
		return nil, errStore
	}
	defer rows.Close()
	result := make([]map[string]interface{}, 0)
	for rows.Next() {
		var reward rewardCatalogEntry
		if err := rows.Scan(&reward.ID, &reward.Name, &reward.PointsRequired, &reward.Type); err != nil {
			log.Printf("[gamification] GetRewardsCatalog scan failed: %v", err)
			return nil, errStore
		}
		result = append(result, map[string]interface{}{"id": reward.ID, "name": reward.Name, "points_required": reward.PointsRequired, "type": reward.Type})
	}
	return result, nil
}

func (e *GamificationEngine) GetRewardDetails(tenantID, rewardID string) (map[string]interface{}, error) {
	if e.db == nil {
		return nil, errStore
	}
	reward, ok, err := e.findReward(rewardID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("reward not found")
	}
	return map[string]interface{}{"id": reward.ID, "name": reward.Name, "points_required": reward.PointsRequired, "type": reward.Type}, nil
}

func (e *GamificationEngine) GetLevels(tenantID string) ([]map[string]interface{}, error) {
	return []map[string]interface{}{{"level": "Bronze", "min_points": 0}, {"level": "Silver", "min_points": 1000}, {"level": "Gold", "min_points": 5000}, {"level": "Platinum", "min_points": 10000}}, nil
}

func (e *GamificationEngine) GetCustomerLevel(tenantID, customerID string) (map[string]interface{}, error) {
	if e.db == nil {
		return nil, errStore
	}
	points, err := e.pointsOf(tenantID, customerID)
	if err != nil {
		return nil, err
	}
	nextLevel, pointsToNext := nextLevelForPoints(points)
	return map[string]interface{}{"level": levelForPoints(points), "points": points, "next_level": nextLevel, "points_to_next": pointsToNext}, nil
}

// findReward looks up a catalog reward in Postgres. The bool reports
// existence; a non-nil error means the store failed (mapped to 503).
func (e *GamificationEngine) findReward(rewardID string) (rewardCatalogEntry, bool, error) {
	var reward rewardCatalogEntry
	err := e.db.QueryRow(
		`SELECT id, name, points_required, type FROM gamification_reward_catalog WHERE id = $1`, rewardID).
		Scan(&reward.ID, &reward.Name, &reward.PointsRequired, &reward.Type)
	if err == sql.ErrNoRows {
		return rewardCatalogEntry{}, false, nil
	}
	if err != nil {
		log.Printf("[gamification] findReward failed: %v", err)
		return rewardCatalogEntry{}, false, errStore
	}
	return reward, true, nil
}

// findChallenge looks up a catalog challenge in Postgres (same contract as
// findReward).
func (e *GamificationEngine) findChallenge(challengeID string) (challengeDef, bool, error) {
	var challenge challengeDef
	err := e.db.QueryRow(
		`SELECT id, name, description, target, reward, expires_at, status FROM gamification_challenges WHERE id = $1`, challengeID).
		Scan(&challenge.ID, &challenge.Name, &challenge.Description, &challenge.Target, &challenge.Reward, &challenge.ExpiresAt, &challenge.Status)
	if err == sql.ErrNoRows {
		return challengeDef{}, false, nil
	}
	if err != nil {
		log.Printf("[gamification] findChallenge failed: %v", err)
		return challengeDef{}, false, errStore
	}
	return challenge, true, nil
}

func levelForPoints(points int) string {
	switch {
	case points >= 10000:
		return "Platinum"
	case points >= 5000:
		return "Gold"
	case points >= 1000:
		return "Silver"
	default:
		return "Bronze"
	}
}

func nextLevelForPoints(points int) (string, int) {
	switch {
	case points < 1000:
		return "Silver", 1000 - points
	case points < 5000:
		return "Gold", 5000 - points
	case points < 10000:
		return "Platinum", 10000 - points
	default:
		return "Top tier", 0
	}
}

func badgesForPoints(points int) []string {
	badges := []string{"member"}
	if points >= 1000 {
		badges = append(badges, "consistent_saver")
	}
	if points >= 5000 {
		badges = append(badges, "gold_circle")
	}
	if points >= 10000 {
		badges = append(badges, "platinum_elite")
	}
	return badges
}
