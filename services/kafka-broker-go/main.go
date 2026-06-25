package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

var db *sql.DB

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("[kafka-broker-go] starting on :8225")

	// PostgreSQL connection
	dsn := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/kafka_broker_go?sslmode=disable")
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}

	initSchema()
	log.Printf("[kafka-broker-go] database connected, schema initialized")

	// Middleware clients
	keycloakURL := getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	redisURL := getEnv("REDIS_URL", "localhost:6379")
	osURL := getEnv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
	permifyURL := getEnv("PERMIFY_ENDPOINT", "http://permify:3476")

	log.Printf("[kafka-broker-go] middleware: keycloak=%s kafka=%s redis=%s opensearch=%s permify=%s",
		keycloakURL, kafkaBrokers, redisURL, osURL, permifyURL)

	mux := http.NewServeMux()

	// Health endpoints
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
	})
	mux.HandleFunc("/metrics", metricsHandler)

	// Domain endpoints
	mux.HandleFunc("/api/v1/service_configs", domainHandler)
	mux.HandleFunc("/api/v1/service_configs/", domainDetailHandler)

	server := &http.Server{
		Addr:         ":" + getEnv("PORT", "8225"),
		Handler:      loggingMiddleware(corsMiddleware(mux)),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	log.Printf("[kafka-broker-go] ready on :%s", getEnv("PORT", "8225"))

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Printf("[kafka-broker-go] shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	log.Printf("[kafka-broker-go] stopped")
}

func initSchema() {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(128) NOT NULL,
    config_value JSONB NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    version INT NOT NULL DEFAULT 1,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID,
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(config_key, environment, tenant_id)
	)`)
	if err != nil {
		log.Fatalf("schema init failed: %v", err)
	}

	// Outbox for event sourcing
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS outbox (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		event_type VARCHAR(64) NOT NULL,
		aggregate_id VARCHAR(128) NOT NULL,
		payload JSONB NOT NULL,
		published BOOLEAN DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		log.Printf("outbox table creation (may already exist): %v", err)
	}

	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_service_configs_tenant ON service_configs(tenant_id)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_service_configs_status ON service_configs(status)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_service_configs_created ON service_configs(created_at DESC)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published, created_at) WHERE NOT published`)
}

func domainHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		listRecords(w, r)
	case "POST":
		createRecord(w, r)
	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func domainDetailHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/service_configs/"), "/")
	id := parts[0]
	if id == "" {
		http.Error(w, `{"error":"id required"}`, http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "GET":
		getRecord(w, r, id)
	case "PUT", "PATCH":
		updateRecord(w, r, id)
	case "DELETE":
		deleteRecord(w, r, id)
	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func listRecords(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	limit := 50
	offset := 0

	query := `SELECT id, status, created_at FROM service_configs WHERE ($1 = '' OR tenant_id::text = $1) ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := db.QueryContext(r.Context(), query, tenantID, limit, offset)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var id, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &status, &createdAt); err != nil {
			continue
		}
		records = append(records, map[string]interface{}{"id": id, "status": status, "created_at": createdAt})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": records, "count": len(records)})
}

func createRecord(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	body["tenant_id"] = tenantID

	payload, _ := json.Marshal(body)

	var id string
	err := db.QueryRowContext(r.Context(),
		`INSERT INTO service_configs (tenant_id, status) VALUES ($1, 'active') RETURNING id`,
		tenantID).Scan(&id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	// Write to outbox for event publishing
	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"service_configs.created", id, string(payload))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": "created"})
}

func getRecord(w http.ResponseWriter, r *http.Request, id string) {
	var status string
	var createdAt time.Time
	err := db.QueryRowContext(r.Context(),
		`SELECT status, created_at FROM service_configs WHERE id = $1`, id).Scan(&status, &createdAt)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": status, "created_at": createdAt})
}

func updateRecord(w http.ResponseWriter, r *http.Request, id string) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	status, _ := body["status"].(string)
	if status == "" {
		status = "updated"
	}

	_, err := db.ExecContext(r.Context(),
		`UPDATE service_configs SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	payload, _ := json.Marshal(body)
	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"service_configs.updated", id, string(payload))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": status})
}

func deleteRecord(w http.ResponseWriter, r *http.Request, id string) {
	_, err := db.ExecContext(r.Context(),
		`UPDATE service_configs SET status = 'deleted', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"service_configs.deleted", id, `{"id":"`+id+`"}`)

	w.WriteHeader(http.StatusNoContent)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": "kafka-broker-go",
		"version": "1.0.0",
	})
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	if err := db.Ping(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM service_configs`).Scan(&count)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service":       "kafka-broker-go",
		"total_records": count,
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if r.URL.Path != "/healthz" && r.URL.Path != "/livez" {
			log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
		}
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-User-ID, X-Request-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
