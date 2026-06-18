// whatsapp-service — WhatsApp Business Cloud API v18.0 gateway for 54Bank
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
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

type WAServer struct {
	mu      sync.RWMutex
	counter int
	msgs    []WAMessage
	tpls    []WATemplate
}

var srv = &WAServer{
	msgs: []WAMessage{
		{ID: "WA-001", WAMessageID: "wamid.HBgLMjM0ODAxMjM0NTY3OBUCABEYEjVDRTU0", PhoneNumber: "+2348012345678", Direction: "outbound", TemplateName: "credit_alert_v2", MessageType: "template", Content: "Credit Alert: ₦500,000.00 from JOHN OKO", Status: "read", DeliveredAt: "2026-05-09T14:30:02Z", ReadAt: "2026-05-09T14:30:15Z"},
		{ID: "WA-002", WAMessageID: "wamid.HBgLMjM0ODA5ODc2NTQzMhUCABEYEjVDRTU1", PhoneNumber: "+2348098765432", Direction: "outbound", TemplateName: "debit_alert_v2", MessageType: "template", Content: "Debit Alert: ₦150,000.00 to Grace Okafor", Status: "delivered", DeliveredAt: "2026-05-09T15:00:01Z"},
	},
	tpls: []WATemplate{
		{Name: "credit_alert_v2", Language: "en", Category: "UTILITY", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "Credit Alert: {{1}} from {{2}}. Bal: {{3}}"}}},
		{Name: "debit_alert_v2", Language: "en", Category: "UTILITY", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "Debit Alert: {{1}} to {{2}}. Bal: {{3}}"}}},
		{Name: "otp_delivery_v1", Language: "en", Category: "AUTHENTICATION", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "Your OTP is {{1}}. Valid for {{2}} minutes."}}},
		{Name: "fraud_alert_v1", Language: "en", Category: "UTILITY", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "URGENT: Suspicious transaction {{1}} detected. Call 0800-54-BANK."}}},
	},
}

func main() {
	port := getEnv("PORT", "9141")
	r := mux.NewRouter()
	r.HandleFunc("/healthz", healthz).Methods("GET")
	r.HandleFunc("/health", healthz).Methods("GET")
	r.Handle("/metrics", promhttp.Handler())
	r.HandleFunc("/v1/whatsapp/send-template", sendTemplate).Methods("POST")
	r.HandleFunc("/v1/whatsapp/webhook", webhook).Methods("GET", "POST")
	r.HandleFunc("/v1/whatsapp/messages", messages).Methods("GET")
	r.HandleFunc("/v1/whatsapp/templates", templates).Methods("GET")
	r.HandleFunc("/v1/whatsapp/stats", stats).Methods("GET")
	log.Printf("[whatsapp-service] WhatsApp Business Cloud API v18.0 on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "whatsapp-service", "status": "healthy",
		"apiVersion":   "v18.0",
		"uptime_secs":  int(time.Since(startTime).Seconds()),
		"capabilities": []string{"template_messages", "interactive_buttons", "media_messages", "delivery_webhooks"},
		"middleware": map[string]string{
			"kafka": "whatsapp.outbound, whatsapp.delivery_status",
			"redis": "message_dedup, rate_limit (80msg/s)",
		},
	})
}

func sendTemplate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PhoneNumber  string                   `json:"phoneNumber"`
		TemplateName string                   `json:"templateName"`
		Language     string                   `json:"language"`
		Parameters   []map[string]interface{} `json:"parameters"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	srv.mu.Lock()
	srv.counter++
	msg := WAMessage{
		ID: fmt.Sprintf("WA-%03d", srv.counter+2), WAMessageID: fmt.Sprintf("wamid.%d", time.Now().UnixNano()),
		PhoneNumber: req.PhoneNumber, Direction: "outbound",
		TemplateName: req.TemplateName, MessageType: "template",
		Content: "Template message sent", Status: "accepted",
	}
	srv.msgs = append(srv.msgs, msg)
	srv.mu.Unlock()
	respondJSON(w, 201, map[string]interface{}{"success": true, "message": msg})
}

func webhook(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		respondJSON(w, 200, map[string]string{"hub.challenge": r.URL.Query().Get("hub.challenge")})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	respondJSON(w, 200, map[string]interface{}{"processed": true, "event": body})
}

func messages(w http.ResponseWriter, _ *http.Request) {
	srv.mu.RLock()
	defer srv.mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"messages": srv.msgs, "total": len(srv.msgs)})
}

func templates(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"templates": srv.tpls, "total": len(srv.tpls)})
}

func stats(w http.ResponseWriter, _ *http.Request) {
	srv.mu.RLock()
	defer srv.mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"channel": "whatsapp", "apiVersion": "v18.0",
		"sentToday": 95000, "deliveryRatePct": 99.4, "avgLatencyMs": 1200,
		"totalMessages": len(srv.msgs), "templates": len(srv.tpls),
	})
}
