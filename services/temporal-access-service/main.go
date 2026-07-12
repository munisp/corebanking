package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"temporal-access-service/handlers"
	"temporal-access-service/middleware"
	"temporal-access-service/permify"
	"temporal-access-service/storage"
)

func main() {
	// Load configuration
	config := loadConfig()

	// Initialize Redis
	log.Println("Connecting to Redis...")
	redisStore, err := storage.NewRedisStore(config.RedisAddr, config.RedisPassword)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisStore.Close()
	log.Println("Connected to Redis")

	// Initialize Permify client
	log.Println("Initializing Permify client...")
	permifyClient := permify.NewClient(config.PermifyURL)
	log.Println("Permify client initialized")

	// Initialize handler
	handler := handlers.NewHandler(redisStore, permifyClient)

	// Setup router
	router := setupRouter(handler)

	// Create HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", config.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start background cleanup job
	go startCleanupJob(redisStore)

	// Start server
	go func() {
		log.Printf("Starting server on port %s...", config.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped")
}

// Config holds application configuration
type Config struct {
	Port          string
	RedisAddr     string
	RedisPassword string
	PermifyURL    string
	DaprHTTPPort  string
}

func loadConfig() Config {
	return Config{
		Port:          getEnv("PORT", "8080"),
		RedisAddr:     getEnv("REDIS_ADDR", "redis-master.redis.svc.cluster.local:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		PermifyURL:    getEnv("PERMIFY_URL", "http://permify.permify.svc.cluster.local:3476"),
		DaprHTTPPort:  getEnv("DAPR_HTTP_PORT", "3500"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func setupRouter(h *handlers.Handler) *mux.Router {
	r := mux.NewRouter()

	// Apply middleware
	r.Use(middleware.Recovery)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logging)
	r.Use(middleware.Metrics)
	r.Use(middleware.CORS)

	// Health check (no auth)
	r.HandleFunc("/health", healthCheck).Methods("GET")
	r.Handle("/metrics", promhttp.Handler()).Methods("GET")

	// API routes (with auth)
	api := r.PathPrefix("/api/v1").Subrouter()
	api.Use(middleware.Authentication)

	// Temporal grants
	api.HandleFunc("/grants", h.CreateGrant).Methods("POST")
	api.HandleFunc("/grants", h.ListGrants).Methods("GET")
	api.HandleFunc("/grants/{grant_id}", h.GetGrant).Methods("GET")
	api.HandleFunc("/grants/{grant_id}", h.UpdateGrant).Methods("PUT")
	api.HandleFunc("/grants/{grant_id}", h.RevokeGrant).Methods("DELETE")
	api.HandleFunc("/grants/{grant_id}/extend", h.ExtendGrant).Methods("POST")
	// List all active grants for a specific user/subject
	api.HandleFunc("/users/{subject_id}/grants", h.ListUserGrants).Methods("GET")

	// Access checks
	api.HandleFunc("/check", h.CheckAccess).Methods("POST")

	// Policies
	api.HandleFunc("/policies", h.CreatePolicy).Methods("POST")
	api.HandleFunc("/policies", h.ListPolicies).Methods("GET")
	api.HandleFunc("/policies/{policy_id}", h.GetPolicy).Methods("GET")
	api.HandleFunc("/policies/{policy_id}", h.UpdatePolicy).Methods("PUT")
	api.HandleFunc("/policies/{policy_id}", h.DeletePolicy).Methods("DELETE")

	// Delegations
	api.HandleFunc("/delegations", h.CreateDelegation).Methods("POST")
	api.HandleFunc("/delegations", h.ListDelegations).Methods("GET")
	api.HandleFunc("/delegations/{delegation_id}", h.RevokeDelegation).Methods("DELETE")

	// Audit logs
	api.HandleFunc("/audit-logs", h.ListAuditLogs).Methods("GET")

	return r
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"healthy"}`))
}

func startCleanupJob(store *storage.RedisStore) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		// Cleanup logic runs automatically via Redis TTL
		log.Println("Cleanup job tick (Redis TTL handles expiration)")
	}
}
