package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
)

type POSTerminal struct {
	ID              string  `json:"id"`
	TerminalID      string  `json:"terminalId"`
	MerchantName    string  `json:"merchantName"`
	MerchantID      string  `json:"merchantId"`
	Location        string  `json:"location"`
	State           string  `json:"state"`
	Category        string  `json:"category"`
	Model           string  `json:"model"`
	Status          string  `json:"status"`
	DailyTxnCount   int     `json:"dailyTransactionCount"`
	DailyVolume     float64 `json:"dailyVolume"`
	MonthlyVolume   float64 `json:"monthlyVolume"`
	LastTransaction string  `json:"lastTransaction"`
	CommissionRate  float64 `json:"commissionRate"`
	DeployedDate    string  `json:"deployedDate"`
}

type POSTransaction struct {
	ID           string  `json:"id"`
	TerminalID   string  `json:"terminalId"`
	MerchantName string  `json:"merchantName"`
	Type         string  `json:"type"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	CardScheme   string  `json:"cardScheme"`
	ResponseCode string  `json:"responseCode"`
	RRN          string  `json:"rrn"`
	Timestamp    string  `json:"timestamp"`
	Status       string  `json:"status"`
}

var (
	mu           sync.Mutex
	terminals    []POSTerminal
	transactions []POSTransaction
)

func init() {
	terminals = []POSTerminal{}
	transactions = []POSTransaction{}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// CORS middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		// Allow frontend origins
		w.Header().Set("Access-Control-Allow-Origin", "*")

		// Allowed methods
		w.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, PATCH, DELETE, OPTIONS",
		)

		// Allowed headers
		w.Header().Set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization",
		)

		// Handle preflight request
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	mux := http.NewServeMux()

	// Health endpoint
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "ok",
			"service": "pos-terminal-management",
		})
	})

	// Terminals — GET list / POST create
	mux.HandleFunc("/v1/pos/terminals", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			mu.Lock()
			defer mu.Unlock()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"items": terminals,
				"total": len(terminals),
			})

		case http.MethodPost:
			var t POSTerminal
			if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
				http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
				return
			}
			if t.TerminalID == "" || t.MerchantName == "" || t.MerchantID == "" {
				http.Error(w, `{"error":"terminalId, merchantName and merchantId are required"}`, http.StatusBadRequest)
				return
			}
			if t.Status == "" {
				t.Status = "active"
			}
			t.ID = fmt.Sprintf("POS-%04d", len(terminals)+1)
			mu.Lock()
			terminals = append(terminals, t)
			mu.Unlock()
			respondJSON(w, http.StatusCreated, t)

		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	})

	// Transactions — GET list / POST create
	mux.HandleFunc("/v1/pos/transactions", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			mu.Lock()
			defer mu.Unlock()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"items": transactions,
				"total": len(transactions),
			})

		case http.MethodPost:
			var tx POSTransaction
			if err := json.NewDecoder(r.Body).Decode(&tx); err != nil {
				http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
				return
			}
			if tx.TerminalID == "" || tx.Amount <= 0 || tx.Type == "" {
				http.Error(w, `{"error":"terminalId, type and amount are required"}`, http.StatusBadRequest)
				return
			}
			if tx.Currency == "" {
				tx.Currency = "NGN"
			}
			if tx.Status == "" {
				tx.Status = "pending"
			}
			tx.ID = fmt.Sprintf("PTX-%04d", len(transactions)+1)
			mu.Lock()
			transactions = append(transactions, tx)
			mu.Unlock()
			respondJSON(w, http.StatusCreated, tx)

		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	})

	// Stats endpoint
	mux.HandleFunc("/v1/pos/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()

		byCategory := map[string]int{}
		byStatus := map[string]int{}
		totalVolume := 0.0
		totalTxns := 0

		for _, t := range terminals {
			byCategory[t.Category]++
			byStatus[t.Status]++
			totalVolume += t.DailyVolume
			totalTxns += t.DailyTxnCount
		}

		approvedTxns := 0
		declinedTxns := 0

		for _, tx := range transactions {
			if tx.Status == "approved" {
				approvedTxns++
			} else {
				declinedTxns++
			}
		}

		mu.Unlock()

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"totalTerminals":    len(terminals),
			"dailyTransactions": totalTxns,
			"dailyVolume":       totalVolume,
			"approvedTxns":      approvedTxns,
			"declinedTxns":      declinedTxns,
			"byCategory":        byCategory,
			"byStatus":          byStatus,
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "9297"
	}
	addr := ":" + port

	fmt.Printf("pos-terminal-management listening on %s\n", addr)

	// Wrap mux with CORS middleware
	handler := corsMiddleware(mux)

	if err := http.ListenAndServe(addr, handler); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
