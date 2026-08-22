// telegram-service — Telegram Bot API gateway for 54Bank
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
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
	json.NewEncoder(w).Encode(data)
}

type Message struct {
	ID        string `json:"id"`
	ChatID    int64  `json:"chatId"`
	Direction string `json:"direction"`
	Text      string `json:"text"`
	Status    string `json:"status"`
	SentAt    string `json:"sentAt"`
}

type TGServer struct {
	mu      sync.RWMutex
	counter int
	msgs    []Message
}

var srv = &TGServer{
	msgs: []Message{
		{ID: "TG-001", ChatID: 1234567890, Direction: "inbound", Text: "/balance", Status: "processed", SentAt: "2026-05-09T10:00:00Z"},
		{ID: "TG-002", ChatID: 1234567890, Direction: "outbound", Text: "Your balance is ₦1,250,000.00", Status: "delivered", SentAt: "2026-05-09T10:00:01Z"},
	},
}

func main() {
	port := getEnv("PORT", "9042")
	r := mux.NewRouter()
	r.HandleFunc("/healthz", healthz).Methods("GET")
	r.HandleFunc("/health", healthz).Methods("GET")
	r.Handle("/metrics", promhttp.Handler())
	r.HandleFunc("/v1/telegram/webhook", webhook).Methods("POST")
	r.HandleFunc("/v1/telegram/send", send).Methods("POST")
	r.HandleFunc("/v1/telegram/messages", messages).Methods("GET")
	r.HandleFunc("/v1/telegram/commands", commands).Methods("GET")
	r.HandleFunc("/v1/telegram/stats", stats).Methods("GET")
	log.Printf("[telegram-service] Telegram Bot API gateway on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "telegram-service", "status": "healthy",
		"uptime_secs":   int(time.Since(startTime).Seconds()),
		"botApiVersion": "7.0",
		"capabilities":  []string{"webhook", "send_message", "banking_commands"},
	})
}

func webhook(w http.ResponseWriter, r *http.Request) {
	var update struct {
		UpdateID int64 `json:"update_id"`
		Message  *struct {
			Chat struct {
				ID int64 `json:"id"`
			} `json:"chat"`
			Text string `json:"text"`
		} `json:"message"`
	}
	json.NewDecoder(r.Body).Decode(&update)
	if update.Message == nil {
		respondJSON(w, 200, map[string]bool{"ok": true})
		return
	}
	srv.mu.Lock()
	srv.counter++
	srv.msgs = append(srv.msgs, Message{
		ID: fmt.Sprintf("TG-%03d", srv.counter), ChatID: update.Message.Chat.ID,
		Direction: "inbound", Text: update.Message.Text, Status: "received",
		SentAt: time.Now().UTC().Format(time.RFC3339),
	})
	reply := buildReply(update.Message.Chat.ID, update.Message.Text)
	srv.counter++
	srv.msgs = append(srv.msgs, reply)
	srv.mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{"ok": true, "reply": reply.Text})
}

func buildReply(chatID int64, text string) Message {
	cmd := strings.ToLower(strings.SplitN(strings.TrimSpace(text), " ", 2)[0])
	var body string
	switch cmd {
	case "/balance":
		body = "💰 Balance: ₦1,250,000.00 | Available: ₦1,150,000.00\nAs at: " + time.Now().Format("02 Jan 2006 15:04")
	case "/statement":
		body = "📋 Last 5 Transactions:\n1. -₦5,000 Transfer\n2. +₦10,000 Deposit\n3. -₦500 Airtime\n4. -₦2,000 Bills\n5. +₦50,000 Salary"
	case "/transfer":
		body = "💸 Format: /transfer <10-digit account> <amount>"
	case "/airtime":
		body = "📱 Format: /airtime <phone> <amount>"
	default:
		body = "🏦 54Bank Telegram Banking\n/balance /transfer /statement /airtime /bills /help"
	}
	return Message{
		ID: fmt.Sprintf("TG-%03d", srv.counter), ChatID: chatID,
		Direction: "outbound", Text: body, Status: "queued",
		SentAt: time.Now().UTC().Format(time.RFC3339),
	}
}

func send(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChatID int64  `json:"chatId"`
		Text   string `json:"text"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	srv.mu.Lock()
	srv.counter++
	msg := Message{
		ID: fmt.Sprintf("TG-%03d", srv.counter), ChatID: req.ChatID,
		Direction: "outbound", Text: req.Text, Status: "queued",
		SentAt: time.Now().UTC().Format(time.RFC3339),
	}
	srv.msgs = append(srv.msgs, msg)
	srv.mu.Unlock()
	respondJSON(w, 201, map[string]interface{}{"ok": true, "message": msg})
}

func messages(w http.ResponseWriter, _ *http.Request) {
	srv.mu.RLock()
	defer srv.mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"messages": srv.msgs, "total": len(srv.msgs)})
}

func commands(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"commands": []map[string]string{
		{"command": "/balance", "description": "Check account balance"},
		{"command": "/transfer", "description": "Transfer funds"},
		{"command": "/statement", "description": "Mini statement"},
		{"command": "/airtime", "description": "Buy airtime"},
		{"command": "/bills", "description": "Pay bills"},
		{"command": "/help", "description": "Show commands"},
	}, "total": 6})
}

func stats(w http.ResponseWriter, _ *http.Request) {
	srv.mu.RLock()
	defer srv.mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"channel": "telegram", "totalMessages": len(srv.msgs),
		"botApiVersion": "7.0", "uptime_secs": int(time.Since(startTime).Seconds()),
	})
}
