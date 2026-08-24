// omini-service — unified omnichannel gateway: WhatsApp, Telegram, USSD, SMS
package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// ─── shared helpers ─────────────────────────────────────────────────────────────

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// SMSProvider is the common interface for USSD and SMS banking services.
type SMSProvider interface {
	SendSMS(ctx context.Context, phone, message string) error
}

type nullSMSProvider struct{}

func (n *nullSMSProvider) SendSMS(_ context.Context, _, _ string) error { return nil }

var startTime = time.Now()

// ─── WhatsApp types ──────────────────────────────────────────────────────────────

type WAMessage struct {
	ID           string `json:"id"`
	WAMessageID  string `json:"waMessageId"`
	PhoneNumber  string `json:"phoneNumber"`
	Direction    string `json:"direction"`
	TemplateName string `json:"templateName,omitempty"`
	MessageType  string `json:"messageType"`
	Content      string `json:"content"`
	Status       string `json:"status"`
	DeliveredAt  string `json:"deliveredAt,omitempty"`
	ReadAt       string `json:"readAt,omitempty"`
}

type WATemplate struct {
	Name       string                   `json:"name"`
	Language   string                   `json:"language"`
	Category   string                   `json:"category"`
	Status     string                   `json:"status"`
	Components []map[string]interface{} `json:"components"`
}

// ─── Telegram types ──────────────────────────────────────────────────────────────

type TGMessage struct {
	ID        string `json:"id"`
	ChatID    int64  `json:"chatId"`
	ChatType  string `json:"chatType"`
	Direction string `json:"direction"`
	Text      string `json:"text"`
	ParseMode string `json:"parseMode,omitempty"`
	Status    string `json:"status"`
	SentAt    string `json:"sentAt"`
}

type TGCommand struct {
	Command     string `json:"command"`
	Description string `json:"description"`
}

// ─── SMS/USSD types ──────────────────────────────────────────────────────────────

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

type USSDRequest struct {
	SessionID   string `json:"sessionId"`
	PhoneNumber string `json:"phoneNumber"`
	ServiceCode string `json:"serviceCode"`
	Text        string `json:"text"`
	NetworkCode string `json:"networkCode"`
}

type USSDMenuResponse struct {
	SessionID  string `json:"sessionId"`
	Response   string `json:"response"`
	EndSession bool   `json:"endSession"`
}

// ─── OminiServer ─────────────────────────────────────────────────────────────────

type OminiServer struct {
	router         *mux.Router
	accountService string
	paymentService string
	ledgerService  string
	fraudService   string

	waMu      sync.RWMutex
	waCounter int
	waMsg     []WAMessage
	waTpl     []WATemplate

	tgMu      sync.RWMutex
	tgCounter int
	tgMsg     []TGMessage
}

func newServer() *OminiServer {
	s := &OminiServer{
		router:         mux.NewRouter(),
		accountService: getEnv("ACCOUNT_SERVICE_URL", "http://account-service:8080"),
		paymentService: getEnv("PAYMENT_SERVICE_URL", "http://payment-service:8080"),
		ledgerService:  getEnv("LEDGER_SERVICE_URL", "http://ledger-service:8080"),
		fraudService:   getEnv("FRAUD_SERVICE_URL", "http://fraud-service:8080"),
		waMsg: []WAMessage{
			{ID: "WA-001", WAMessageID: "wamid.HBgLMjM0ODAxMjM0NTY3OBUCABEYEjVDRTU0", PhoneNumber: "+2348012345678", Direction: "outbound", TemplateName: "credit_alert_v2", MessageType: "template", Content: "Credit Alert: ₦500,000.00 from JOHN OKO", Status: "read", DeliveredAt: "2026-05-09T14:30:02Z", ReadAt: "2026-05-09T14:30:15Z"},
			{ID: "WA-002", WAMessageID: "wamid.HBgLMjM0ODA5ODc2NTQzMhUCABEYEjVDRTU1", PhoneNumber: "+2348098765432", Direction: "outbound", TemplateName: "debit_alert_v2", MessageType: "template", Content: "Debit Alert: ₦150,000.00 to Grace Okafor", Status: "delivered", DeliveredAt: "2026-05-09T15:00:01Z"},
		},
		waTpl: []WATemplate{
			{Name: "credit_alert_v2", Language: "en", Category: "UTILITY", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "Credit Alert: {{1}} from {{2}}. Bal: {{3}}"}}},
			{Name: "debit_alert_v2", Language: "en", Category: "UTILITY", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "Debit Alert: {{1}} to {{2}}. Bal: {{3}}"}}},
			{Name: "otp_delivery_v1", Language: "en", Category: "AUTHENTICATION", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "Your OTP is {{1}}. Valid for {{2}} minutes."}}},
			{Name: "fraud_alert_v1", Language: "en", Category: "UTILITY", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "URGENT: Suspicious transaction {{1}} on your account. Call 0800-54-BANK."}}},
		},
		tgMsg: []TGMessage{
			{ID: "TG-001", ChatID: 1234567890, ChatType: "private", Direction: "inbound", Text: "/balance", Status: "processed", SentAt: "2026-05-09T10:00:00Z"},
			{ID: "TG-002", ChatID: 1234567890, ChatType: "private", Direction: "outbound", Text: "Your balance is ₦1,250,000.00", Status: "delivered", SentAt: "2026-05-09T10:00:01Z"},
		},
	}
	s.setupRoutes()
	return s
}

// ─── route registration ───────────────────────────────────────────────────────────

func (s *OminiServer) setupRoutes() {
	s.router.HandleFunc("/healthz", s.healthz).Methods("GET")
	s.router.HandleFunc("/health", s.healthz).Methods("GET")
	s.router.HandleFunc("/ready", s.ready).Methods("GET")
	s.router.Handle("/metrics", promhttp.Handler())

	wa := s.router.PathPrefix("/v1/whatsapp").Subrouter()
	wa.HandleFunc("/send-template", s.waSendTemplate).Methods("POST")
	wa.Handle("/webhook", webhookAuthMiddleware(http.HandlerFunc(s.waWebhook))).Methods("GET", "POST")
	wa.HandleFunc("/messages", s.waMessages).Methods("GET")
	wa.HandleFunc("/templates", s.waTemplates).Methods("GET")
	wa.HandleFunc("/stats", s.waStats).Methods("GET")

	tg := s.router.PathPrefix("/v1/telegram").Subrouter()
	tg.Handle("/webhook", webhookAuthMiddleware(http.HandlerFunc(s.tgWebhook))).Methods("POST")
	tg.HandleFunc("/send", s.tgSend).Methods("POST")
	tg.HandleFunc("/messages", s.tgListMessages).Methods("GET")
	tg.HandleFunc("/commands", s.tgListCommands).Methods("GET")
	tg.HandleFunc("/stats", s.tgStats).Methods("GET")

	ussd := s.router.PathPrefix("/v1/ussd").Subrouter()
	ussd.Handle("/callback", webhookAuthMiddleware(http.HandlerFunc(s.ussdCallback))).Methods("POST")
	ussd.HandleFunc("/session/{sessionId}", s.ussdSession).Methods("GET")

	sms := s.router.PathPrefix("/v1/sms").Subrouter()
	sms.HandleFunc("/receive", s.smsReceive).Methods("POST")
	sms.HandleFunc("/send", s.smsSend).Methods("POST")

	s.router.HandleFunc("/v1/omni/stats", s.omniStats).Methods("GET")
}

// ─── health ───────────────────────────────────────────────────────────────────────

func (s *OminiServer) healthz(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"status":      "ok",
		"service":     "omini-service",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"channels":    []string{"whatsapp", "telegram", "ussd", "sms"},
		"middleware": map[string]string{
			"kafka":    "omni.outbound, omni.delivery_status, omni.ussd.events, omni.sms.events",
			"redis":    "message_dedup, rate_limit, ussd_sessions",
			"temporal": "MessageBatchWorkflow, USSDSessionWorkflow",
			"postgres": "omnichannel_db",
		},
	})
}

func (s *OminiServer) ready(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]string{"status": "ready"})
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────────

func (s *OminiServer) waSendTemplate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PhoneNumber  string                   `json:"phoneNumber"`
		TemplateName string                   `json:"templateName"`
		Language     string                   `json:"language"`
		Parameters   []map[string]interface{} `json:"parameters"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	s.waMu.Lock()
	s.waCounter++
	msg := WAMessage{
		ID: fmt.Sprintf("WA-%03d", s.waCounter+2), WAMessageID: fmt.Sprintf("wamid.%d", time.Now().UnixNano()),
		PhoneNumber: req.PhoneNumber, Direction: "outbound",
		TemplateName: req.TemplateName, MessageType: "template",
		Content: "Template message sent", Status: "accepted",
	}
	s.waMsg = append(s.waMsg, msg)
	s.waMu.Unlock()
	respondJSON(w, 201, map[string]interface{}{"success": true, "message": msg})
}

func (s *OminiServer) waWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		respondJSON(w, 200, map[string]string{"hub.challenge": r.URL.Query().Get("hub.challenge")})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	respondJSON(w, 200, map[string]interface{}{"processed": true, "event": body})
}

func (s *OminiServer) waMessages(w http.ResponseWriter, _ *http.Request) {
	s.waMu.RLock()
	defer s.waMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"messages": s.waMsg, "total": len(s.waMsg)})
}

func (s *OminiServer) waTemplates(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"templates": s.waTpl, "total": len(s.waTpl)})
}

func (s *OminiServer) waStats(w http.ResponseWriter, _ *http.Request) {
	s.waMu.RLock()
	defer s.waMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"channel": "whatsapp", "apiVersion": "v18.0",
		"sentToday": 95000, "deliveryRatePct": 99.4, "avgLatencyMs": 1200,
		"totalMessages": len(s.waMsg),
	})
}

// ─── Telegram ─────────────────────────────────────────────────────────────────────

var botCommands = []TGCommand{
	{"/balance", "Check your account balance"},
	{"/transfer", "Transfer funds: /transfer <account> <amount>"},
	{"/statement", "Mini statement (last 5 transactions)"},
	{"/airtime", "Buy airtime: /airtime <phone> <amount>"},
	{"/bills", "Pay utility bills"},
	{"/help", "Show all available commands"},
}

func (s *OminiServer) tgWebhook(w http.ResponseWriter, r *http.Request) {
	var update struct {
		UpdateID int64 `json:"update_id"`
		Message  *struct {
			Chat struct {
				ID   int64  `json:"id"`
				Type string `json:"type"`
			} `json:"chat"`
			Text string `json:"text"`
		} `json:"message"`
	}
	json.NewDecoder(r.Body).Decode(&update)
	if update.Message == nil {
		respondJSON(w, 200, map[string]bool{"ok": true})
		return
	}
	s.tgMu.Lock()
	s.tgCounter++
	inbound := TGMessage{
		ID: fmt.Sprintf("TG-%03d", s.tgCounter), ChatID: update.Message.Chat.ID,
		ChatType: update.Message.Chat.Type, Direction: "inbound",
		Text: update.Message.Text, Status: "received",
		SentAt: time.Now().UTC().Format(time.RFC3339),
	}
	s.tgMsg = append(s.tgMsg, inbound)
	reply := s.buildTGReply(update.Message.Chat.ID, update.Message.Text)
	s.tgCounter++
	s.tgMsg = append(s.tgMsg, reply)
	s.tgMu.Unlock()
	respondJSON(w, 200, map[string]interface{}{"ok": true, "reply": reply.Text})
}

func (s *OminiServer) buildTGReply(chatID int64, text string) TGMessage {
	cmd := strings.ToLower(strings.TrimSpace(strings.SplitN(text, " ", 2)[0]))
	var replyText string
	switch cmd {
	case "/balance":
		replyText = "💰 Balance: ₦1,250,000.00 | Available: ₦1,150,000.00\nAs at: " + time.Now().Format("02 Jan 2006 15:04")
	case "/statement":
		replyText = "📋 Last 5 Transactions:\n1. -₦5,000 Transfer\n2. +₦10,000 Deposit\n3. -₦500 Airtime\n4. -₦2,000 Bills\n5. +₦50,000 Salary"
	case "/transfer":
		replyText = "💸 Format: /transfer <10-digit account> <amount>\nExample: /transfer 0012345678 5000"
	case "/airtime":
		replyText = "📱 Format: /airtime <phone> <amount>\nExample: /airtime 08012345678 1000"
	case "/bills":
		replyText = "🧾 Bill payment: use *901# or SMS BILLS <BILLER> <ID> <AMOUNT> <PIN>"
	default:
		replyText = "🏦 54Bank Telegram Banking\n\n/balance — Check balance\n/transfer — Send money\n/statement — Mini statement\n/airtime — Buy airtime\n/bills — Pay bills\n/help — This menu"
	}
	return TGMessage{
		ID: fmt.Sprintf("TG-%03d", s.tgCounter), ChatID: chatID,
		Direction: "outbound", Text: replyText, Status: "queued",
		SentAt: time.Now().UTC().Format(time.RFC3339),
	}
}

func (s *OminiServer) tgSend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChatID    int64  `json:"chatId"`
		Text      string `json:"text"`
		ParseMode string `json:"parseMode"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	s.tgMu.Lock()
	s.tgCounter++
	msg := TGMessage{
		ID: fmt.Sprintf("TG-%03d", s.tgCounter), ChatID: req.ChatID,
		Direction: "outbound", Text: req.Text, ParseMode: req.ParseMode,
		Status: "queued", SentAt: time.Now().UTC().Format(time.RFC3339),
	}
	s.tgMsg = append(s.tgMsg, msg)
	s.tgMu.Unlock()
	respondJSON(w, 201, map[string]interface{}{"ok": true, "message": msg})
}

func (s *OminiServer) tgListMessages(w http.ResponseWriter, _ *http.Request) {
	s.tgMu.RLock()
	defer s.tgMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"messages": s.tgMsg, "total": len(s.tgMsg)})
}

func (s *OminiServer) tgListCommands(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"commands": botCommands, "total": len(botCommands)})
}

func (s *OminiServer) tgStats(w http.ResponseWriter, _ *http.Request) {
	s.tgMu.RLock()
	defer s.tgMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"channel": "telegram", "botApiVersion": "7.0",
		"totalMessages": len(s.tgMsg), "commands": len(botCommands),
	})
}

// ─── USSD ─────────────────────────────────────────────────────────────────────────

func (s *OminiServer) ussdCallback(w http.ResponseWriter, r *http.Request) {
	var req USSDRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	respondJSON(w, 200, s.processUSSD(r.Context(), req))
}

func (s *OminiServer) processUSSD(_ context.Context, req USSDRequest) USSDMenuResponse {
	inputs := strings.Split(req.Text, "*")
	level := len(inputs)
	if req.Text == "" {
		return USSDMenuResponse{SessionID: req.SessionID, EndSession: false,
			Response: "CON Welcome to 54Bank\n1. Check Balance\n2. Transfer Money\n3. Buy Airtime\n4. Pay Bills\n5. Mini Statement"}
	}
	switch inputs[0] {
	case "1":
		if level == 1 {
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Enter your PIN:"}
		}
		return USSDMenuResponse{SessionID: req.SessionID, EndSession: true, Response: "END Your balance is NGN 50,000.00"}
	case "2":
		switch level {
		case 1:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Enter recipient account number:"}
		case 2:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Enter amount:"}
		case 3:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Enter your PIN:"}
		default:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: true, Response: "END Transfer initiated. SMS confirmation incoming."}
		}
	case "3":
		switch level {
		case 1:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Select network:\n1. MTN  2. Airtel  3. Glo  4. 9mobile"}
		case 2:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Enter amount:"}
		case 3:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Enter your PIN:"}
		default:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: true, Response: "END Airtime purchase successful."}
		}
	case "4":
		switch level {
		case 1:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Select biller:\n1. DSTV  2. GOTV  3. Electricity  4. Water"}
		case 2:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Enter customer ID:"}
		case 3:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Enter amount:"}
		case 4:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Enter your PIN:"}
		default:
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: true, Response: "END Bill payment successful."}
		}
	case "5":
		if level == 1 {
			return USSDMenuResponse{SessionID: req.SessionID, EndSession: false, Response: "CON Enter your PIN:"}
		}
		return USSDMenuResponse{SessionID: req.SessionID, EndSession: true,
			Response: "END Last 5 transactions:\n1. -5000 Transfer\n2. +10000 Deposit\n3. -500 Airtime\n4. -2000 Bills\n5. +50000 Salary"}
	default:
		return USSDMenuResponse{SessionID: req.SessionID, EndSession: true, Response: "END Invalid option. Please try again."}
	}
}

func (s *OminiServer) ussdSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	respondJSON(w, 200, map[string]string{"sessionId": vars["sessionId"], "status": "active"})
}

// ─── SMS banking ──────────────────────────────────────────────────────────────────

func (s *OminiServer) smsReceive(w http.ResponseWriter, r *http.Request) {
	var sms IncomingSMS
	if err := json.NewDecoder(r.Body).Decode(&sms); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	respondJSON(w, 200, s.processSMS(r.Context(), sms))
}

func (s *OminiServer) processSMS(_ context.Context, sms IncomingSMS) SMSResp {
	parts := strings.Fields(strings.ToUpper(strings.TrimSpace(sms.Message)))
	if len(parts) == 0 {
		return SMSResp{false, "Invalid command. Send HELP for available commands."}
	}
	switch parts[0] {
	case "BAL", "BALANCE":
		if len(parts) < 2 {
			return SMSResp{false, "Format: BAL <PIN>"}
		}
		return SMSResp{true, fmt.Sprintf("Balance: NGN 50,000.00 as at %s", time.Now().Format("02-Jan-2006 15:04"))}
	case "TRF", "TRANSFER":
		if len(parts) < 4 {
			return SMSResp{false, "Format: TRF <ACCOUNT> <AMOUNT> <PIN>"}
		}
		if !regexp.MustCompile(`^\d{10}$`).MatchString(parts[1]) {
			return SMSResp{false, "Invalid account number. Must be 10 digits."}
		}
		return SMSResp{true, fmt.Sprintf("Transfer of NGN %s to %s initiated. Confirmation SMS incoming.", parts[2], parts[1])}
	case "AIR", "AIRTIME":
		if len(parts) < 3 {
			return SMSResp{false, "Format: AIR <AMOUNT> <PIN>"}
		}
		return SMSResp{true, fmt.Sprintf("Airtime purchase of NGN %s successful.", parts[1])}
	case "STMT", "STATEMENT":
		if len(parts) < 2 {
			return SMSResp{false, "Format: STMT <PIN>"}
		}
		return SMSResp{true, "Last 5 txns:\n1. -5000 TRF\n2. +10000 DEP\n3. -500 AIR\n4. -2000 BILL\n5. +50000 SAL"}
	case "BILLS":
		return SMSResp{true, "Format: BILLS <BILLER> <CUSTOMER_ID> <AMOUNT> <PIN>"}
	case "HELP":
		return SMSResp{true, "54Bank SMS:\nBAL <PIN>  TRF <ACCT> <AMT> <PIN>  AIR <AMT> <PIN>  STMT <PIN>  BILLS  HELP"}
	default:
		return SMSResp{false, "Unknown command. Send HELP."}
	}
}

func (s *OminiServer) smsSend(w http.ResponseWriter, r *http.Request) {
	var sms OutgoingSMS
	if err := json.NewDecoder(r.Body).Decode(&sms); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	log.Printf("[omini] SMS → %s: %s", sms.To, sms.Message)
	respondJSON(w, 200, SMSResp{true, "SMS sent successfully"})
}

// ─── aggregate stats ───────────────────────────────────────────────────────────────

func (s *OminiServer) omniStats(w http.ResponseWriter, _ *http.Request) {
	s.waMu.RLock()
	waMsgCount := len(s.waMsg)
	s.waMu.RUnlock()
	s.tgMu.RLock()
	tgMsgCount := len(s.tgMsg)
	s.tgMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"service":     "omini-service",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"channels": map[string]interface{}{
			"whatsapp": map[string]interface{}{"messages": waMsgCount, "templates": len(s.waTpl), "apiVersion": "v18.0"},
			"telegram": map[string]interface{}{"messages": tgMsgCount, "commands": len(botCommands), "botApiVersion": "7.0"},
			"ussd":     map[string]interface{}{"shortCode": getEnv("USSD_SHORT_CODE", "*901#"), "status": "active"},
			"sms":      map[string]interface{}{"shortCode": getEnv("SMS_SHORT_CODE", "54545"), "status": "active"},
		},
	})
}

// ─── main ──────────────────────────────────────────────────────────────────────────

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + required exp claim). Fail-closed: any verification
// problem yields 401. Identity headers (X-User-Id, X-Keycloak-ID, X-Tenant-ID,
// X-User-Role) are overwritten from verified claims — caller-supplied values
// are never trusted.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	ensureJWKSRefresh()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if isProbePath(p) || p == "/v1/whatsapp/webhook" || p == "/v1/telegram/webhook" || p == "/v1/ussd/callback" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}
		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Unknown key — refresh once and retry (key rotation).
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}
		claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			http.Error(w, `{"error":"invalid claims encoding"}`, http.StatusUnauthorized)
			return
		}
		var claims map[string]interface{}
		if err := json.Unmarshal(claimsBytes, &claims); err != nil {
			http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
			return
		}
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Identity headers come ONLY from verified claims; overwrite or drop any
		// caller-supplied values before invoking the handler.
		if sub, ok := claims["sub"].(string); ok && sub != "" {
			r.Header.Set("X-User-Id", sub)
			r.Header.Set("X-Keycloak-ID", sub)
		} else {
			r.Header.Del("X-User-Id")
			r.Header.Del("X-Keycloak-ID")
		}
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		r.Header.Del("X-User-Role")
		if ra, ok := claims["realm_access"].(map[string]interface{}); ok {
			if roleList, ok := ra["roles"].([]interface{}); ok {
				roles := make([]string, 0, len(roleList))
				for _, v := range roleList {
					if s, ok := v.(string); ok {
						roles = append(roles, s)
					}
				}
				if len(roles) > 0 {
					r.Header.Set("X-User-Role", strings.Join(roles, ","))
				}
			}
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// --- Webhook HMAC verification (fail-closed) ---
// Provider webhooks are server-to-server calls: no end-user JWT exists.
// They are authenticated with a shared-secret HMAC-SHA256 signature over the
// raw request body (X-Webhook-Signature hex header, or the Meta-style
// X-Hub-Signature-256 "sha256=<hex>" header). WEBHOOK_SECRET is REQUIRED
// (no default): the process refuses to start without it.
var webhookHMACSecret = func() []byte {
	s := os.Getenv("WEBHOOK_SECRET")
	if s == "" {
		log.Fatalf("WEBHOOK_SECRET is not set; refusing to start a webhook receiver without a shared secret (fail-closed)")
	}
	return []byte(s)
}()

// webhookAuthMiddleware enforces HMAC-SHA256 body signatures on provider
// webhook endpoints. GET (provider verification handshake) requires the
// hub.verify_token query parameter to match the shared secret.
func webhookAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			if subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("hub.verify_token")), webhookHMACSecret) != 1 {
				http.Error(w, `{"error":"invalid webhook verification token"}`, http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, `{"error":"webhook body read failed"}`, http.StatusBadRequest)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		sig := r.Header.Get("X-Webhook-Signature")
		if sig == "" {
			sig = strings.TrimPrefix(r.Header.Get("X-Hub-Signature-256"), "sha256=")
		}
		provided, err := hex.DecodeString(sig)
		if err != nil {
			http.Error(w, `{"error":"invalid webhook signature encoding"}`, http.StatusUnauthorized)
			return
		}
		mac := hmac.New(sha256.New, webhookHMACSecret)
		mac.Write(body)
		if !hmac.Equal(provided, mac.Sum(nil)) {
			http.Error(w, `{"error":"invalid webhook signature"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- JWT Validation (Keycloak JWKS, RS256, fail-closed) ---

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

var jwksRefreshOnce sync.Once

// jwtRealmURL returns the Keycloak realm base URL used to fetch JWKS keys.
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

// fetchJWKS refreshes the RSA public keys used to verify Bearer tokens.
func fetchJWKS(realmURL string) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil || len(nBytes) == 0 {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil || len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

// ensureJWKSRefresh starts the initial JWKS fetch and the 5-minute refresher
// exactly once per process.
func ensureJWKSRefresh() {
	jwksRefreshOnce.Do(func() {
		go fetchJWKS(jwtRealmURL())
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				fetchJWKS(jwtRealmURL())
			}
		}()
	})
}

// isProbePath reports whether p is a health/metrics endpoint that must remain
// unauthenticated for orchestrators (exact or suffixed probe paths).
func isProbePath(p string) bool {
	switch p {
	case "/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics", "/ping":
		return true
	}
	for _, s := range []string{"/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics"} {
		if strings.HasSuffix(p, s) {
			return true
		}
	}
	return false
}

// tenantFromClaims derives the tenant ONLY from verified token claims — never
// from caller-supplied headers or parameters.
func tenantFromClaims(claims map[string]interface{}) string {
	for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
		if s, ok := claims[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

func main() {
	port := getEnv("PORT", "9141")
	srv := newServer()

	httpSrv := &http.Server{
		Addr:         ":" + port,
		Handler:      jwtAuthMiddleware(srv.router),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("[omini-service] WhatsApp · Telegram · USSD · SMS on :%s", port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[omini-service] shutting down…")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	httpSrv.Shutdown(ctx)
}
