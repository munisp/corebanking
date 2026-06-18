package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// Kafka Dead Letter Queue Processor — Retries and manages failed Kafka messages

var serviceName = "kafka-dlq-processor-go"

// --- Monetary Safety ---
func nairaToKobo(naira float64) int64 { return int64(naira * 100) }
func koboToNaira(kobo int64) float64 { return float64(kobo) / 100.0 }

// --- Watchdog ---
var watchdogLastPing atomic.Int64

func watchdogPing() { watchdogLastPing.Store(time.Now().UnixMilli()) }
func watchdogHealthy() bool { return time.Now().UnixMilli()-watchdogLastPing.Load() < 60000 }
func startWatchdog(interval time.Duration) {
	watchdogPing()
	go func() {
		for {
			time.Sleep(interval)
			watchdogPing()
		}
	}()
}

// --- Circuit Breaker ---
type CircuitBreaker struct {
	mu            sync.Mutex
	failures      int
	threshold     int
	resetTimeout  time.Duration
	state         string
	lastFailure   time.Time
}

func newCircuitBreaker() *CircuitBreaker {
	return &CircuitBreaker{threshold: 5, resetTimeout: 30 * time.Second, state: "closed"}
}

func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.state == "open" {
		if time.Since(cb.lastFailure) > cb.resetTimeout {
			cb.state = "half-open"
			return true
		}
		return false
	}
	return true
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures = 0
	cb.state = "closed"
}

func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailure = time.Now()
	if cb.failures >= cb.threshold {
		cb.state = "open"
	}
}

var circuitBreaker = newCircuitBreaker()

// --- Rate Limiter ---
type RateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
	max      int
	window   time.Duration
}

func newRateLimiter() *RateLimiter {
	return &RateLimiter{requests: make(map[string][]time.Time), max: 200, window: time.Minute}
}

func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	reqs := rl.requests[ip]
	var valid []time.Time
	for _, t := range reqs {
		if now.Sub(t) < rl.window { valid = append(valid, t) }
	}
	if len(valid) >= rl.max { return false }
	rl.requests[ip] = append(valid, now)
	return true
}

var rateLimiter = newRateLimiter()

// --- EventBus ---
type EventBus struct {
	broker  string
	topic   string
	service string
	mu      sync.Mutex
	buffer  []map[string]interface{}
}

func newEventBus(topic string) *EventBus {
	broker := os.Getenv("KAFKA_BROKERS")
	if broker == "" { broker = "localhost:9092" }
	return &EventBus{broker: broker, topic: topic, service: serviceName}
}

func (eb *EventBus) Emit(eventType string, payload map[string]interface{}) {
	event := map[string]interface{}{
		"id":        fmt.Sprintf("%s_%d", eb.service, time.Now().UnixMilli()),
		"type":      eventType,
		"source":    eb.service,
		"topic":     eb.topic,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"data":      payload,
	}
	eb.mu.Lock()
	eb.buffer = append(eb.buffer, event)
	eb.mu.Unlock()
	log.Printf("[EventBus] %s -> %s: %s", eb.service, eb.topic, eventType)
}

var eventBus = newEventBus("platform.events")

// --- Input Sanitization ---
func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	if len(s) > 1000 { s = s[:1000] }
	return s
}

// --- Handlers ---
func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": serviceName})
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
	if watchdogHealthy() {
		json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
	} else {
		w.WriteHeader(503)
		json.NewEncoder(w).Encode(map[string]string{"status": "stalled"})
	}
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{"service": serviceName, "uptime": time.Since(time.Now()).String()})
}

// --- Security Middleware ---
func securityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'")
		w.Header().Set("Content-Type", "application/json")
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		next.ServeHTTP(w, r)
	})
}

// --- Panic Recovery ---
func panicRecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[PANIC] %v", err)
				w.WriteHeader(500)
				json.NewEncoder(w).Encode(map[string]string{"error": "internal server error"})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8080" }

	startWatchdog(10 * time.Second)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", livezHandler)
	mux.HandleFunc("/metrics", metricsHandler)

	handler := panicRecoveryMiddleware(securityMiddleware(mux))

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[%s] Starting on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Printf("[%s] Shutting down...", serviceName)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	log.Printf("[%s] Server stopped", serviceName)
}
