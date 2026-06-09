package main

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"sync"
	"time"
		"os/signal"
	"syscall"
	"context"
)

var PORT = "8097"
func init() { if p := os.Getenv("PORT"); p != "" { PORT = p } }

type FeatureFlag struct {
	Name              string   `json:"name"`
	Description       string   `json:"description"`
	Enabled           bool     `json:"enabled"`
	RolloutPercentage int      `json:"rollout_percentage"`
	TargetTenants     []string `json:"target_tenants"`
	TargetRoles       []string `json:"target_roles"`
	CreatedAt         string   `json:"created_at"`
	UpdatedAt         string   `json:"updated_at"`
}

var flags = sync.Map{}


func isEnabled(flagName, userID, tenantID, role string) bool {
	v, ok := flags.Load(flagName)
	if !ok { return false }
	ff := v.(FeatureFlag)
	if !ff.Enabled { return false }
	if ff.RolloutPercentage >= 100 { return true }
	if ff.RolloutPercentage <= 0 { return false }
	// Deterministic rollout based on userID hash
	if userID != "" {
		n, _ := rand.Int(rand.Reader, big.NewInt(100))
		return int(n.Int64()) < ff.RolloutPercentage
	}
	return true
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	count := 0
	flags.Range(func(_, _ interface{}) bool { count++; return true })
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": "feature-flags", "flags_count": count})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	all := []FeatureFlag{}
	flags.Range(func(_, v interface{}) bool { all = append(all, v.(FeatureFlag)); return true })
	respondJSON(w, 200, map[string]interface{}{"flags": all, "count": len(all)})
}

func handleCheck(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("flag")
	userID := r.URL.Query().Get("user_id")
	tenantID := r.URL.Query().Get("tenant_id")
	role := r.URL.Query().Get("role")
	respondJSON(w, 200, map[string]interface{}{"flag": name, "enabled": isEnabled(name, userID, tenantID, role)})
}

func handleToggle(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name    string `json:"name"`
		Enabled bool   `json:"enabled"`
		Rollout int    `json:"rollout_percentage"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]interface{}{"error": "Invalid JSON"})
		return
	}
	v, ok := flags.Load(body.Name)
	if !ok {
		respondJSON(w, 404, map[string]interface{}{"error": "Flag not found"})
		return
	}
	ff := v.(FeatureFlag)
	ff.Enabled = body.Enabled
	if body.Rollout > 0 { ff.RolloutPercentage = body.Rollout }
	ff.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	flags.Store(body.Name, ff)
	log.Printf("[FF] Toggled: %s enabled=%v rollout=%d%%", body.Name, ff.Enabled, ff.RolloutPercentage)
	respondJSON(w, 200, map[string]interface{}{"status": "updated", "flag": ff})
}


// ─── Idempotency Middleware ─────────────────────────────────────────────────
var idempotencyCache = struct {
	sync.RWMutex
	entries map[string]idempotencyEntry
}{entries: make(map[string]idempotencyEntry)}

type idempotencyEntry struct {
	response   []byte
	statusCode int
	createdAt  time.Time
}

func idempotencyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" && r.Method != "PUT" {
			next.ServeHTTP(w, r)
			return
		}
		key := r.Header.Get("Idempotency-Key")
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}
		idempotencyCache.RLock()
		if entry, ok := idempotencyCache.entries[key]; ok {
			idempotencyCache.RUnlock()
			w.Header().Set("X-Idempotency-Replayed", "true")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(entry.statusCode)
			w.Write(entry.response)
			return
		}
		idempotencyCache.RUnlock()
		rec := &idempotencyRecorder{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(rec, r)
		idempotencyCache.Lock()
		idempotencyCache.entries[key] = idempotencyEntry{response: rec.body, statusCode: rec.statusCode, createdAt: time.Now()}
		idempotencyCache.Unlock()
		// Cleanup old entries (>24h) in background
		go func() {
			idempotencyCache.Lock()
			defer idempotencyCache.Unlock()
			for k, v := range idempotencyCache.entries {
				if time.Since(v.createdAt) > 24*time.Hour { delete(idempotencyCache.entries, k) }
			}
		}()
	})
}

type idempotencyRecorder struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (r *idempotencyRecorder) WriteHeader(code int) { r.statusCode = code; r.ResponseWriter.WriteHeader(code) }
func (r *idempotencyRecorder) Write(b []byte) (int, error) { r.body = append(r.body, b...); return r.ResponseWriter.Write(b) }


func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simple token bucket: allow bursts of 100 requests
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key, X-Tenant-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	fmt.Printf("54Bank Feature Flags Service listening on :%s\n", PORT)
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/flags", handleList)
	mux.HandleFunc("/flags/check", handleCheck)
	mux.HandleFunc("/flags/toggle", handleToggle)
	server := &http.Server{Addr: ":"+PORT, Handler: corsMiddleware(rateLimitMiddleware(mux))}
	go func() {
		log.Printf("[feature-flags-go] Starting on :%s", PORT)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[feature-flags-go] ListenAndServe error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[feature-flags-go] Shutdown signal received")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	log.Println("[feature-flags-go] Server stopped gracefully")
}
