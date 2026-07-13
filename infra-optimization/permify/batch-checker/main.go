// 54Bank Permify Batch Checker — Go
// High-throughput batch permission checking with caching layer
// for millions TPS authorization decisions.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// --- Permission Cache (with TTL and size cap) ---

type CacheEntry struct {
	Allowed   bool
	ExpiresAt int64
}

type PermissionCache struct {
	mu      sync.RWMutex
	entries map[string]CacheEntry
	hits    int64
	misses  int64
	maxSize int
	ttlMs   int64
}

func NewPermissionCache(maxSize int, ttlSec int) *PermissionCache {
	pc := &PermissionCache{
		entries: make(map[string]CacheEntry, maxSize),
		maxSize: maxSize,
		ttlMs:   int64(ttlSec) * 1000,
	}

	// Periodic cleanup of expired entries
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			pc.cleanup()
		}
	}()

	return pc
}

func (pc *PermissionCache) cacheKey(entity, relation, subject string) string {
	return entity + "|" + relation + "|" + subject
}

func (pc *PermissionCache) Get(entity, relation, subject string) (bool, bool) {
	key := pc.cacheKey(entity, relation, subject)
	pc.mu.RLock()
	entry, ok := pc.entries[key]
	pc.mu.RUnlock()

	if !ok {
		atomic.AddInt64(&pc.misses, 1)
		return false, false
	}

	if time.Now().UnixMilli() > entry.ExpiresAt {
		atomic.AddInt64(&pc.misses, 1)
		return false, false
	}

	atomic.AddInt64(&pc.hits, 1)
	return entry.Allowed, true
}

func (pc *PermissionCache) Set(entity, relation, subject string, allowed bool) {
	key := pc.cacheKey(entity, relation, subject)
	pc.mu.Lock()
	if len(pc.entries) >= pc.maxSize {
		pc.evictLocked()
	}
	pc.entries[key] = CacheEntry{
		Allowed:   allowed,
		ExpiresAt: time.Now().UnixMilli() + pc.ttlMs,
	}
	pc.mu.Unlock()
}

func (pc *PermissionCache) evictLocked() {
	now := time.Now().UnixMilli()
	for k, v := range pc.entries {
		if now > v.ExpiresAt {
			delete(pc.entries, k)
		}
	}
	if len(pc.entries) >= pc.maxSize {
		count := 0
		target := pc.maxSize / 10
		for k := range pc.entries {
			delete(pc.entries, k)
			count++
			if count >= target {
				break
			}
		}
	}
}

func (pc *PermissionCache) cleanup() {
	now := time.Now().UnixMilli()
	pc.mu.Lock()
	for k, v := range pc.entries {
		if now > v.ExpiresAt {
			delete(pc.entries, k)
		}
	}
	pc.mu.Unlock()
}

// --- Batch Checker ---

type CheckRequest struct {
	Entity     string `json:"entity"`
	EntityID   string `json:"entityId"`
	Permission string `json:"permission"`
	SubjectType string `json:"subjectType"`
	SubjectID  string `json:"subjectId"`
}

type CheckResult struct {
	CheckRequest
	Allowed  bool   `json:"allowed"`
	Cached   bool   `json:"cached"`
	LatencyUs int64 `json:"latencyUs"`
}

type BatchChecker struct {
	cache       *PermissionCache
	permifyURL  string
	checked     int64
	allowed     int64
	denied      int64
}

func NewBatchChecker() *BatchChecker {
	return &BatchChecker{
		cache:      NewPermissionCache(1000000, 60), // 1M entries, 60s TTL
		permifyURL: envOr("PERMIFY_URL", "http://permify:3476"),
	}
}

func (bc *BatchChecker) Check(req CheckRequest) CheckResult {
	start := time.Now()
	entity := req.Entity + ":" + req.EntityID
	subject := req.SubjectType + ":" + req.SubjectID

	// Cache lookup
	if allowed, ok := bc.cache.Get(entity, req.Permission, subject); ok {
		atomic.AddInt64(&bc.checked, 1)
		if allowed {
			atomic.AddInt64(&bc.allowed, 1)
		} else {
			atomic.AddInt64(&bc.denied, 1)
		}
		return CheckResult{
			CheckRequest: req,
			Allowed:      allowed,
			Cached:       true,
			LatencyUs:    time.Since(start).Microseconds(),
		}
	}

	// In production: call Permify gRPC API
	// resp, err := permifyClient.Check(ctx, &permify.CheckRequest{...})
	allowed := true // Placeholder — real implementation calls Permify
	bc.cache.Set(entity, req.Permission, subject, allowed)

	atomic.AddInt64(&bc.checked, 1)
	if allowed {
		atomic.AddInt64(&bc.allowed, 1)
	} else {
		atomic.AddInt64(&bc.denied, 1)
	}

	return CheckResult{
		CheckRequest: req,
		Allowed:      allowed,
		Cached:       false,
		LatencyUs:    time.Since(start).Microseconds(),
	}
}

func (bc *BatchChecker) BatchCheck(reqs []CheckRequest) []CheckResult {
	results := make([]CheckResult, len(reqs))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 100) // Concurrency limit

	for i, req := range reqs {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, r CheckRequest) {
			defer wg.Done()
			defer func() { <-sem }()
			results[idx] = bc.Check(r)
		}(i, req)
	}
	wg.Wait()
	return results
}

// --- HTTP Handlers ---

func handleCheck(bc *BatchChecker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CheckRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		result := bc.Check(req)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

func handleBatchCheck(bc *BatchChecker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var reqs []CheckRequest
		if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		results := bc.BatchCheck(reqs)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(results)
	}
}

func handleCacheStats(bc *BatchChecker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		bc.cache.mu.RLock()
		cacheSize := len(bc.cache.entries)
		bc.cache.mu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{
			"checked":    atomic.LoadInt64(&bc.checked),
			"allowed":    atomic.LoadInt64(&bc.allowed),
			"denied":     atomic.LoadInt64(&bc.denied),
			"cacheHits":  atomic.LoadInt64(&bc.cache.hits),
			"cacheMisses": atomic.LoadInt64(&bc.cache.misses),
			"cacheSize":  cacheSize,
		})
	}
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "permify-batch-checker"})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	bc := NewBatchChecker()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/permify/check", handleCheck(bc))
	mux.HandleFunc("/v1/permify/batch-check", handleBatchCheck(bc))
	mux.HandleFunc("/v1/permify/cache-stats", handleCacheStats(bc))

	port := envOr("PORT", "8098")
	server := &http.Server{Addr: ":" + port, Handler: mux, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second}
	log.Printf("[permify-batch-checker] Starting on :%s (cache=1M entries, TTL=60s)", port)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	fmt.Println("[permify-batch-checker] Stopped")
}
