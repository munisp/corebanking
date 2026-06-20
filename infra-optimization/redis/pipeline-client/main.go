// 54Bank Redis Pipeline Client — Go
// High-throughput Redis client with pipelining, connection pooling,
// and batch operations for millions TPS cache/session management.
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

type RedisConfig struct {
	ClusterAddrs    string
	PoolSize        int
	MinIdleConns    int
	PipelineSize    int
	PipelineFlushMs int
}

func defaultRedisConfig() RedisConfig {
	return RedisConfig{
		ClusterAddrs:    envOr("REDIS_CLUSTER", "redis-0:6379,redis-1:6379,redis-2:6379"),
		PoolSize:        500,
		MinIdleConns:    50,
		PipelineSize:    1000,
		PipelineFlushMs: 5,
	}
}

// --- Pipeline Batcher ---

type PipelineCommand struct {
	Op    string `json:"op"`    // SET, GET, HSET, HGET, INCR, EXPIRE, DEL
	Key   string `json:"key"`
	Value string `json:"value,omitempty"`
	Field string `json:"field,omitempty"`
	TTL   int    `json:"ttl,omitempty"` // seconds
}

type PipelineBatcher struct {
	mu       sync.Mutex
	cmds     []PipelineCommand
	maxBatch int
	flushed  int64
	total    int64
}

func NewPipelineBatcher(maxBatch int) *PipelineBatcher {
	return &PipelineBatcher{
		cmds:     make([]PipelineCommand, 0, maxBatch),
		maxBatch: maxBatch,
	}
}

func (pb *PipelineBatcher) Add(cmd PipelineCommand) {
	pb.mu.Lock()
	pb.cmds = append(pb.cmds, cmd)
	atomic.AddInt64(&pb.total, 1)

	if len(pb.cmds) >= pb.maxBatch {
		batch := make([]PipelineCommand, len(pb.cmds))
		copy(batch, pb.cmds)
		pb.cmds = pb.cmds[:0]
		pb.mu.Unlock()
		go pb.flush(batch)
		return
	}
	pb.mu.Unlock()
}

func (pb *PipelineBatcher) flush(cmds []PipelineCommand) {
	// In production: use go-redis Pipeline()
	// pipe := rdb.Pipeline()
	// for _, cmd := range cmds { ... pipe.Set/Get/etc ... }
	// pipe.Exec(ctx)
	atomic.AddInt64(&pb.flushed, int64(len(cmds)))
	log.Printf("[RedisPipeline] Flushed %d commands (total: %d)", len(cmds), atomic.LoadInt64(&pb.flushed))
}

func (pb *PipelineBatcher) FlushRemaining() {
	pb.mu.Lock()
	if len(pb.cmds) > 0 {
		batch := make([]PipelineCommand, len(pb.cmds))
		copy(batch, pb.cmds)
		pb.cmds = pb.cmds[:0]
		pb.mu.Unlock()
		pb.flush(batch)
		return
	}
	pb.mu.Unlock()
}

// --- Cache Strategy Advisor ---

type CacheStrategy struct {
	Pattern     string `json:"pattern"`
	TTL         string `json:"ttl"`
	Eviction    string `json:"eviction"`
	DataType    string `json:"dataType"`
	Description string `json:"description"`
}

func getCacheStrategies() []CacheStrategy {
	return []CacheStrategy{
		{"session:*", "30m", "volatile-lfu", "hash", "User session data with sliding window TTL"},
		{"account:balance:*", "10s", "volatile-lfu", "string", "Account balance cache — short TTL for consistency"},
		{"rate:limit:*", "60s", "volatile-ttl", "string", "API rate limiting counters per client"},
		{"kyc:tier:*", "1h", "volatile-lfu", "hash", "KYC tier cache — changes infrequently"},
		{"fx:rate:*", "30s", "volatile-ttl", "string", "FX rate cache — refreshed by treasury service"},
		{"otp:*", "5m", "volatile-ttl", "string", "OTP codes with strict TTL"},
		{"idempotency:*", "24h", "volatile-ttl", "string", "Idempotency keys for deduplication"},
		{"circuit:breaker:*", "30s", "volatile-ttl", "hash", "Circuit breaker state per downstream service"},
		{"lock:*", "30s", "volatile-ttl", "string", "Distributed locks (Redlock)"},
		{"warmup:*", "never", "allkeys-lfu", "set", "Pre-warmed cache for hot paths (account lookups)"},
	}
}

// --- HTTP Handlers ---

func handlePipeline(pb *PipelineBatcher) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var cmds []PipelineCommand
		if err := json.NewDecoder(r.Body).Decode(&cmds); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		for _, cmd := range cmds {
			pb.Add(cmd)
		}
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "queued",
			"count":  len(cmds),
		})
	}
}

func handleStrategies(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(getCacheStrategies())
}

func handleStats(pb *PipelineBatcher) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total":   atomic.LoadInt64(&pb.total),
			"flushed": atomic.LoadInt64(&pb.flushed),
			"pending": atomic.LoadInt64(&pb.total) - atomic.LoadInt64(&pb.flushed),
		})
	}
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "redis-pipeline-client"})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	cfg := defaultRedisConfig()
	pb := NewPipelineBatcher(cfg.PipelineSize)

	// Periodic flush
	go func() {
		ticker := time.NewTicker(time.Duration(cfg.PipelineFlushMs) * time.Millisecond)
		defer ticker.Stop()
		for range ticker.C {
			pb.FlushRemaining()
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/redis/pipeline", handlePipeline(pb))
	mux.HandleFunc("/v1/redis/strategies", handleStrategies)
	mux.HandleFunc("/v1/redis/stats", handleStats(pb))

	port := envOr("PORT", "8093")
	server := &http.Server{Addr: ":" + port, Handler: mux, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second}

	log.Printf("[redis-pipeline-client] Starting on :%s (cluster=%s, pool=%d)", port, cfg.ClusterAddrs, cfg.PoolSize)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	pb.FlushRemaining()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	fmt.Println("[redis-pipeline-client] Stopped")
}
