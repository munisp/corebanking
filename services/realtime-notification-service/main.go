// realtime-notification-service — WebSocket and SSE push notifications for 54Bank
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
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

type PushEvent struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	EventType string `json:"eventType"`
	Payload   string `json:"payload"`
	Channel   string `json:"channel"`
	SentAt    string `json:"sentAt"`
	Delivered bool   `json:"delivered"`
}

var (
	mu      sync.RWMutex
	counter int
	evts    = []PushEvent{
		{ID: "EVT-001", UserID: "USR-001", EventType: "transaction.completed", Payload: `{"amount":50000,"type":"credit"}`, Channel: "websocket", SentAt: "2026-05-20T08:00:05Z", Delivered: true},
		{ID: "EVT-002", UserID: "USR-002", EventType: "fraud.alert", Payload: `{"severity":"HIGH","action":"block"}`, Channel: "websocket", SentAt: "2026-05-20T08:01:00Z", Delivered: true},
	}
)

func main() {
	port := getEnv("PORT", "9171")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":     "realtime-notification-service",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"transports":  []string{"websocket", "sse", "long-polling"},
			"middleware": map[string]string{
				"kafka": "notifications.realtime",
				"redis": "presence_store, pub_sub",
			},
		})
	})

	mux.HandleFunc("/v1/notifications/push", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			UserID    string `json:"userId"`
			EventType string `json:"eventType"`
			Payload   string `json:"payload"`
			Channel   string `json:"channel"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		mu.Lock()
		counter++
		ev := PushEvent{
			ID:        fmt.Sprintf("EVT-%03d", counter+2),
			UserID:    req.UserID,
			EventType: req.EventType,
			Payload:   req.Payload,
			Channel:   req.Channel,
			SentAt:    time.Now().UTC().Format(time.RFC3339),
			Delivered: true,
		}
		evts = append(evts, ev)
		mu.Unlock()
		respondJSON(w, 202, map[string]interface{}{"eventId": ev.ID, "queued": true})
	})

	mux.HandleFunc("/v1/notifications/events", func(w http.ResponseWriter, _ *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{"events": evts, "total": len(evts)})
	})

	mux.HandleFunc("/v1/notifications/ws/stats", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"activeConnections": 8420,
			"eventsDelivered":   284000,
			"avgDeliveryMs":     45,
			"reconnectRate":     0.02,
		})
	})

	log.Printf("[realtime-notification-service] Realtime push notifications on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
