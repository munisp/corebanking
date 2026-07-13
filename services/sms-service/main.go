// sms-service — SMS banking command gateway for 54Bank
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var startTime = time.Now()

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

type IncomingSMS struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Message string `json:"message"`
}

type OutgoingSMS struct {
	To      string `json:"to"`
	Message string `json:"message"`
}

type SMSResp struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func processSMS(_ context.Context, sms IncomingSMS) SMSResp {
	message := strings.ToUpper(strings.TrimSpace(sms.Message))

	parts := strings.Fields(message)

	if len(parts) == 0 {
		return SMSResp{
			Success: false,
			Message: "Invalid command. Send HELP.",
		}
	}

	switch parts[0] {

	case "BAL", "BALANCE":
		if len(parts) < 2 {
			return SMSResp{
				Success: false,
				Message: "Format: BAL <PIN>",
			}
		}

		return SMSResp{
			Success: true,
			Message: fmt.Sprintf(
				"Balance: NGN 50,000.00 as at %s",
				time.Now().Format("02-Jan-2006 15:04"),
			),
		}

	case "TRF", "TRANSFER":
		if len(parts) < 4 {
			return SMSResp{
				Success: false,
				Message: "Format: TRF <ACCOUNT> <AMOUNT> <PIN>",
			}
		}

		accountRegex := regexp.MustCompile(`^\d{10}$`)

		if !accountRegex.MatchString(parts[1]) {
			return SMSResp{
				Success: false,
				Message: "Invalid account. Must be 10 digits.",
			}
		}

		return SMSResp{
			Success: true,
			Message: fmt.Sprintf(
				"Transfer of NGN %s to %s initiated.",
				parts[2],
				parts[1],
			),
		}

	case "AIR", "AIRTIME":
		if len(parts) < 3 {
			return SMSResp{
				Success: false,
				Message: "Format: AIR <AMOUNT> <PIN>",
			}
		}

		return SMSResp{
			Success: true,
			Message: fmt.Sprintf(
				"Airtime NGN %s successful.",
				parts[1],
			),
		}

	case "STMT", "STATEMENT":
		if len(parts) < 2 {
			return SMSResp{
				Success: false,
				Message: "Format: STMT <PIN>",
			}
		}

		return SMSResp{
			Success: true,
			Message: `Last 5 txns:
1. -5000 TRF
2. +10000 DEP
3. -500 AIR
4. -2000 BILL
5. +50000 SAL`,
		}

	case "BILLS":
		return SMSResp{
			Success: true,
			Message: "Format: BILLS <BILLER> <ID> <AMOUNT> <PIN>",
		}

	case "HELP":
		return SMSResp{
			Success: true,
			Message: fmt.Sprintf(
				`54Bank SMS:
BAL|TRF|AIR|STMT|BILLS|HELP
Shortcode: %s`,
				getEnv("SMS_SHORT_CODE", "54545"),
			),
		}

	default:
		return SMSResp{
			Success: false,
			Message: "Unknown command. Send HELP.",
		}
	}
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
		"service":      "sms-service",
		"status":       "healthy",
		"shortCode":    getEnv("SMS_SHORT_CODE", "54545"),
		"uptime_secs":  int(time.Since(startTime).Seconds()),
		"capabilities": []string{"balance", "transfer", "airtime", "statement"},
	})
}

func readiness(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"status": "ready",
	})
}

func receiveSMS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	defer r.Body.Close()

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var sms IncomingSMS

	if err := json.NewDecoder(r.Body).Decode(&sms); err != nil {
		http.Error(
			w,
			"invalid request payload",
			http.StatusBadRequest,
		)

		return
	}

	sms.From = strings.TrimSpace(sms.From)
	sms.Message = strings.TrimSpace(sms.Message)

	if sms.From == "" || sms.Message == "" {
		http.Error(
			w,
			"missing required fields",
			http.StatusBadRequest,
		)

		return
	}

	log.Printf(
		"[sms-service] incoming sms from=%s message=%s",
		sms.From,
		sms.Message,
	)

	resp := processSMS(r.Context(), sms)

	respondJSON(w, http.StatusOK, resp)
}

func sendSMS(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	defer r.Body.Close()

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var sms OutgoingSMS

	if err := json.NewDecoder(r.Body).Decode(&sms); err != nil {
		http.Error(
			w,
			"invalid request payload",
			http.StatusBadRequest,
		)

		return
	}

	sms.To = strings.TrimSpace(sms.To)
	sms.Message = strings.TrimSpace(sms.Message)

	if sms.To == "" || sms.Message == "" {
		http.Error(
			w,
			"missing required fields",
			http.StatusBadRequest,
		)

		return
	}

	log.Printf(
		"[sms-service] outgoing sms to=%s message=%s",
		sms.To,
		sms.Message,
	)

	respondJSON(w, http.StatusOK, SMSResp{
		Success: true,
		Message: "SMS sent successfully",
	})
}

func stats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"sentToday":       12847,
		"deliveryRatePct": 98.7,
		"commandBreakdown": map[string]int{
			"BAL":   5210,
			"TRF":   3190,
			"AIR":   2800,
			"STMT":  1200,
			"BILLS": 447,
		},
		"shortCode": getEnv("SMS_SHORT_CODE", "54545"),
	})
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

func main() {
	port := getEnv("PORT", "9044")

	r := mux.NewRouter()

	r.Use(loggingMiddleware)

	r.HandleFunc("/healthz", healthz).
		Methods(http.MethodGet)

	r.HandleFunc("/health", healthz).
		Methods(http.MethodGet)

	r.HandleFunc("/ready", readiness).
		Methods(http.MethodGet)

	r.Handle("/metrics", promhttp.Handler())

	r.HandleFunc("/api/v1/sms/receive", receiveSMS).
		Methods(http.MethodPost)

	r.HandleFunc("/api/v1/sms/send", sendSMS).
		Methods(http.MethodPost)

	r.HandleFunc("/api/v1/sms/stats", stats).
		Methods(http.MethodGet)

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%s", port),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	go func() {
		log.Printf(
			"[sms-service] SMS Banking Gateway (%s) running on :%s",
			getEnv("SMS_SHORT_CODE", "54545"),
			port,
		)

		if err := srv.ListenAndServe(); err != nil &&
			err != http.ErrServerClosed {

			log.Fatalf("server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)

	signal.Notify(
		quit,
		syscall.SIGINT,
		syscall.SIGTERM,
	)

	<-quit

	log.Println("[sms-service] shutting down...")

	ctx, cancel := context.WithTimeout(
		context.Background(),
		30*time.Second,
	)

	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}

	log.Println("[sms-service] stopped")
}
