package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// B1: Teller Operations Enhancements
// - Cash reconciliation, till limits, reversals, queue management, receipts, multi-currency

type TillLimit struct {
	Currency   string  `json:"currency"`
	MinBalance float64 `json:"minBalance"`
	MaxBalance float64 `json:"maxBalance"`
	AlertAt    float64 `json:"alertThreshold"` // Alert when balance exceeds this
}

type CashReconciliation struct {
	ID            string    `json:"id"`
	SessionID     string    `json:"sessionId"`
	TellerID      string    `json:"tellerId"`
	ExpectedCash  float64   `json:"expectedCash"`
	ActualCash    float64   `json:"actualCash"`
	Difference    float64   `json:"difference"`
	Status        string    `json:"status"` // balanced, short, over
	Notes         string    `json:"notes"`
	ReconciledAt  time.Time `json:"reconciledAt"`
	ApprovedBy    string    `json:"approvedBy,omitempty"`
}

type TransactionReversal struct {
	ID            string    `json:"id"`
	OriginalTxnID string   `json:"originalTransactionId"`
	SessionID     string    `json:"sessionId"`
	Amount        float64   `json:"amount"`
	Reason        string    `json:"reason"`
	Status        string    `json:"status"` // pending, approved, completed, rejected
	RequestedBy   string    `json:"requestedBy"`
	ApprovedBy    string    `json:"approvedBy,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
}

type QueueTicket struct {
	ID          string    `json:"id"`
	CustomerID  string    `json:"customerId"`
	ServiceType string    `json:"serviceType"` // deposit, withdrawal, transfer, inquiry
	Priority    int       `json:"priority"`     // 1=VIP, 2=Priority, 3=Regular
	Status      string    `json:"status"`       // waiting, serving, completed, no_show
	WindowNum   int       `json:"windowNumber,omitempty"`
	WaitTime    int       `json:"waitTimeMinutes"`
	CreatedAt   time.Time `json:"createdAt"`
}

type Receipt struct {
	ID            string    `json:"id"`
	TransactionID string    `json:"transactionId"`
	SessionID     string    `json:"sessionId"`
	CustomerName  string    `json:"customerName"`
	AccountNumber string    `json:"accountNumber"`
	Type          string    `json:"type"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	BranchName    string    `json:"branchName"`
	TellerName    string    `json:"tellerName"`
	PrintedAt     time.Time `json:"printedAt"`
}

var (
	reconMu       sync.RWMutex
	reconciliations []CashReconciliation
	reversals     []TransactionReversal
	queue         []QueueTicket
	receipts      []Receipt
	tillLimits    = map[string]TillLimit{
		"NGN": {Currency: "NGN", MinBalance: 50000, MaxBalance: 5000000, AlertAt: 4000000},
		"USD": {Currency: "USD", MinBalance: 100, MaxBalance: 50000, AlertAt: 40000},
		"GBP": {Currency: "GBP", MinBalance: 100, MaxBalance: 30000, AlertAt: 25000},
		"EUR": {Currency: "EUR", MinBalance: 100, MaxBalance: 30000, AlertAt: 25000},
	}
	queueSeq     int
	chequeBooks  []ChequeBook
	chequeLeaves []ChequeLeaf
)

type ChequeBook struct {
	ID           string    `json:"id"`
	AccountID    string    `json:"accountId"`
	CustomerName string    `json:"customerName"`
	SeriesStart  string    `json:"seriesStart"`
	SeriesEnd    string    `json:"seriesEnd"`
	LeafCount    int       `json:"leafCount"`
	Status       string    `json:"status"` // requested, printed, dispatched, collected, exhausted
	RequestedAt  time.Time `json:"requestedAt"`
	CollectedAt  *time.Time `json:"collectedAt,omitempty"`
}

type ChequeLeaf struct {
	ID           string    `json:"id"`
	ChequeBookID string    `json:"chequeBookId"`
	ChequeNumber string    `json:"chequeNumber"`
	Amount       float64   `json:"amount"`
	Payee        string    `json:"payee"`
	Status       string    `json:"status"` // unused, presented, cleared, returned, stopped
	PresentedAt  *time.Time `json:"presentedAt,omitempty"`
	ClearedAt    *time.Time `json:"clearedAt,omitempty"`
	ReturnReason string    `json:"returnReason,omitempty"`
}

func RegisterEnhancedRoutes(mux *http.ServeMux) {
	// Cash Reconciliation
	mux.HandleFunc("/v1/teller/reconciliation", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var req CashReconciliation
			json.NewDecoder(r.Body).Decode(&req)
			req.ID = fmt.Sprintf("RECON-%d", time.Now().UnixNano())
			req.Difference = req.ActualCash - req.ExpectedCash
			if req.Difference == 0 {
				req.Status = "balanced"
			} else if req.Difference < 0 {
				req.Status = "short"
			} else {
				req.Status = "over"
			}
			req.ReconciledAt = time.Now()
			reconMu.Lock()
			reconciliations = append(reconciliations, req)
			reconMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(req)
			return
		}
		reconMu.RLock()
		defer reconMu.RUnlock()
		json.NewEncoder(w).Encode(reconciliations)
	})

	// Transaction Reversals
	mux.HandleFunc("/v1/teller/reversals", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var req TransactionReversal
			json.NewDecoder(r.Body).Decode(&req)
			if req.OriginalTxnID == "" {
				http.Error(w, `{"error":"originalTransactionId is required"}`, 400)
				return
			}
			if req.Reason == "" {
				http.Error(w, `{"error":"reason is required for reversal"}`, 400)
				return
			}
			req.ID = fmt.Sprintf("REV-%d", time.Now().UnixNano())
			req.Status = "pending"
			req.CreatedAt = time.Now()
			reconMu.Lock()
			reversals = append(reversals, req)
			reconMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(req)
			return
		}
		reconMu.RLock()
		defer reconMu.RUnlock()
		json.NewEncoder(w).Encode(reversals)
	})

	// Queue Management
	mux.HandleFunc("/v1/teller/queue", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var req QueueTicket
			json.NewDecoder(r.Body).Decode(&req)
			reconMu.Lock()
			queueSeq++
			req.ID = fmt.Sprintf("Q-%04d", queueSeq)
			req.Status = "waiting"
			if req.Priority == 0 {
				req.Priority = 3
			}
			req.CreatedAt = time.Now()
			queue = append(queue, req)
			reconMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(req)
			return
		}
		reconMu.RLock()
		defer reconMu.RUnlock()
		// Return only waiting tickets
		var waiting []QueueTicket
		for _, t := range queue {
			if t.Status == "waiting" {
				t.WaitTime = int(time.Since(t.CreatedAt).Minutes())
				waiting = append(waiting, t)
			}
		}
		json.NewEncoder(w).Encode(waiting)
	})

	// Till Limits
	mux.HandleFunc("/v1/teller/till-limits", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(tillLimits)
	})

	// Receipts
	mux.HandleFunc("/v1/teller/receipts", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var req Receipt
			json.NewDecoder(r.Body).Decode(&req)
			req.ID = fmt.Sprintf("RCT-%d", time.Now().UnixNano())
			req.PrintedAt = time.Now()
			reconMu.Lock()
			receipts = append(receipts, req)
			reconMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(req)
			return
		}
		reconMu.RLock()
		defer reconMu.RUnlock()
		json.NewEncoder(w).Encode(receipts)
	})

	// Cheque Book Requests
	mux.HandleFunc("/v1/teller/cheque-books", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var req ChequeBook
			json.NewDecoder(r.Body).Decode(&req)
			if req.AccountID == "" {
				http.Error(w, `{"error":"accountId is required"}`, 400)
				return
			}
			if req.LeafCount != 25 && req.LeafCount != 50 && req.LeafCount != 100 {
				http.Error(w, `{"error":"leafCount must be 25, 50, or 100"}`, 400)
				return
			}
			reconMu.Lock()
			queueSeq++
			req.ID = fmt.Sprintf("CHQ-%d", time.Now().UnixNano())
			req.SeriesStart = fmt.Sprintf("%08d", queueSeq*100)
			req.SeriesEnd = fmt.Sprintf("%08d", queueSeq*100+req.LeafCount-1)
			req.Status = "requested"
			req.RequestedAt = time.Now()
			chequeBooks = append(chequeBooks, req)
			reconMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(req)
			return
		}
		reconMu.RLock()
		defer reconMu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"chequeBooks": chequeBooks, "total": len(chequeBooks)})
	})

	// Cheque Clearance
	mux.HandleFunc("/v1/teller/cheque-clearance", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var req ChequeLeaf
			json.NewDecoder(r.Body).Decode(&req)
			if req.ChequeNumber == "" {
				http.Error(w, `{"error":"chequeNumber is required"}`, 400)
				return
			}
			if req.Amount <= 0 {
				http.Error(w, `{"error":"amount must be greater than 0"}`, 400)
				return
			}
			reconMu.Lock()
			now := time.Now()
			req.ID = fmt.Sprintf("CLR-%d", now.UnixNano())
			req.Status = "presented"
			req.PresentedAt = &now
			chequeLeaves = append(chequeLeaves, req)
			reconMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(req)
			return
		}
		reconMu.RLock()
		defer reconMu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"cheques": chequeLeaves, "total": len(chequeLeaves)})
	})
}
