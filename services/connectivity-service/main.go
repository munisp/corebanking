package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
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
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type ConnectivityServer struct {
	router            *mux.Router
	imageOptimizer    *AdaptiveImageOptimizer
	payloadCompressor *PayloadCompressor
	offlinePIN        *OfflinePINVerifier
}

type OptimizeImageRequest struct {
	ImageURL    string `json:"image_url"`
	ImageBase64 string `json:"image_base64,omitempty"`
	Quality     string `json:"quality"` // low, medium, high, auto
	MaxWidth    int    `json:"max_width,omitempty"`
	MaxHeight   int    `json:"max_height,omitempty"`
	Format      string `json:"format,omitempty"` // webp, jpeg, png
}

type OptimizeImageResponse struct {
	OptimizedURL     string  `json:"optimized_url,omitempty"`
	OptimizedBase64  string  `json:"optimized_base64,omitempty"`
	OriginalSize     int     `json:"original_size"`
	OptimizedSize    int     `json:"optimized_size"`
	CompressionRatio float64 `json:"compression_ratio"`
}

type CompressPayloadRequest struct {
	Data      interface{} `json:"data"`
	Algorithm string      `json:"algorithm"` // gzip, brotli, lz4
	Level     int         `json:"level,omitempty"`
}

type CompressPayloadResponse struct {
	CompressedData   string  `json:"compressed_data"`
	OriginalSize     int     `json:"original_size"`
	CompressedSize   int     `json:"compressed_size"`
	CompressionRatio float64 `json:"compression_ratio"`
	Algorithm        string  `json:"algorithm"`
}

type OfflinePINRequest struct {
	TenantID   string `json:"tenant_id"`
	CustomerID string `json:"customer_id"`
	DeviceID   string `json:"device_id"`
	PIN        string `json:"pin"`
	Challenge  string `json:"challenge"`
}

type OfflinePINResponse struct {
	Valid       bool   `json:"valid"`
	Attempts    int    `json:"attempts_remaining"`
	LockedUntil string `json:"locked_until,omitempty"`
}

type SyncQueueRequest struct {
	TenantID   string                   `json:"tenant_id"`
	CustomerID string                   `json:"customer_id"`
	DeviceID   string                   `json:"device_id"`
	Operations []map[string]interface{} `json:"operations"`
}

type SyncQueueResponse struct {
	Processed int                      `json:"processed"`
	Failed    int                      `json:"failed"`
	Results   []map[string]interface{} `json:"results"`
	SyncedAt  string                   `json:"synced_at"`
}

func NewConnectivityServer() *ConnectivityServer {
	server := &ConnectivityServer{
		router:            mux.NewRouter(),
		imageOptimizer:    NewAdaptiveImageOptimizer(),
		payloadCompressor: NewPayloadCompressor(),
		offlinePIN:        NewOfflinePINVerifier(),
	}
	server.setupRoutes()
	return server
}

func (s *ConnectivityServer) setupRoutes() {
	s.router.HandleFunc("/health", s.healthHandler).Methods("GET")
	s.router.HandleFunc("/ready", s.readyHandler).Methods("GET")
	s.router.Handle("/metrics", promhttp.Handler())

	api := s.router.PathPrefix("/api/v1").Subrouter()

	// Image optimization for low bandwidth
	api.HandleFunc("/connectivity/image/optimize", s.optimizeImageHandler).Methods("POST")
	api.HandleFunc("/connectivity/image/quality", s.detectQualityHandler).Methods("POST")

	// Payload compression
	api.HandleFunc("/connectivity/compress", s.compressPayloadHandler).Methods("POST")
	api.HandleFunc("/connectivity/decompress", s.decompressPayloadHandler).Methods("POST")

	// Offline PIN verification
	api.HandleFunc("/connectivity/offline/pin/setup", s.setupOfflinePINHandler).Methods("POST")
	api.HandleFunc("/connectivity/offline/pin/verify", s.verifyOfflinePINHandler).Methods("POST")
	api.HandleFunc("/connectivity/offline/pin/sync", s.syncOfflinePINHandler).Methods("POST")

	// Offline transaction queue
	api.HandleFunc("/connectivity/offline/queue", s.getOfflineQueueHandler).Methods("GET")
	api.HandleFunc("/connectivity/offline/queue/sync", s.syncOfflineQueueHandler).Methods("POST")

	// Network quality detection
	api.HandleFunc("/connectivity/network/quality", s.detectNetworkQualityHandler).Methods("GET")
	api.HandleFunc("/connectivity/network/optimize", s.getOptimalSettingsHandler).Methods("GET")

	// Delta sync for minimal data transfer
	api.HandleFunc("/connectivity/delta/generate", s.generateDeltaHandler).Methods("POST")
	api.HandleFunc("/connectivity/delta/apply", s.applyDeltaHandler).Methods("POST")
}

func (s *ConnectivityServer) healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

func (s *ConnectivityServer) readyHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]bool{"ready": true})
}

func (s *ConnectivityServer) optimizeImageHandler(w http.ResponseWriter, r *http.Request) {
	var req OptimizeImageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.imageOptimizer.Optimize(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *ConnectivityServer) detectQualityHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Bandwidth int `json:"bandwidth_kbps"`
		Latency   int `json:"latency_ms"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	quality := s.imageOptimizer.DetectOptimalQuality(req.Bandwidth, req.Latency)
	json.NewEncoder(w).Encode(map[string]string{"recommended_quality": quality})
}

func (s *ConnectivityServer) compressPayloadHandler(w http.ResponseWriter, r *http.Request) {
	var req CompressPayloadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.payloadCompressor.Compress(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *ConnectivityServer) decompressPayloadHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CompressedData string `json:"compressed_data"`
		Algorithm      string `json:"algorithm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	data, err := s.payloadCompressor.Decompress(req.CompressedData, req.Algorithm)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"data": data})
}

func (s *ConnectivityServer) setupOfflinePINHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID   string `json:"tenant_id"`
		CustomerID string `json:"customer_id"`
		DeviceID   string `json:"device_id"`
		PIN        string `json:"pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.offlinePIN.Setup(req.TenantID, req.CustomerID, req.DeviceID, req.PIN)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *ConnectivityServer) verifyOfflinePINHandler(w http.ResponseWriter, r *http.Request) {
	var req OfflinePINRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.offlinePIN.Verify(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *ConnectivityServer) syncOfflinePINHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID   string `json:"tenant_id"`
		CustomerID string `json:"customer_id"`
		DeviceID   string `json:"device_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.offlinePIN.Sync(req.TenantID, req.CustomerID, req.DeviceID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *ConnectivityServer) getOfflineQueueHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	customerID := r.URL.Query().Get("customer_id")
	deviceID := r.URL.Query().Get("device_id")

	queue, err := s.offlinePIN.GetOfflineQueue(tenantID, customerID, deviceID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(queue)
}

func (s *ConnectivityServer) syncOfflineQueueHandler(w http.ResponseWriter, r *http.Request) {
	var req SyncQueueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.offlinePIN.SyncQueue(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *ConnectivityServer) detectNetworkQualityHandler(w http.ResponseWriter, r *http.Request) {
	quality := map[string]interface{}{
		"connection_type": "3G",
		"bandwidth_kbps":  500,
		"latency_ms":      200,
		"packet_loss":     0.02,
		"quality_score":   65,
		"recommendation":  "Use compressed payloads and low-quality images",
	}
	json.NewEncoder(w).Encode(quality)
}

func (s *ConnectivityServer) getOptimalSettingsHandler(w http.ResponseWriter, r *http.Request) {
	bandwidth := r.URL.Query().Get("bandwidth")

	settings := map[string]interface{}{
		"image_quality":     "low",
		"compression":       "brotli",
		"compression_level": 9,
		"batch_size":        5,
		"sync_interval_ms":  30000,
		"enable_delta_sync": true,
		"prefetch_enabled":  false,
	}

	if bandwidth == "high" {
		settings["image_quality"] = "high"
		settings["compression_level"] = 1
		settings["batch_size"] = 50
		settings["sync_interval_ms"] = 5000
		settings["prefetch_enabled"] = true
	}

	json.NewEncoder(w).Encode(settings)
}

func (s *ConnectivityServer) generateDeltaHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OldVersion interface{} `json:"old_version"`
		NewVersion interface{} `json:"new_version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	delta := map[string]interface{}{
		"operations": []map[string]interface{}{
			{"op": "replace", "path": "/balance", "value": 1000},
		},
		"checksum": "abc123",
	}
	json.NewEncoder(w).Encode(delta)
}

func (s *ConnectivityServer) applyDeltaHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Base  interface{}              `json:"base"`
		Delta []map[string]interface{} `json:"delta"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result := map[string]interface{}{
		"applied": true,
		"result":  req.Base,
	}
	json.NewEncoder(w).Encode(result)
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
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := NewConnectivityServer()

	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      jwtAuthMiddleware(server.router),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Connectivity service starting on port %s", port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down connectivity service...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Connectivity service stopped")
}

// Stub implementations - integrate with existing files
type AdaptiveImageOptimizer struct{}

func NewAdaptiveImageOptimizer() *AdaptiveImageOptimizer {
	return &AdaptiveImageOptimizer{}
}

func (o *AdaptiveImageOptimizer) Optimize(req OptimizeImageRequest) (*OptimizeImageResponse, error) {
	return &OptimizeImageResponse{
		OptimizedURL:     req.ImageURL,
		OriginalSize:     100000,
		OptimizedSize:    25000,
		CompressionRatio: 0.75,
	}, nil
}

func (o *AdaptiveImageOptimizer) DetectOptimalQuality(bandwidth, latency int) string {
	if bandwidth < 100 {
		return "low"
	} else if bandwidth < 500 {
		return "medium"
	}
	return "high"
}

type PayloadCompressor struct{}

func NewPayloadCompressor() *PayloadCompressor {
	return &PayloadCompressor{}
}

func (c *PayloadCompressor) Compress(req CompressPayloadRequest) (*CompressPayloadResponse, error) {
	return &CompressPayloadResponse{
		CompressedData:   "compressed_base64",
		OriginalSize:     1000,
		CompressedSize:   200,
		CompressionRatio: 0.80,
		Algorithm:        req.Algorithm,
	}, nil
}

func (c *PayloadCompressor) Decompress(data, algorithm string) (interface{}, error) {
	return map[string]interface{}{"decompressed": true}, nil
}

type OfflinePINVerifier struct{}

func NewOfflinePINVerifier() *OfflinePINVerifier {
	return &OfflinePINVerifier{}
}

func (v *OfflinePINVerifier) Setup(tenantID, customerID, deviceID, pin string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"setup":     true,
		"device_id": deviceID,
		"expires":   time.Now().Add(30 * 24 * time.Hour).Format(time.RFC3339),
	}, nil
}

func (v *OfflinePINVerifier) Verify(req OfflinePINRequest) (*OfflinePINResponse, error) {
	return &OfflinePINResponse{
		Valid:    true,
		Attempts: 3,
	}, nil
}

func (v *OfflinePINVerifier) Sync(tenantID, customerID, deviceID string) (map[string]interface{}, error) {
	return map[string]interface{}{"synced": true, "synced_at": time.Now().Format(time.RFC3339)}, nil
}

func (v *OfflinePINVerifier) GetOfflineQueue(tenantID, customerID, deviceID string) ([]map[string]interface{}, error) {
	return []map[string]interface{}{}, nil
}

func (v *OfflinePINVerifier) SyncQueue(req SyncQueueRequest) (*SyncQueueResponse, error) {
	return &SyncQueueResponse{
		Processed: len(req.Operations),
		Failed:    0,
		Results:   []map[string]interface{}{},
		SyncedAt:  time.Now().Format(time.RFC3339),
	}, nil
}
