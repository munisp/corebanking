// 54Bank Mojaloop High-Performance Adapter — Go
// Bridges 54Bank services to Mojaloop FSPIOP API with connection pooling,
// batch transfers, and circuit breaker for millions TPS throughput.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// --- Configuration ---

type Config struct {
	Port                string
	MojaloopURL         string
	MySQLDSN            string
	MaxConcurrency      int
	BatchSize           int
	CircuitBreakerThreshold int
	CircuitBreakerTimeout   time.Duration
}

func loadConfig() Config {
	return Config{
		Port:                envOr("PORT", "8090"),
		MojaloopURL:         envOr("MOJALOOP_URL", "http://mojaloop-switch:4003"),
		MySQLDSN:            envOr("MYSQL_DSN", "central_ledger:password@tcp(proxysql:6033)/central_ledger"),
		MaxConcurrency:      1000,
		BatchSize:           500,
		CircuitBreakerThreshold: 50,
		CircuitBreakerTimeout:   30 * time.Second,
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// --- Circuit Breaker ---

type CircuitBreaker struct {
	failures    int64
	threshold   int64
	lastFailure int64
	timeout     int64 // milliseconds
	state       int32 // 0=closed, 1=open, 2=half-open
}

func NewCircuitBreaker(threshold int, timeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		threshold: int64(threshold),
		timeout:   timeout.Milliseconds(),
	}
}

func (cb *CircuitBreaker) Allow() bool {
	state := atomic.LoadInt32(&cb.state)
	if state == 0 {
		return true
	}
	if state == 1 {
		last := atomic.LoadInt64(&cb.lastFailure)
		if time.Now().UnixMilli()-last > cb.timeout {
			atomic.CompareAndSwapInt32(&cb.state, 1, 2)
			return true
		}
		return false
	}
	if atomic.CompareAndSwapInt32(&cb.state, 2, 1) {
		return true // half-open: allow single probe request
	}
	return false
}

func (cb *CircuitBreaker) RecordSuccess() {
	atomic.StoreInt64(&cb.failures, 0)
	atomic.StoreInt32(&cb.state, 0)
}

func (cb *CircuitBreaker) RecordFailure() {
	f := atomic.AddInt64(&cb.failures, 1)
	atomic.StoreInt64(&cb.lastFailure, time.Now().UnixMilli())
	if f >= cb.threshold {
		atomic.StoreInt32(&cb.state, 1)
	}
}

// --- Transfer Batch Processor ---

type Transfer struct {
	TransferID    string `json:"transferId"`
	PayerFSP      string `json:"payerFsp"`
	PayeeFSP      string `json:"payeeFsp"`
	AmountKobo    int64  `json:"amountKobo"`
	Currency      string `json:"currency"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type BatchProcessor struct {
	mu       sync.Mutex
	batch    []Transfer
	size     int
	client   *http.Client
	url      string
	cb       *CircuitBreaker
	sent     int64
	failed   int64
}

func NewBatchProcessor(batchSize int, url string, cb *CircuitBreaker) *BatchProcessor {
	return &BatchProcessor{
		batch: make([]Transfer, 0, batchSize),
		size:  batchSize,
		client: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        2000,
				MaxIdleConnsPerHost: 500,
				MaxConnsPerHost:     1000,
				IdleConnTimeout:     90 * time.Second,
				DisableCompression:  true,
				ForceAttemptHTTP2:   true,
			},
		},
		url: url,
		cb:  cb,
	}
}

func (bp *BatchProcessor) Add(t Transfer) {
	bp.mu.Lock()
	bp.batch = append(bp.batch, t)
	if len(bp.batch) >= bp.size {
		batch := make([]Transfer, len(bp.batch))
		copy(batch, bp.batch)
		bp.batch = bp.batch[:0]
		bp.mu.Unlock()
		go bp.flush(batch)
		return
	}
	bp.mu.Unlock()
}

func (bp *BatchProcessor) flush(batch []Transfer) {
	if !bp.cb.Allow() {
		atomic.AddInt64(&bp.failed, int64(len(batch)))
		log.Printf("[CircuitBreaker] OPEN — dropping %d transfers", len(batch))
		return
	}

	// Send each transfer via FSPIOP API (Mojaloop expects individual transfers)
	sem := make(chan struct{}, 100) // Concurrency limiter
	var wg sync.WaitGroup

	for _, t := range batch {
		wg.Add(1)
		sem <- struct{}{}
		go func(tr Transfer) {
			defer wg.Done()
			defer func() { <-sem }()

			body, _ := json.Marshal(map[string]interface{}{
				"transferId": tr.TransferID,
				"payerFsp":   tr.PayerFSP,
				"payeeFsp":   tr.PayeeFSP,
				"amount": map[string]interface{}{
					"amount":   fmt.Sprintf("%.2f", float64(tr.AmountKobo)/100.0),
					"currency": tr.Currency,
				},
				"ilpPacket":    "placeholder",
				"condition":    "placeholder",
				"expiration":   time.Now().Add(30 * time.Second).UTC().Format(time.RFC3339),
			})

			req, _ := http.NewRequest("POST", bp.url+"/transfers", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/vnd.interoperability.transfers+json;version=1.1")
			req.Header.Set("FSPIOP-Source", tr.PayerFSP)
			req.Header.Set("FSPIOP-Destination", tr.PayeeFSP)
			req.Header.Set("Date", time.Now().UTC().Format(http.TimeFormat))

			resp, err := bp.client.Do(req)
			if err != nil {
				bp.cb.RecordFailure()
				atomic.AddInt64(&bp.failed, 1)
				return
			}
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()

			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				bp.cb.RecordSuccess()
				atomic.AddInt64(&bp.sent, 1)
			} else {
				bp.cb.RecordFailure()
				atomic.AddInt64(&bp.failed, 1)
			}
		}(t)
	}
	wg.Wait()
}

func (bp *BatchProcessor) FlushRemaining() {
	bp.mu.Lock()
	if len(bp.batch) > 0 {
		batch := make([]Transfer, len(bp.batch))
		copy(batch, bp.batch)
		bp.batch = bp.batch[:0]
		bp.mu.Unlock()
		bp.flush(batch)
		return
	}
	bp.mu.Unlock()
}

// --- Metrics ---

type Metrics struct {
	transfersReceived int64
	transfersSent     int64
	transfersFailed   int64
	latencySum        int64
	latencyCount      int64
}

var metrics Metrics

// --- HTTP Handlers ---

func handleTransfer(bp *BatchProcessor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var t Transfer
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}

		atomic.AddInt64(&metrics.transfersReceived, 1)
		start := time.Now()
		bp.Add(t)
		watchdogPing()
		elapsed := time.Since(start).Microseconds()
		atomic.AddInt64(&metrics.latencySum, elapsed)
		atomic.AddInt64(&metrics.latencyCount, 1)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]string{
			"status":     "accepted",
			"transferId": t.TransferID,
		})
	}
}

func handleBulkTransfer(bp *BatchProcessor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var transfers []Transfer
		if err := json.NewDecoder(r.Body).Decode(&transfers); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}

		atomic.AddInt64(&metrics.transfersReceived, int64(len(transfers)))
		for _, t := range transfers {
			bp.Add(t)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "accepted",
			"count":  len(transfers),
		})
	}
}

func handleHealth(bp *BatchProcessor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sent := atomic.LoadInt64(&bp.sent)
		failed := atomic.LoadInt64(&bp.failed)
		received := atomic.LoadInt64(&metrics.transfersReceived)
		avgLatency := int64(0)
		if c := atomic.LoadInt64(&metrics.latencyCount); c > 0 {
			avgLatency = atomic.LoadInt64(&metrics.latencySum) / c
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":           "ok",
			"service":          "mojaloop-adapter",
			"received":         received,
			"sent":             sent,
			"failed":           failed,
			"avgLatencyMicros": avgLatency,
			"circuitBreaker":   atomic.LoadInt32(&bp.cb.state),
		})
	}
}

// --- Watchdog ---

var watchdogLast int64

func watchdogPing() {
	atomic.StoreInt64(&watchdogLast, time.Now().UnixMilli())
}

func startWatchdog() {
	watchdogPing()
	go func() {
		for {
			time.Sleep(10 * time.Second)
			last := atomic.LoadInt64(&watchdogLast)
			if time.Now().UnixMilli()-last > 60000 {
				log.Println("[WATCHDOG] Event loop stalled")
			}
		}
	}()
}

// --- Main ---

func main() {
	cfg := loadConfig()
	startWatchdog()

	cb := NewCircuitBreaker(cfg.CircuitBreakerThreshold, cfg.CircuitBreakerTimeout)
	bp := NewBatchProcessor(cfg.BatchSize, cfg.MojaloopURL, cb)

	// Periodic flush for partial batches
	go func() {
		ticker := time.NewTicker(100 * time.Millisecond)
		defer ticker.Stop()
		for range ticker.C {
			bp.FlushRemaining()
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealth(bp))
	mux.HandleFunc("/v1/mojaloop/transfer", handleTransfer(bp))
	mux.HandleFunc("/v1/mojaloop/bulk-transfer", handleBulkTransfer(bp))

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("[mojaloop-adapter] Starting on :%s (batch=%d, concurrency=%d)", cfg.Port, cfg.BatchSize, cfg.MaxConcurrency)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[mojaloop-adapter] Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	bp.FlushRemaining()
	log.Println("[mojaloop-adapter] Stopped")
}
