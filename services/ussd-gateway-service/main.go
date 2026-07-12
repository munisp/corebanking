// ussd-gateway-service — USSD session gateway and Africa's Talking integration for 54Bank
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
)

var startTime = time.Now()

const (
	sessionTTL  = 120 * time.Second
	maxBodySize = 1 << 20 // 1MB
)

func getEnv(k, v string) string {
	if val := os.Getenv(k); val != "" {
		return val
	}

	return v
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")

	w.WriteHeader(code)

	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("failed to encode response: %v", err)
	}
}

type USSDSession struct {
	ID           string    `json:"id"`
	SessionID    string    `json:"sessionId"`
	MSISDN       string    `json:"msisdn"`
	ServiceCode  string    `json:"serviceCode"`
	Text         string    `json:"text"`
	State        string    `json:"state"`
	MenuLevel    int       `json:"menuLevel"`
	StartedAt    time.Time `json:"startedAt"`
	LastActivity time.Time `json:"lastActivity"`
}

type USSDSummary struct {
	SessionsToday   int      `json:"sessionsToday"`
	CompletedToday  int      `json:"completedToday"`
	DroppedToday    int      `json:"droppedToday"`
	AvgSessionSteps float64  `json:"avgSessionSteps"`
	PopularMenus    []string `json:"popularMenus"`
}

var (
	mu      sync.RWMutex
	counter = 1

	sessions = map[string]*USSDSession{
		"session-001": {
			ID:           "USSD-001",
			SessionID:    "session-001",
			MSISDN:       "+2348012345678",
			ServiceCode:  "*737#",
			Text:         "1*1",
			State:        "active",
			MenuLevel:    2,
			StartedAt:    time.Now().UTC(),
			LastActivity: time.Now().UTC(),
		},
	}
)

func main() {
	port := getEnv("PORT", "9172")

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/health", healthz)

	mux.HandleFunc("/v1/ussd/callback", ussdCallback)
	mux.HandleFunc("/v1/ussd/sessions", getSessions)
	mux.HandleFunc("/v1/ussd/stats", getStats)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           loggingMiddleware(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	go cleanupExpiredSessions()

	go func() {
		log.Printf(
			"[ussd-gateway-service] USSD gateway running on :%s",
			port,
		)

		if err := server.ListenAndServe(); err != nil &&
			!errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server failed: %v", err)
		}
	}()

	waitForShutdown(server)
}

func healthz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"service":        "ussd-gateway-service",
		"status":         "healthy",
		"provider":       "Africa's Talking USSD",
		"uptime_secs":    int(time.Since(startTime).Seconds()),
		"activeSessions": activeSessionCount(),
		"serviceCodes": []string{
			"*737#",
			"*737*1#",
		},
		"middleware": map[string]string{
			"redis": "session_store (TTL 120s)",
			"kafka": "ussd.sessions",
		},
	})
}

func ussdCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	if err := r.ParseForm(); err != nil {
		http.Error(
			w,
			"invalid form payload",
			http.StatusBadRequest,
		)

		return
	}

	sessionID := strings.TrimSpace(r.FormValue("sessionId"))
	msisdn := strings.TrimSpace(r.FormValue("phoneNumber"))
	serviceCode := strings.TrimSpace(r.FormValue("serviceCode"))
	text := strings.TrimSpace(r.FormValue("text"))

	if sessionID == "" ||
		msisdn == "" ||
		serviceCode == "" {

		http.Error(
			w,
			"missing required fields",
			http.StatusBadRequest,
		)

		return
	}

	now := time.Now().UTC()

	mu.Lock()

	existing, exists := sessions[sessionID]

	if exists {
		existing.Text = text
		existing.LastActivity = now
		existing.MenuLevel = calculateMenuLevel(text)
	} else {
		counter++

		sessions[sessionID] = &USSDSession{
			ID:           fmt.Sprintf("USSD-%03d", counter),
			SessionID:    sessionID,
			MSISDN:       msisdn,
			ServiceCode:  serviceCode,
			Text:         text,
			State:        "active",
			MenuLevel:    calculateMenuLevel(text),
			StartedAt:    now,
			LastActivity: now,
		}
	}

	mu.Unlock()

	response := buildUSSDResponse(text)

	w.Header().Set("Content-Type", "text/plain")

	if _, err := w.Write([]byte(response)); err != nil {
		log.Printf("failed to write response: %v", err)
	}
}

func getSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	mu.RLock()

	sessionList := make([]USSDSession, 0, len(sessions))

	for _, session := range sessions {
		sessionList = append(sessionList, *session)
	}

	mu.RUnlock()

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"sessions": sessionList,
		"total":    len(sessionList),
	})
}

func getStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	stats := USSDSummary{
		SessionsToday:   28400,
		CompletedToday:  27900,
		DroppedToday:    500,
		AvgSessionSteps: 3.2,
		PopularMenus: []string{
			"balance",
			"transfer",
			"airtime",
		},
	}

	respondJSON(w, http.StatusOK, stats)
}

func calculateMenuLevel(text string) int {
	if text == "" {
		return 0
	}

	return len(strings.Split(text, "*"))
}

func buildUSSDResponse(text string) string {
	switch text {

	case "":
		return `CON Welcome to 54Bank
1. Check Balance
2. Transfer Funds
3. Buy Airtime
4. Pay Bills
0. Exit`

	case "1":
		return `END Your account balance is ₦1,250,000.00`

	case "2":
		return `CON Enter recipient account number`

	case "3":
		return `CON Enter phone number for airtime purchase`

	case "4":
		return `CON Select bill type
1. Electricity
2. Cable TV
3. Internet`

	case "0":
		return `END Thank you for using 54Bank`

	default:
		return `END Invalid option selected`
	}
}

func cleanupExpiredSessions() {
	ticker := time.NewTicker(30 * time.Second)

	defer ticker.Stop()

	for range ticker.C {
		now := time.Now().UTC()

		mu.Lock()

		for key, session := range sessions {
			if now.Sub(session.LastActivity) > sessionTTL {
				delete(sessions, key)
			}
		}

		mu.Unlock()
	}
}

func activeSessionCount() int {
	mu.RLock()
	defer mu.RUnlock()

	return len(sessions)
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		next.ServeHTTP(w, r)

		log.Printf(
			"%s %s %s",
			r.Method,
			r.URL.Path,
			time.Since(start),
		)
	})
}

func waitForShutdown(server *http.Server) {
	stop := make(chan os.Signal, 1)

	signal.Notify(
		stop,
		syscall.SIGINT,
		syscall.SIGTERM,
	)

	<-stop

	log.Println("shutting down ussd-gateway-service...")

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)

	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}

	log.Println("ussd-gateway-service stopped")
}
