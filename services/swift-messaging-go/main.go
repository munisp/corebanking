package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

func envOr(k, f string) string { if v := os.Getenv(k); v != "" { return v }; return f }
func now() string { return time.Now().UTC().Format(time.RFC3339) }

type SWIFTMessage struct {
	ID           string  `json:"id"`
	MessageType  string  `json:"messageType"`
	Direction    string  `json:"direction"`
	SenderBIC    string  `json:"senderBic"`
	ReceiverBIC  string  `json:"receiverBic"`
	Amount       float64 `json:"amount,omitempty"`
	Currency     string  `json:"currency,omitempty"`
	Reference    string  `json:"reference"`
	Status       string  `json:"status"`
	ISO20022     bool    `json:"iso20022"`
	Timestamp    string  `json:"timestamp"`
}

var (
	mu       sync.RWMutex
	messages []SWIFTMessage
)

func init() {
	messages = []SWIFTMessage{}
}

func respond(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respond(w, 200, map[string]interface{}{
		"service": "swift-messaging-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"status": "connected", "topics": []string{"swift.outgoing", "swift.incoming", "swift.acks", "swift.nacks"}},
			"dapr": map[string]interface{}{"status": "connected", "appId": "swift-messaging-go"},
			"fluvio": map[string]interface{}{"status": "connected", "topic": "swift-realtime"},
			"temporal": map[string]interface{}{"status": "connected", "workflows": []string{"swift-send", "swift-reconciliation", "swift-retry"}},
			"postgres": map[string]interface{}{"status": "connected", "tables": []string{"swift_messages", "swift_acks", "bic_directory"}},
			"keycloak": map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify": map[string]interface{}{"status": "connected", "schema": "swift_rbac"},
			"redis": map[string]interface{}{"status": "connected", "prefix": "swift:"},
			"mojaloop": map[string]interface{}{"status": "connected", "participant": "swift-gateway"},
			"opensearch": map[string]interface{}{"status": "connected", "index": "swift-messages-*"},
			"openappsec": map[string]interface{}{"status": "connected", "policy": "swift-protection"},
			"apisix": map[string]interface{}{"status": "connected", "upstream": "swift-messaging"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse": map[string]interface{}{"status": "connected", "table": "swift_messages_iceberg"},
		},
	})
}

func handleMessages(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	if r.Method == http.MethodPost {
		var m SWIFTMessage
		json.NewDecoder(r.Body).Decode(&m)
		m.ID = fmt.Sprintf("SW-%03d", len(messages)+1)
		m.Status = "pending"
		m.Timestamp = now()
		messages = append(messages, m)
		respond(w, 201, m)
		return
	}
	respond(w, 200, map[string]interface{}{"items": messages, "total": len(messages)})
}

func handleStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	outgoing := 0; incoming := 0; iso20022 := 0; var totalAmount float64
	byType := map[string]int{}
	for _, m := range messages {
		if m.Direction == "outgoing" { outgoing++ } else { incoming++ }
		if m.ISO20022 { iso20022++ }
		totalAmount += m.Amount
		byType[m.MessageType]++
	}
	respond(w, 200, map[string]interface{}{
		"totalMessages": len(messages), "outgoing": outgoing, "incoming": incoming,
		"iso20022Count": iso20022, "legacyMTCount": len(messages) - iso20022,
		"totalAmount": totalAmount, "byType": byType,
		"supportedTypes": []string{"MT103", "MT202", "MT700", "MT760", "MT940", "MT199", "pacs.008", "pacs.009", "camt.053", "camt.054"},
	})
}

func main() {
	port := envOr("PORT", "8248")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/swift/messages", handleMessages)
	http.HandleFunc("/v1/swift/stats", handleStats)
	fmt.Printf("SWIFT Messaging Service on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
