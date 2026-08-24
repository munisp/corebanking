package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

// Network Optimization Service
// Optimizes API responses for 2G/3G networks and low-bandwidth scenarios
// Integrates with Redis for caching, APISIX for routing, Dapr for service mesh

// Configuration
type Config struct {
	Port              string
	RedisAddr         string
	APISIXAddr        string
	DaprPort          string
	MaxPayloadSize    int64
	CompressionLevel  int
	CacheTTL          time.Duration
	DeltaSyncEnabled  bool
	ImageOptimization bool
}

func loadConfig() *Config {
	return &Config{
		Port:              getEnv("PORT", "8092"),
		RedisAddr:         getEnv("REDIS_ADDR", "redis-master:6379"),
		APISIXAddr:        getEnv("APISIX_ADDR", "apisix:9080"),
		DaprPort:          getEnv("DAPR_HTTP_PORT", "3500"),
		MaxPayloadSize:    50 * 1024, // 50KB max for 2G
		CompressionLevel:  9,         // Maximum compression
		CacheTTL:          5 * time.Minute,
		DeltaSyncEnabled:  true,
		ImageOptimization: true,
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// NetworkType represents connection type
type NetworkType string

const (
	Network2G   NetworkType = "2g"
	Network3G   NetworkType = "3g"
	Network4G   NetworkType = "4g"
	Network5G   NetworkType = "5g"
	NetworkWiFi NetworkType = "wifi"
	NetworkNone NetworkType = "none"
)

// NetworkProfile contains optimization settings per network type
type NetworkProfile struct {
	MaxPayloadSize   int64         `json:"max_payload_size"`
	CompressionLevel int           `json:"compression_level"`
	ImageQuality     int           `json:"image_quality"`
	BatchSize        int           `json:"batch_size"`
	RequestTimeout   time.Duration `json:"request_timeout"`
	RetryCount       int           `json:"retry_count"`
	RetryDelay       time.Duration `json:"retry_delay"`
	PrefetchEnabled  bool          `json:"prefetch_enabled"`
	DeltaSyncEnabled bool          `json:"delta_sync_enabled"`
	TextOnlyMode     bool          `json:"text_only_mode"`
	ProgressiveLoad  bool          `json:"progressive_load"`
}

// NetworkProfiles defines optimization profiles per network type
var NetworkProfiles = map[NetworkType]NetworkProfile{
	Network2G: {
		MaxPayloadSize:   20 * 1024, // 20KB
		CompressionLevel: 9,
		ImageQuality:     30,
		BatchSize:        5,
		RequestTimeout:   60 * time.Second,
		RetryCount:       5,
		RetryDelay:       5 * time.Second,
		PrefetchEnabled:  false,
		DeltaSyncEnabled: true,
		TextOnlyMode:     true,
		ProgressiveLoad:  true,
	},
	Network3G: {
		MaxPayloadSize:   100 * 1024, // 100KB
		CompressionLevel: 6,
		ImageQuality:     50,
		BatchSize:        20,
		RequestTimeout:   30 * time.Second,
		RetryCount:       3,
		RetryDelay:       2 * time.Second,
		PrefetchEnabled:  true,
		DeltaSyncEnabled: true,
		TextOnlyMode:     false,
		ProgressiveLoad:  true,
	},
	Network4G: {
		MaxPayloadSize:   500 * 1024, // 500KB
		CompressionLevel: 4,
		ImageQuality:     80,
		BatchSize:        50,
		RequestTimeout:   15 * time.Second,
		RetryCount:       2,
		RetryDelay:       1 * time.Second,
		PrefetchEnabled:  true,
		DeltaSyncEnabled: true,
		TextOnlyMode:     false,
		ProgressiveLoad:  false,
	},
	Network5G: {
		MaxPayloadSize:   2 * 1024 * 1024, // 2MB
		CompressionLevel: 1,
		ImageQuality:     100,
		BatchSize:        100,
		RequestTimeout:   10 * time.Second,
		RetryCount:       1,
		RetryDelay:       500 * time.Millisecond,
		PrefetchEnabled:  true,
		DeltaSyncEnabled: false,
		TextOnlyMode:     false,
		ProgressiveLoad:  false,
	},
	NetworkWiFi: {
		MaxPayloadSize:   5 * 1024 * 1024, // 5MB
		CompressionLevel: 1,
		ImageQuality:     100,
		BatchSize:        100,
		RequestTimeout:   10 * time.Second,
		RetryCount:       1,
		RetryDelay:       500 * time.Millisecond,
		PrefetchEnabled:  true,
		DeltaSyncEnabled: false,
		TextOnlyMode:     false,
		ProgressiveLoad:  false,
	},
}

// DeltaSyncRequest represents a delta sync request
type DeltaSyncRequest struct {
	DeviceID      string            `json:"device_id"`
	TenantID      string            `json:"tenant_id"`
	LastSyncHash  string            `json:"last_sync_hash"`
	LastSyncTime  *time.Time        `json:"last_sync_time"`
	ResourceTypes []string          `json:"resource_types"`
	NetworkType   NetworkType       `json:"network_type"`
	Checksums     map[string]string `json:"checksums"` // resource_id -> checksum
}

// DeltaSyncResponse represents delta sync response
type DeltaSyncResponse struct {
	Changes        []ResourceChange `json:"changes"`
	Deletions      []string         `json:"deletions"`
	NewSyncHash    string           `json:"new_sync_hash"`
	SyncTime       time.Time        `json:"sync_time"`
	HasMore        bool             `json:"has_more"`
	NextCursor     string           `json:"next_cursor,omitempty"`
	TotalChanges   int              `json:"total_changes"`
	Compressed     bool             `json:"compressed"`
	OriginalSize   int              `json:"original_size"`
	CompressedSize int              `json:"compressed_size"`
}

// ResourceChange represents a changed resource
type ResourceChange struct {
	ID         string         `json:"id"`
	Type       string         `json:"type"`
	Action     string         `json:"action"` // create, update, delete
	Data       map[string]any `json:"data,omitempty"`
	Checksum   string         `json:"checksum"`
	ModifiedAt time.Time      `json:"modified_at"`
	Priority   int            `json:"priority"` // 1=high, 2=medium, 3=low
}

// BatchRequest represents a batched API request
type BatchRequest struct {
	Requests    []SingleRequest `json:"requests"`
	NetworkType NetworkType     `json:"network_type"`
	DeviceID    string          `json:"device_id"`
	TenantID    string          `json:"tenant_id"`
}

// SingleRequest represents a single request in a batch
type SingleRequest struct {
	ID      string            `json:"id"`
	Method  string            `json:"method"`
	Path    string            `json:"path"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    json.RawMessage   `json:"body,omitempty"`
}

// BatchResponse represents batched response
type BatchResponse struct {
	Responses      []SingleResponse `json:"responses"`
	ProcessingTime int64            `json:"processing_time_ms"`
	Compressed     bool             `json:"compressed"`
}

// SingleResponse represents a single response in a batch
type SingleResponse struct {
	ID         string            `json:"id"`
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       json.RawMessage   `json:"body,omitempty"`
	Error      string            `json:"error,omitempty"`
}

// OptimizedResponse wraps response with optimization metadata
type OptimizedResponse struct {
	Data     interface{}      `json:"data"`
	Metadata ResponseMetadata `json:"_meta"`
}

// ResponseMetadata contains optimization metadata
type ResponseMetadata struct {
	Compressed     bool   `json:"compressed"`
	OriginalSize   int    `json:"original_size"`
	CompressedSize int    `json:"compressed_size"`
	CacheHit       bool   `json:"cache_hit"`
	CacheKey       string `json:"cache_key,omitempty"`
	NetworkProfile string `json:"network_profile"`
	ProcessingMs   int64  `json:"processing_ms"`
}

// NetworkOptimizationService handles network optimization
type NetworkOptimizationService struct {
	config      *Config
	redisClient *redis.Client
	mu          sync.RWMutex
}

// NewNetworkOptimizationService creates a new service
func NewNetworkOptimizationService(cfg *Config) (*NetworkOptimizationService, error) {
	redisClient := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       2, // Use DB 2 for network optimization cache
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
	}

	return &NetworkOptimizationService{
		config:      cfg,
		redisClient: redisClient,
	}, nil
}

// GetNetworkProfile returns optimization profile for network type
func (s *NetworkOptimizationService) GetNetworkProfile(c *gin.Context) {
	networkType := NetworkType(c.DefaultQuery("network_type", "4g"))

	profile, ok := NetworkProfiles[networkType]
	if !ok {
		profile = NetworkProfiles[Network4G] // Default to 4G
	}

	c.JSON(http.StatusOK, gin.H{
		"network_type": networkType,
		"profile":      profile,
	})
}

// DeltaSync handles delta synchronization
func (s *NetworkOptimizationService) DeltaSync(c *gin.Context) {
	var req DeltaSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get network profile
	profile := NetworkProfiles[req.NetworkType]
	if !profile.DeltaSyncEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Delta sync not supported for this network type"})
		return
	}

	ctx := c.Request.Context()
	startTime := time.Now()

	// Get changes since last sync
	changes, deletions, err := s.getChangesSinceLastSync(ctx, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Prioritize and limit changes based on network profile
	changes = s.prioritizeChanges(changes, profile)

	// Calculate new sync hash
	newSyncHash := s.calculateSyncHash(changes, deletions)

	response := &DeltaSyncResponse{
		Changes:      changes,
		Deletions:    deletions,
		NewSyncHash:  newSyncHash,
		SyncTime:     time.Now().UTC(),
		HasMore:      len(changes) >= profile.BatchSize,
		TotalChanges: len(changes),
	}

	// Compress if needed
	responseBytes, _ := json.Marshal(response)
	response.OriginalSize = len(responseBytes)

	if profile.CompressionLevel > 0 && len(responseBytes) > 1024 {
		compressed, err := s.compressData(responseBytes, profile.CompressionLevel)
		if err == nil && len(compressed) < len(responseBytes) {
			response.Compressed = true
			response.CompressedSize = len(compressed)
			c.Header("Content-Encoding", "gzip")
			c.Data(http.StatusOK, "application/json", compressed)
			return
		}
	}

	// Log processing time
	log.Printf("Delta sync completed in %v, changes: %d", time.Since(startTime), len(changes))

	c.JSON(http.StatusOK, response)
}

// BatchRequests handles batched API requests
func (s *NetworkOptimizationService) BatchRequests(c *gin.Context) {
	var req BatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	profile := NetworkProfiles[req.NetworkType]
	startTime := time.Now()

	// Limit batch size based on network profile
	if len(req.Requests) > profile.BatchSize {
		req.Requests = req.Requests[:profile.BatchSize]
	}

	// Process requests in parallel with concurrency limit
	responses := s.processBatchRequests(c.Request.Context(), req.Requests, profile)

	response := BatchResponse{
		Responses:      responses,
		ProcessingTime: time.Since(startTime).Milliseconds(),
	}

	// Compress response if needed
	responseBytes, _ := json.Marshal(response)
	if profile.CompressionLevel > 0 && len(responseBytes) > 1024 {
		compressed, err := s.compressData(responseBytes, profile.CompressionLevel)
		if err == nil && len(compressed) < len(responseBytes) {
			response.Compressed = true
			c.Header("Content-Encoding", "gzip")
			c.Data(http.StatusOK, "application/json", compressed)
			return
		}
	}

	c.JSON(http.StatusOK, response)
}

// OptimizeResponse optimizes a response for the given network type
func (s *NetworkOptimizationService) OptimizeResponse(c *gin.Context) {
	networkType := NetworkType(c.GetHeader("X-Network-Type"))
	if networkType == "" {
		networkType = Network4G
	}

	profile := NetworkProfiles[networkType]
	startTime := time.Now()

	// Read request body
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Check cache
	cacheKey := s.generateCacheKey(c.Request.URL.Path, body)
	if cached, err := s.redisClient.Get(c.Request.Context(), cacheKey).Bytes(); err == nil {
		c.Header("X-Cache-Hit", "true")
		c.Data(http.StatusOK, "application/json", cached)
		return
	}

	// Parse and optimize data
	var data interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	// Apply optimizations based on network profile
	optimizedData := s.applyOptimizations(data, profile)

	response := OptimizedResponse{
		Data: optimizedData,
		Metadata: ResponseMetadata{
			NetworkProfile: string(networkType),
			ProcessingMs:   time.Since(startTime).Milliseconds(),
			CacheKey:       cacheKey,
		},
	}

	responseBytes, _ := json.Marshal(response)
	response.Metadata.OriginalSize = len(body)

	// Compress if beneficial
	if profile.CompressionLevel > 0 {
		compressed, err := s.compressData(responseBytes, profile.CompressionLevel)
		if err == nil && len(compressed) < len(responseBytes) {
			response.Metadata.Compressed = true
			response.Metadata.CompressedSize = len(compressed)

			// Cache compressed response
			s.redisClient.Set(c.Request.Context(), cacheKey, compressed, s.config.CacheTTL)

			c.Header("Content-Encoding", "gzip")
			c.Data(http.StatusOK, "application/json", compressed)
			return
		}
	}

	// Cache uncompressed response
	s.redisClient.Set(c.Request.Context(), cacheKey, responseBytes, s.config.CacheTTL)

	c.JSON(http.StatusOK, response)
}

// PrefetchResources handles resource prefetching for better UX
func (s *NetworkOptimizationService) PrefetchResources(c *gin.Context) {
	var req struct {
		DeviceID    string      `json:"device_id"`
		TenantID    string      `json:"tenant_id"`
		NetworkType NetworkType `json:"network_type"`
		Resources   []string    `json:"resources"` // Resource paths to prefetch
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	profile := NetworkProfiles[req.NetworkType]
	if !profile.PrefetchEnabled {
		c.JSON(http.StatusOK, gin.H{
			"prefetched": 0,
			"message":    "Prefetch disabled for this network type",
		})
		return
	}

	// Prefetch resources in background
	go s.prefetchResourcesAsync(context.Background(), req.Resources, req.TenantID, profile)

	c.JSON(http.StatusAccepted, gin.H{
		"prefetched": len(req.Resources),
		"message":    "Prefetch initiated",
	})
}

// ImageOptimize optimizes images for network conditions
func (s *NetworkOptimizationService) ImageOptimize(c *gin.Context) {
	networkType := NetworkType(c.DefaultQuery("network", "4g"))
	profile := NetworkProfiles[networkType]

	// Get image URL or data
	imageURL := c.Query("url")
	if imageURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Image URL required"})
		return
	}

	// Return optimization parameters for client-side optimization
	// In production, could also do server-side image optimization
	c.JSON(http.StatusOK, gin.H{
		"original_url":   imageURL,
		"quality":        profile.ImageQuality,
		"max_width":      s.getMaxImageWidth(networkType),
		"format":         s.getOptimalImageFormat(networkType),
		"lazy_load":      profile.ProgressiveLoad,
		"text_only_mode": profile.TextOnlyMode,
	})
}

// getChangesSinceLastSync retrieves changes since last sync
func (s *NetworkOptimizationService) getChangesSinceLastSync(ctx context.Context, req *DeltaSyncRequest) ([]ResourceChange, []string, error) {
	changes := []ResourceChange{}
	deletions := []string{}

	for _, resourceType := range req.ResourceTypes {
		cacheKey := fmt.Sprintf("delta_sync:%s:%s", req.TenantID, resourceType)
		payload, err := s.redisClient.Get(ctx, cacheKey).Bytes()
		if err != nil {
			if err == redis.Nil {
				continue
			}
			return nil, nil, err
		}

		var cached struct {
			Changes   []ResourceChange `json:"changes"`
			Deletions []string         `json:"deletions"`
		}
		if err := json.Unmarshal(payload, &cached); err != nil {
			return nil, nil, err
		}

		changes = append(changes, cached.Changes...)
		deletions = append(deletions, cached.Deletions...)
	}

	if req.LastSyncTime != nil {
		filtered := make([]ResourceChange, 0, len(changes))
		for _, change := range changes {
			if change.ModifiedAt.After(*req.LastSyncTime) {
				filtered = append(filtered, change)
			}
		}
		changes = filtered
	}

	return changes, deletions, nil
}

// prioritizeChanges prioritizes and limits changes based on network profile
func (s *NetworkOptimizationService) prioritizeChanges(changes []ResourceChange, profile NetworkProfile) []ResourceChange {
	// Sort by priority (1=high, 2=medium, 3=low)
	// In production, use proper sorting

	// Limit to batch size
	if len(changes) > profile.BatchSize {
		changes = changes[:profile.BatchSize]
	}

	// For text-only mode, strip non-essential data
	if profile.TextOnlyMode {
		for i := range changes {
			// Remove large data fields
			delete(changes[i].Data, "image")
			delete(changes[i].Data, "attachment")
		}
	}

	return changes
}

// calculateSyncHash calculates hash for sync state
func (s *NetworkOptimizationService) calculateSyncHash(changes []ResourceChange, deletions []string) string {
	data := fmt.Sprintf("%v:%v:%d", changes, deletions, time.Now().Unix())
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:8])
}

// compressData compresses data using gzip
func (s *NetworkOptimizationService) compressData(data []byte, level int) ([]byte, error) {
	var buf bytes.Buffer
	writer, err := gzip.NewWriterLevel(&buf, level)
	if err != nil {
		return nil, err
	}

	if _, err := writer.Write(data); err != nil {
		return nil, err
	}

	if err := writer.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// processBatchRequests processes batch requests
func (s *NetworkOptimizationService) processBatchRequests(ctx context.Context, requests []SingleRequest, profile NetworkProfile) []SingleResponse {
	responses := make([]SingleResponse, len(requests))
	var wg sync.WaitGroup

	// Limit concurrency based on network type
	concurrency := 5
	if profile.TextOnlyMode {
		concurrency = 2
	}
	sem := make(chan struct{}, concurrency)

	for i, req := range requests {
		wg.Add(1)
		go func(idx int, r SingleRequest) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			responses[idx] = s.processSingleRequest(ctx, r, profile)
		}(i, req)
	}

	wg.Wait()
	return responses
}

// processSingleRequest processes a single request
func (s *NetworkOptimizationService) processSingleRequest(ctx context.Context, req SingleRequest, profile NetworkProfile) SingleResponse {
	response := SingleResponse{
		ID:         req.ID,
		StatusCode: http.StatusBadGateway,
		Headers:    make(map[string]string),
	}

	if req.Path == "" {
		response.StatusCode = http.StatusBadRequest
		response.Error = "request path is required"
		return response
	}

	path := req.Path
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	method := req.Method
	if method == "" {
		method = http.MethodGet
	}

	targetURL := fmt.Sprintf("http://%s%s", s.config.APISIXAddr, path)
	httpReq, err := http.NewRequestWithContext(ctx, method, targetURL, bytes.NewReader(req.Body))
	if err != nil {
		response.Error = err.Error()
		return response
	}

	for key, value := range req.Headers {
		httpReq.Header.Set(key, value)
	}
	if len(req.Body) > 0 && httpReq.Header.Get("Content-Type") == "" {
		httpReq.Header.Set("Content-Type", "application/json")
	}

	httpResp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		response.Error = err.Error()
		return response
	}
	defer httpResp.Body.Close()

	limitedBody, err := io.ReadAll(io.LimitReader(httpResp.Body, s.config.MaxPayloadSize*4))
	if err != nil {
		response.Error = err.Error()
		return response
	}

	response.StatusCode = httpResp.StatusCode
	if contentType := httpResp.Header.Get("Content-Type"); contentType != "" {
		response.Headers["Content-Type"] = contentType
	}
	if contentEncoding := httpResp.Header.Get("Content-Encoding"); contentEncoding != "" {
		response.Headers["Content-Encoding"] = contentEncoding
	}
	if len(limitedBody) > 0 {
		response.Body = json.RawMessage(limitedBody)
	}

	return response
}

// generateCacheKey generates cache key for request
func (s *NetworkOptimizationService) generateCacheKey(path string, body []byte) string {
	hash := sha256.Sum256(append([]byte(path), body...))
	return fmt.Sprintf("netopt:cache:%s", hex.EncodeToString(hash[:8]))
}

// applyOptimizations applies optimizations to data
func (s *NetworkOptimizationService) applyOptimizations(data interface{}, profile NetworkProfile) interface{} {
	// In production, apply various optimizations:
	// - Remove null fields
	// - Truncate long strings
	// - Remove unnecessary nested data
	// - Convert to more compact format

	return data
}

// prefetchResourcesAsync prefetches resources in background
func (s *NetworkOptimizationService) prefetchResourcesAsync(ctx context.Context, resources []string, tenantID string, profile NetworkProfile) {
	for _, resource := range resources {
		// Fetch and cache resource
		cacheKey := fmt.Sprintf("prefetch:%s:%s", tenantID, resource)

		// In production, fetch actual resource
		data := map[string]any{"resource": resource, "prefetched": true}
		dataBytes, _ := json.Marshal(data)

		s.redisClient.Set(ctx, cacheKey, dataBytes, 10*time.Minute)
	}
}

// getMaxImageWidth returns max image width for network type
func (s *NetworkOptimizationService) getMaxImageWidth(networkType NetworkType) int {
	widths := map[NetworkType]int{
		Network2G:   320,
		Network3G:   640,
		Network4G:   1024,
		Network5G:   2048,
		NetworkWiFi: 2048,
	}
	if w, ok := widths[networkType]; ok {
		return w
	}
	return 1024
}

// getOptimalImageFormat returns optimal image format for network type
func (s *NetworkOptimizationService) getOptimalImageFormat(networkType NetworkType) string {
	if networkType == Network2G || networkType == Network3G {
		return "webp" // Better compression
	}
	return "jpeg"
}

// DataSaverMode handles data saver mode configuration
func (s *NetworkOptimizationService) DataSaverMode(c *gin.Context) {
	enabled := c.DefaultQuery("enabled", "true") == "true"

	config := map[string]interface{}{
		"enabled":           enabled,
		"image_quality":     30,
		"video_disabled":    true,
		"prefetch_disabled": true,
		"compression":       "maximum",
		"text_only":         true,
		"lazy_load":         true,
		"cache_aggressive":  true,
	}

	if !enabled {
		config = map[string]interface{}{
			"enabled":           false,
			"image_quality":     100,
			"video_disabled":    false,
			"prefetch_disabled": false,
			"compression":       "normal",
			"text_only":         false,
			"lazy_load":         false,
			"cache_aggressive":  false,
		}
	}

	c.JSON(http.StatusOK, config)
}

// BandwidthEstimate estimates current bandwidth
func (s *NetworkOptimizationService) BandwidthEstimate(c *gin.Context) {
	// Generate test payload
	size, _ := strconv.Atoi(c.DefaultQuery("size", "10240")) // 10KB default
	if size > 1024*1024 {
		size = 1024 * 1024 // Max 1MB
	}

	payload := strings.Repeat("x", size)

	c.Header("X-Payload-Size", strconv.Itoa(size))
	c.Header("X-Timestamp", strconv.FormatInt(time.Now().UnixMilli(), 10))
	c.String(http.StatusOK, payload)
}

// SetupRoutes configures API routes
func (s *NetworkOptimizationService) SetupRoutes(r *gin.Engine) {
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "network-optimization"})
	})

	api := r.Group("/api/v1/network")
	{
		api.GET("/profile", s.GetNetworkProfile)
		api.POST("/delta-sync", s.DeltaSync)
		api.POST("/batch", s.BatchRequests)
		api.POST("/optimize", s.OptimizeResponse)
		api.POST("/prefetch", s.PrefetchResources)
		api.GET("/image-optimize", s.ImageOptimize)
		api.GET("/data-saver", s.DataSaverMode)
		api.GET("/bandwidth-test", s.BandwidthEstimate)
	}
}

// Close closes all connections
func (s *NetworkOptimizationService) Close() {
	if s.redisClient != nil {
		s.redisClient.Close()
	}
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + required exp claim). Fail-closed: any verification
// problem yields 401. Identity headers (X-User-Id, X-Keycloak-ID, X-Tenant-ID,
// X-User-Role) are overwritten from verified claims — caller-supplied values
// are never trusted.
func jwtAuthMiddleware() gin.HandlerFunc {
	ensureJWKSRefresh()
	return func(c *gin.Context) {
		r := c.Request
		p := r.URL.Path
		if isProbePath(p) {
			c.Next()
			return
		}
		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token format"})
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token header"})
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token header"})
			return
		}
		if header.Alg != "RS256" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unsupported token algorithm"})
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
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unknown signing key"})
				return
			}
		}
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid signature encoding"})
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
			return
		}
		claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims encoding"})
			return
		}
		var claims map[string]interface{}
		if err := json.Unmarshal(claimsBytes, &claims); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}
		exp, ok := claims["exp"].(float64)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token missing exp claim"})
			return
		}
		if time.Now().Unix() >= int64(exp) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token expired"})
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
		c.Set("jwt_claims", claims)
		c.Next()
	}
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
	cfg := loadConfig()

	service, err := NewNetworkOptimizationService(cfg)
	if err != nil {
		log.Fatalf("Failed to create service: %v", err)
	}
	defer service.Close()

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(jwtAuthMiddleware())
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	// Add compression middleware
	r.Use(func(c *gin.Context) {
		c.Header("Vary", "Accept-Encoding")
		c.Next()
	})

	service.SetupRoutes(r)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	go func() {
		log.Printf("Network Optimization Service starting on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	log.Println("Server exited")
}
