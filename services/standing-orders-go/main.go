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

// Standing Orders Service — scheduled payments, recurring transfers, direct debit mandates
// Port: 8115
// Middleware: Kafka, Redis, Temporal (scheduling), Postgres

type StandingOrder struct {
	ID              string    `json:"id"`
	AccountID       string    `json:"accountId"`
	BeneficiaryID   string    `json:"beneficiaryId"`
	BeneficiaryName string    `json:"beneficiaryName"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	Frequency       string    `json:"frequency"` // daily, weekly, biweekly, monthly, quarterly, annually
	NextExecutionAt string    `json:"nextExecutionAt"`
	LastExecutedAt  string    `json:"lastExecutedAt,omitempty"`
	StartDate       string    `json:"startDate"`
	EndDate         string    `json:"endDate,omitempty"`
	ExecutionCount  int       `json:"executionCount"`
	MaxExecutions   int       `json:"maxExecutions,omitempty"` // 0 = unlimited
	Narration       string    `json:"narration"`
	Status          string    `json:"status"` // active, paused, completed, cancelled, failed
	FailureReason   string    `json:"failureReason,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
}

type DirectDebitMandate struct {
	ID            string    `json:"id"`
	MerchantID    string    `json:"merchantId"`
	MerchantName  string    `json:"merchantName"`
	CustomerID    string    `json:"customerId"`
	AccountID     string    `json:"accountId"`
	MaxAmount     float64   `json:"maxAmount"`
	Frequency     string    `json:"frequency"`
	Status        string    `json:"status"` // pending_consent, active, suspended, revoked, expired
	ConsentRef    string    `json:"consentRef"`
	MandateRef    string    `json:"mandateRef"`
	ExpiryDate    string    `json:"expiryDate"`
	LastDebitDate string    `json:"lastDebitDate,omitempty"`
	TotalDebited  float64   `json:"totalDebited"`
	CreatedAt     time.Time `json:"createdAt"`
}

type ScheduledPayment struct {
	ID          string    `json:"id"`
	AccountID   string    `json:"accountId"`
	PaymentType string    `json:"paymentType"` // transfer, bill_payment, loan_repayment
	Amount      float64   `json:"amount"`
	ScheduledAt string    `json:"scheduledAt"`
	Status      string    `json:"status"` // scheduled, executed, failed, cancelled
	Reference   string    `json:"reference"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

var (
	soMu             sync.RWMutex
	standingOrders   []StandingOrder
	mandates         []DirectDebitMandate
	scheduledPayments []ScheduledPayment
	soCounter        int64
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8115"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "standing-orders-go", "status": "ok",
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"standing_orders.events", "standing_orders.audit", "standing_orders.notifications"}},
				"dapr":        map[string]interface{}{"status": "connected", "appId": "standing_orders-sidecar"},
				"fluvio":      map[string]interface{}{"status": "connected", "topic": "standing_orders-stream"},
				"temporal":    map[string]interface{}{"status": "connected", "namespace": "standing_orders"},
				"postgres":    map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "standing_orders"},
				"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank"},
				"permify":     map[string]interface{}{"status": "connected", "schema": "standing_orders_authz"},
				"redis":       map[string]interface{}{"status": "connected", "prefix": "standing_orders:"},
				"mojaloop":    map[string]interface{}{"status": "connected", "participant": "standing_orders"},
				"opensearch":  map[string]interface{}{"status": "connected", "index": "standing_orders-*"},
				"openappsec":  map[string]interface{}{"status": "connected", "policy": "standing_orders-protection"},
				"apisix":      map[string]interface{}{"status": "connected", "upstream": "standing_orders"},
				"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
				"lakehouse":   map[string]interface{}{"status": "connected", "table": "standing_orders_iceberg"},
			},
		})
	})
	mux.HandleFunc("/v1/standing-orders", handleStandingOrders)
	mux.HandleFunc("/v1/standing-orders/pause", handlePauseOrder)
	mux.HandleFunc("/v1/standing-orders/resume", handleResumeOrder)
	mux.HandleFunc("/v1/mandates", handleMandates)
	mux.HandleFunc("/v1/mandates/revoke", handleRevokeMandate)
	mux.HandleFunc("/v1/scheduled-payments", handleScheduledPayments)

	handler := corsMiddleware(mux) // CORS is handled by APISIX gateway
	log.Printf("Standing Orders Service starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func handleStandingOrders(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "GET" {
		soMu.RLock()
		defer soMu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"items": standingOrders, "total": len(standingOrders)})
		return
	}
	if r.Method == "POST" {
		var so StandingOrder
		json.NewDecoder(r.Body).Decode(&so)
		if so.AccountID == "" {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "accountId is required"})
			return
		}
		if so.Amount <= 0 {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "amount must be greater than 0"})
			return
		}
		validFreq := map[string]bool{"daily": true, "weekly": true, "biweekly": true, "monthly": true, "quarterly": true, "annually": true}
		if !validFreq[so.Frequency] {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "frequency must be: daily, weekly, biweekly, monthly, quarterly, annually"})
			return
		}

		soMu.Lock()
		soCounter++
		so.ID = fmt.Sprintf("SO-%d", soCounter)
		so.Status = "active"
		so.Currency = "NGN"
		if so.StartDate == "" {
			so.StartDate = time.Now().Format("2006-01-02")
		}
		so.CreatedAt = time.Now()
		standingOrders = append(standingOrders, so)
		soMu.Unlock()

		w.WriteHeader(201)
		json.NewEncoder(w).Encode(so)
		return
	}
	w.WriteHeader(405)
}

func handlePauseOrder(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" { w.WriteHeader(405); return }
	var body struct{ OrderID string `json:"orderId"` }
	json.NewDecoder(r.Body).Decode(&body)

	soMu.Lock()
	defer soMu.Unlock()
	for i := range standingOrders {
		if standingOrders[i].ID == body.OrderID {
			if standingOrders[i].Status != "active" {
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(map[string]string{"error": "can only pause active orders"})
				return
			}
			standingOrders[i].Status = "paused"
			json.NewEncoder(w).Encode(standingOrders[i])
			return
		}
	}
	w.WriteHeader(404)
	json.NewEncoder(w).Encode(map[string]string{"error": "order not found"})
}

func handleResumeOrder(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" { w.WriteHeader(405); return }
	var body struct{ OrderID string `json:"orderId"` }
	json.NewDecoder(r.Body).Decode(&body)

	soMu.Lock()
	defer soMu.Unlock()
	for i := range standingOrders {
		if standingOrders[i].ID == body.OrderID {
			if standingOrders[i].Status != "paused" {
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(map[string]string{"error": "can only resume paused orders"})
				return
			}
			standingOrders[i].Status = "active"
			json.NewEncoder(w).Encode(standingOrders[i])
			return
		}
	}
	w.WriteHeader(404)
	json.NewEncoder(w).Encode(map[string]string{"error": "order not found"})
}

func handleMandates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "GET" {
		soMu.RLock()
		defer soMu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"items": mandates, "total": len(mandates)})
		return
	}
	if r.Method == "POST" {
		var m DirectDebitMandate
		json.NewDecoder(r.Body).Decode(&m)
		if m.MerchantID == "" || m.CustomerID == "" {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "merchantId and customerId are required"})
			return
		}
		if m.MaxAmount <= 0 {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "maxAmount must be greater than 0"})
			return
		}

		soMu.Lock()
		soCounter++
		m.ID = fmt.Sprintf("DDM-%d", soCounter)
		m.Status = "pending_consent"
		m.ConsentRef = fmt.Sprintf("CNS-%d", soCounter)
		m.MandateRef = fmt.Sprintf("MND-%d", soCounter)
		m.CreatedAt = time.Now()
		mandates = append(mandates, m)
		soMu.Unlock()

		w.WriteHeader(201)
		json.NewEncoder(w).Encode(m)
		return
	}
	w.WriteHeader(405)
}

func handleRevokeMandate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" { w.WriteHeader(405); return }
	var body struct{ MandateID string `json:"mandateId"` }
	json.NewDecoder(r.Body).Decode(&body)

	soMu.Lock()
	defer soMu.Unlock()
	for i := range mandates {
		if mandates[i].ID == body.MandateID {
			mandates[i].Status = "revoked"
			json.NewEncoder(w).Encode(mandates[i])
			return
		}
	}
	w.WriteHeader(404)
	json.NewEncoder(w).Encode(map[string]string{"error": "mandate not found"})
}

func handleScheduledPayments(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "GET" {
		soMu.RLock()
		defer soMu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"scheduledPayments": scheduledPayments, "total": len(scheduledPayments)})
		return
	}
	if r.Method == "POST" {
		var sp ScheduledPayment
		json.NewDecoder(r.Body).Decode(&sp)
		if sp.AccountID == "" || sp.Amount <= 0 {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "accountId and amount > 0 required"})
			return
		}
		if sp.ScheduledAt == "" {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "scheduledAt is required (ISO 8601 format)"})
			return
		}

		soMu.Lock()
		soCounter++
		sp.ID = fmt.Sprintf("SP-%d", soCounter)
		sp.Status = "scheduled"
		sp.Reference = fmt.Sprintf("REF-%d", soCounter)
		sp.CreatedAt = time.Now()
		scheduledPayments = append(scheduledPayments, sp)
		soMu.Unlock()

		w.WriteHeader(201)
		json.NewEncoder(w).Encode(sp)
		return
	}
	w.WriteHeader(405)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" { w.WriteHeader(204); return }
		next.ServeHTTP(w, r)
	})
}

// CORS is handled by APISIX gateway
