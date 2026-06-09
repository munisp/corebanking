package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"crypto/sha256"

	_ "github.com/lib/pq"
)

var (
	serviceName  = "interest-accrual-engine-go"
	db           *sql.DB
	requestCount uint64
	errorCount   uint64
)

func respondJSON(w http.ResponseWriter, args ...interface{}) {
	w.Header().Set("Content-Type", "application/json")
	status := 200
	var data interface{}
	if len(args) == 2 {
		if s, ok := args[0].(int); ok { status = s }
		data = args[1]
	} else if len(args) == 1 {
		data = args[0]
	}
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	dbStatus := "not_configured"
	if db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			dbStatus = fmt.Sprintf("unhealthy: %v", err)
		} else { dbStatus = "connected" }
	}
	overall := "healthy"
	if strings.Contains(dbStatus, "unhealthy") { overall = "degraded" }
	respondJSON(w, map[string]interface{}{"status": overall, "service": serviceName, "version": "2.0.0", "checks": map[string]string{"database": dbStatus}})
}

func readyzHandler(w http.ResponseWriter, _ *http.Request) { respondJSON(w, map[string]interface{}{"ready": true}) }
func livezHandler(w http.ResponseWriter, _ *http.Request)  { respondJSON(w, map[string]interface{}{"alive": true}) }

func metricsHandler(w http.ResponseWriter, _ *http.Request) {
	r := atomic.LoadUint64(&requestCount); e := atomic.LoadUint64(&errorCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "requests_total{service=\"%s\"} %d\nerrors_total{service=\"%s\"} %d\n", serviceName, r, serviceName, e)
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&requestCount, 1); next.ServeHTTP(w, r)
	})
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" || r.URL.Path == "/readyz" || r.URL.Path == "/livez" || r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r); return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			respondJSON(w, 401, map[string]interface{}{"error": "unauthorized"}); return
		}
		r.Header.Set("X-User-Id", "validated"); next.ServeHTTP(w, r)
	})
}

var idempCache sync.Map

func auditHash(prev, data string) string {
	h := sha256.New(); h.Write([]byte(prev)); h.Write([]byte(data))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" { return }
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil { log.Printf("DB error: %v", err); return }
	db.SetMaxOpenConns(25); db.SetMaxIdleConns(5)
}

func accrueHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	respondJSON(w, map[string]interface{}{"status": "accrued", "method": "actual/365"})
}
func registerRoutes(mux *http.ServeMux) { mux.HandleFunc("/accrue", accrueHandler) }

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8094" }
	initDB()
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", livezHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	registerRoutes(mux)
	handler := rateLimitMiddleware(authMiddleware(mux))
	log.Printf("%s v2.0 on :%s", serviceName, port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

var _ = context.Background
var _ = time.Now
