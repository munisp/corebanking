package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type ConnectivityServer struct {
	router          *mux.Router
	imageOptimizer  *AdaptiveImageOptimizer
	payloadCompressor *PayloadCompressor
	offlinePIN      *OfflinePINVerifier
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
	OptimizedURL    string `json:"optimized_url,omitempty"`
	OptimizedBase64 string `json:"optimized_base64,omitempty"`
	OriginalSize    int    `json:"original_size"`
	OptimizedSize   int    `json:"optimized_size"`
	CompressionRatio float64 `json:"compression_ratio"`
}

type CompressPayloadRequest struct {
	Data        interface{} `json:"data"`
	Algorithm   string      `json:"algorithm"` // gzip, brotli, lz4
	Level       int         `json:"level,omitempty"`
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
	Processed   int                      `json:"processed"`
	Failed      int                      `json:"failed"`
	Results     []map[string]interface{} `json:"results"`
	SyncedAt    string                   `json:"synced_at"`
}

func NewConnectivityServer() *ConnectivityServer {
	server := &ConnectivityServer{
		router:          mux.NewRouter(),
		imageOptimizer:  NewAdaptiveImageOptimizer(),
		payloadCompressor: NewPayloadCompressor(),
		offlinePIN:      NewOfflinePINVerifier(),
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
		"image_quality":      "low",
		"compression":        "brotli",
		"compression_level":  9,
		"batch_size":         5,
		"sync_interval_ms":   30000,
		"enable_delta_sync":  true,
		"prefetch_enabled":   false,
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

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := NewConnectivityServer()

	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      server.router,
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
