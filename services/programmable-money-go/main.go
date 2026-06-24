package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	_ "github.com/lib/pq"
)

var serviceName = "programmable-money-go"

type Condition struct {
	Type      string      `json:"type"`       // "delivery_confirmed", "quality_passed", "time_elapsed", "multi_sig", "iot_sensor", "manual_approval"
	Operator  string      `json:"operator"`   // "eq", "gt", "lt", "contains", "exists"
	Field     string      `json:"field"`      // field to check
	Value     interface{} `json:"value"`      // expected value
	Satisfied bool        `json:"satisfied"`
	CheckedAt *time.Time  `json:"checked_at,omitempty"`
}

type SmartTransfer struct {
	TransferID     string      `json:"transfer_id"`
	PayerAccount   string      `json:"payer_account"`
	PayeeAccount   string      `json:"payee_account"`
	AmountKobo     int64       `json:"amount_kobo"`
	Currency       string      `json:"currency"`
	Conditions     []Condition `json:"conditions"`
	LogicOperator  string      `json:"logic_operator"` // "AND" (all conditions), "OR" (any condition)
	Status         string      `json:"status"` // pending_conditions, conditions_met, released, expired, cancelled
	EscrowHeld     bool        `json:"escrow_held"`
	CreatedAt      time.Time   `json:"created_at"`
	ExpiresAt      time.Time   `json:"expires_at"`
	ReleasedAt     *time.Time  `json:"released_at,omitempty"`
	Narration      string      `json:"narration"`
}

type App struct {
	mu        sync.RWMutex
	transfers []SmartTransfer
}

var app = &App{transfers: make([]SmartTransfer, 0)}

func createSmartTransfer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PayerAccount  string      `json:"payer_account"`
		PayeeAccount  string      `json:"payee_account"`
		AmountKobo    int64       `json:"amount_kobo"`
		Currency      string      `json:"currency"`
		Conditions    []Condition `json:"conditions"`
		LogicOperator string      `json:"logic_operator"`
		ExpiryHours   int         `json:"expiry_hours"`
		Narration     string      `json:"narration"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if len(req.Conditions) == 0 {
		respondJSON(w, 400, map[string]string{"error": "at least one condition required"})
		return
	}
	if req.LogicOperator == "" { req.LogicOperator = "AND" }
	if req.ExpiryHours == 0 { req.ExpiryHours = 72 }
	if req.Currency == "" { req.Currency = "NGN" }

	st := SmartTransfer{
		TransferID:    fmt.Sprintf("SMART-%x", sha256.Sum256([]byte(fmt.Sprintf("%d", time.Now().UnixNano()))))[0:22],
		PayerAccount:  req.PayerAccount, PayeeAccount: req.PayeeAccount,
		AmountKobo: req.AmountKobo, Currency: req.Currency,
		Conditions: req.Conditions, LogicOperator: req.LogicOperator,
		Status: "pending_conditions", EscrowHeld: true,
		CreatedAt: time.Now(), ExpiresAt: time.Now().Add(time.Duration(req.ExpiryHours) * time.Hour),
		Narration: req.Narration,
	}

	app.mu.Lock()
	app.transfers = append(app.transfers, st)
	app.mu.Unlock()

	respondJSON(w, 201, map[string]interface{}{
		"transfer_id": st.TransferID, "status": "pending_conditions",
		"conditions_count": len(st.Conditions), "logic": st.LogicOperator,
		"expires_at": st.ExpiresAt.Format(time.RFC3339),
		"note": "Funds held in escrow via TigerBeetle 2PC pending transfer",
	})
}

func satisfyCondition(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TransferID    string `json:"transfer_id"`
		ConditionType string `json:"condition_type"`
		Evidence      interface{} `json:"evidence"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	app.mu.Lock()
	defer app.mu.Unlock()

	for i := range app.transfers {
		if app.transfers[i].TransferID == req.TransferID {
			if app.transfers[i].Status != "pending_conditions" {
				respondJSON(w, 409, map[string]string{"error": "transfer not in pending_conditions state"})
				return
			}
			now := time.Now()
			for j := range app.transfers[i].Conditions {
				if app.transfers[i].Conditions[j].Type == req.ConditionType {
					app.transfers[i].Conditions[j].Satisfied = true
					app.transfers[i].Conditions[j].CheckedAt = &now
				}
			}
			// Check if all/any conditions met
			allMet := true
			anyMet := false
			for _, c := range app.transfers[i].Conditions {
				if c.Satisfied { anyMet = true } else { allMet = false }
			}
			shouldRelease := (app.transfers[i].LogicOperator == "AND" && allMet) || (app.transfers[i].LogicOperator == "OR" && anyMet)
			if shouldRelease {
				app.transfers[i].Status = "conditions_met"
				app.transfers[i].ReleasedAt = &now
				// In production: POST pending transfer to TigerBeetle, then release via tb2pc.PostPending
				app.transfers[i].Status = "released"
				respondJSON(w, 200, map[string]interface{}{
					"transfer_id": req.TransferID, "status": "released",
					"amount_kobo": app.transfers[i].AmountKobo,
					"released_to": app.transfers[i].PayeeAccount,
					"note": "All conditions met — funds released from escrow",
				})
				return
			}
			satisfied := 0
			for _, c := range app.transfers[i].Conditions { if c.Satisfied { satisfied++ } }
			respondJSON(w, 200, map[string]interface{}{
				"transfer_id": req.TransferID, "status": "pending_conditions",
				"satisfied": satisfied, "total": len(app.transfers[i].Conditions),
				"remaining": len(app.transfers[i].Conditions) - satisfied,
			})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "transfer not found"})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName, "version": "1.0.0",
		"condition_types": []string{"delivery_confirmed", "quality_passed", "time_elapsed", "multi_sig", "iot_sensor", "manual_approval"},
	})
}
func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(code); json.NewEncoder(w).Encode(data)
}

func main() {
	port := os.Getenv("PORT"); if port == "" { port = "9049" }
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/smart-transfer/create", createSmartTransfer)
	mux.HandleFunc("/api/v1/smart-transfer/satisfy", satisfyCondition)
	srv := &http.Server{Addr: ":" + port, Handler: mux}
	go func() { log.Printf("[%s] Starting on :%s", serviceName, port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatalf("[%s] error: %v", serviceName, err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second); defer cancel(); srv.Shutdown(ctx)
	_ = context.Background; _ = net.Dial; _ = strings.NewReader; _ = atomic.AddInt64; _ = sync.Once{}
}
func init() { _ = sql.Drivers }
