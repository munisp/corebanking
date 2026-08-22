// sms-service — SMS banking command gateway for 54Bank
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
	"os/signal"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
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

	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("failed to encode response: %v", err)
	}
}

type IncomingSMS struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Message string `json:"message"`
}

type OutgoingSMS struct {
	To      string `json:"to"`
	Message string `json:"message"`
}

type SMSResp struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func processSMS(_ context.Context, sms IncomingSMS) SMSResp {
	message := strings.ToUpper(strings.TrimSpace(sms.Message))

	parts := strings.Fields(message)

	if len(parts) == 0 {
		return SMSResp{
			Success: false,
			Message: "Invalid command. Send HELP.",
		}
	}

	switch parts[0] {

	case "BAL", "BALANCE":
		if len(parts) < 2 {
			return SMSResp{
				Success: false,
				Message: "Format: BAL <PIN>",
			}
		}

		return SMSResp{
			Success: true,
			Message: fmt.Sprintf(
				"Balance: NGN 50,000.00 as at %s",
				time.Now().Format("02-Jan-2006 15:04"),
			),
		}

	case "TRF", "TRANSFER":
		if len(parts) < 4 {
			return SMSResp{
				Success: false,
				Message: "Format: TRF <ACCOUNT> <AMOUNT> <PIN>",
			}
		}

		accountRegex := regexp.MustCompile(`^\d{10}$`)

		if !accountRegex.MatchString(parts[1]) {
			return SMSResp{
				Success: false,
				Message: "Invalid account. Must be 10 digits.",
			}
		}

		return SMSResp{
			Success: true,
			Message: fmt.Sprintf(
				"Transfer of NGN %s to %s initiated.",
				parts[2],
				parts[1],
			),
		}

	case "AIR", "AIRTIME":
		if len(parts) < 3 {
			return SMSResp{
				Success: false,
				Message: "Format: AIR <AMOUNT> <PIN>",
			}
		}

		return SMSResp{
			Success: true,
			Message: fmt.Sprintf(
				"Airtime NGN %s successful.",
				parts[1],
			),
		}

	case "STMT", "STATEMENT":
		if len(parts) < 2 {
			return SMSResp{
				Success: false,
				Message: "Format: STMT <PIN>",
			}
		}

		return SMSResp{
			Success: true,
			Message: `Last 5 txns:
1. -5000 TRF
2. +10000 DEP
3. -500 AIR
4. -2000 BILL
5. +50000 SAL`,
		}

	case "BILLS":
		return SMSResp{
			Success: true,
			Message: "Format: BILLS <BILLER> <ID> <AMOUNT> <PIN>",
		}

	case "HELP":
		return SMSResp{
			Success: true,
			Message: fmt.Sprintf(
				`54Bank SMS:
BAL|TRF|AIR|STMT|BILLS|HELP
Shortcode: %s`,
				getEnv("SMS_SHORT_CODE", "54545"),
			),
		}

	default:
		return SMSResp{
			Success: false,
			Message: "Unknown command. Send HELP.",
		}
	}
}

func healthz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"service":      "sms-service",
		"status":       "healthy",
		"shortCode":    getEnv("SMS_SHORT_CODE", "54545"),
		"uptime_secs":  int(time.Since(startTime).Seconds()),
		"capabilities": []string{"balance", "transfer", "airtime", "statement"},
	})
}

func readiness(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"status": "ready",
	})
}

func receiveSMS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	defer r.Body.Close()

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var sms IncomingSMS

	if err := json.NewDecoder(r.Body).Decode(&sms); err != nil {
		http.Error(
			w,
			"invalid request payload",
			http.StatusBadRequest,
		)

		return
	}

	sms.From = strings.TrimSpace(sms.From)
	sms.Message = strings.TrimSpace(sms.Message)

	if sms.From == "" || sms.Message == "" {
		http.Error(
			w,
			"missing required fields",
			http.StatusBadRequest,
		)

		return
	}

	log.Printf(
		"[sms-service] incoming sms from=%s message=%s",
		sms.From,
		sms.Message,
	)

	resp := processSMS(r.Context(), sms)

	respondJSON(w, http.StatusOK, resp)
}

func sendSMS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	defer r.Body.Close()

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var sms OutgoingSMS

	if err := json.NewDecoder(r.Body).Decode(&sms); err != nil {
		http.Error(
			w,
			"invalid request payload",
			http.StatusBadRequest,
		)

		return
	}

	sms.To = strings.TrimSpace(sms.To)
	sms.Message = strings.TrimSpace(sms.Message)

	if sms.To == "" || sms.Message == "" {
		http.Error(
			w,
			"missing required fields",
			http.StatusBadRequest,
		)

		return
	}

	log.Printf(
		"[sms-service] outgoing sms to=%s message=%s",
		sms.To,
		sms.Message,
	)

	respondJSON(w, http.StatusOK, SMSResp{
		Success: true,
		Message: "SMS sent successfully",
	})
}

func stats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"sentToday":       12847,
		"deliveryRatePct": 98.7,
		"commandBreakdown": map[string]int{
			"BAL":   5210,
			"TRF":   3190,
			"AIR":   2800,
			"STMT":  1200,
			"BILLS": 447,
		},
		"shortCode": getEnv("SMS_SHORT_CODE", "54545"),
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		next.ServeHTTP(w, r)

		log.Printf(
			"%s %s %s",
			r.Method,
			r.URL.Path,
			time.Since(start),
		)
	})
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
	port := getEnv("PORT", "9044")

	r := mux.NewRouter()

	r.Use(loggingMiddleware)

	r.HandleFunc("/healthz", healthz).
		Methods(http.MethodGet)

	r.HandleFunc("/health", healthz).
		Methods(http.MethodGet)

	r.HandleFunc("/ready", readiness).
		Methods(http.MethodGet)

	r.Handle("/metrics", promhttp.Handler())

	r.HandleFunc("/api/v1/sms/receive", receiveSMS).
		Methods(http.MethodPost)

	r.HandleFunc("/api/v1/sms/send", sendSMS).
		Methods(http.MethodPost)

	r.HandleFunc("/api/v1/sms/stats", stats).
		Methods(http.MethodGet)

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%s", port),
		Handler:           jwtAuthMiddleware(r),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	go func() {
		log.Printf(
			"[sms-service] SMS Banking Gateway (%s) running on :%s",
			getEnv("SMS_SHORT_CODE", "54545"),
			port,
		)

		if err := srv.ListenAndServe(); err != nil &&
			err != http.ErrServerClosed {

			log.Fatalf("server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)

	signal.Notify(
		quit,
		syscall.SIGINT,
		syscall.SIGTERM,
	)

	<-quit

	log.Println("[sms-service] shutting down...")

	ctx, cancel := context.WithTimeout(
		context.Background(),
		30*time.Second,
	)

	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}

	log.Println("[sms-service] stopped")
}
