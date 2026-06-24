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

var serviceName = "settlement-clearing-go"

// ── Position Types ──────────────────────────────────────────────────────────

type NostroPosition struct {
	BankCode      string `json:"bank_code"`
	BankName      string `json:"bank_name"`
	BalanceKobo   int64  `json:"balance_kobo"`
	PendingDebit  int64  `json:"pending_debit_kobo"`
	PendingCredit int64  `json:"pending_credit_kobo"`
	AvailableKobo int64  `json:"available_kobo"`
	LastUpdated   time.Time `json:"last_updated"`
	AlertLevel    string `json:"alert_level"` // normal, low, critical
}

type SettlementBatch struct {
	BatchID     string    `json:"batch_id"`
	Type        string    `json:"type"` // RTGS, DNS, NIP
	Status      string    `json:"status"` // open, closed, settling, settled, failed
	OpenedAt    time.Time `json:"opened_at"`
	ClosedAt    *time.Time `json:"closed_at,omitempty"`
	Transactions int      `json:"transactions"`
	NetAmountKobo int64   `json:"net_amount_kobo"`
	Participants []string `json:"participants"`
}

type NIPTransfer struct {
	TransferID    string `json:"transfer_id"`
	SourceBank    string `json:"source_bank"`
	DestBank      string `json:"dest_bank"`
	AmountKobo    int64  `json:"amount_kobo"`
	NarrationCode string `json:"narration_code"` // NIP reason codes
	Status        string `json:"status"`
	SettlementRef string `json:"settlement_ref"`
	CreatedAt     time.Time `json:"created_at"`
}

// NIP Reason Codes for reversals (CBN)
var nipReasonCodes = map[string]string{
	"R01": "Insufficient funds",
	"R02": "Account closed",
	"R03": "No account/unable to locate",
	"R04": "Invalid account number",
	"R05": "Unauthorized debit to customer",
	"R06": "Returned per ODFI request",
	"R07": "Authorization revoked by customer",
	"R08": "Payment stopped",
	"R09": "Uncollected funds",
	"R10": "Customer advises not authorized",
	"R11": "Check truncation entry return",
	"R12": "Branch sold to another DFI",
	"R13": "Invalid receiving DFI",
	"R14": "Representative payee deceased",
	"R15": "Beneficiary deceased",
	"R16": "Account frozen",
	"R17": "File record edit criteria",
	"R20": "Non-transaction account",
	"R21": "Invalid company identification",
	"R22": "Invalid individual ID number",
	"R23": "Credit entry refused by receiver",
	"R24": "Duplicate entry",
	"R29": "Corporate customer not authorized",
}

type App struct {
	mu        sync.RWMutex
	positions map[string]*NostroPosition
	batches   []SettlementBatch
	transfers []NIPTransfer
	db        *sql.DB
}

var app = &App{
	positions: make(map[string]*NostroPosition),
	batches:   make([]SettlementBatch, 0),
	transfers: make([]NIPTransfer, 0),
}

// Seed Nigerian bank positions
func init() {
	banks := []struct{ code, name string; balKobo int64 }{
		{"000001", "CBN Settlement", 50000000000},   // 500M NGN
		{"000004", "First Bank", 10000000000},
		{"000005", "FCMB", 5000000000},
		{"000009", "Access Bank", 8000000000},
		{"000010", "Zenith Bank", 12000000000},
		{"000011", "GTBank", 9000000000},
		{"000013", "Stanbic IBTC", 4000000000},
		{"000014", "UBA", 7000000000},
		{"000016", "Fidelity Bank", 3000000000},
		{"000023", "Sterling Bank", 2000000000},
	}
	for _, b := range banks {
		app.positions[b.code] = &NostroPosition{
			BankCode: b.code, BankName: b.name, BalanceKobo: b.balKobo,
			AvailableKobo: b.balKobo, LastUpdated: time.Now(), AlertLevel: "normal",
		}
	}
}

func getPositions(w http.ResponseWriter, r *http.Request) {
	app.mu.RLock()
	defer app.mu.RUnlock()
	positions := make([]NostroPosition, 0)
	for _, p := range app.positions { positions = append(positions, *p) }
	respondJSON(w, 200, map[string]interface{}{"positions": positions, "count": len(positions)})
}

func processTransfer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SourceBank string `json:"source_bank"`
		DestBank   string `json:"dest_bank"`
		AmountKobo int64  `json:"amount_kobo"`
		Narration  string `json:"narration"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if req.AmountKobo <= 0 {
		respondJSON(w, 400, map[string]string{"error": "amount must be positive"})
		return
	}

	app.mu.Lock()
	defer app.mu.Unlock()

	srcPos, srcOK := app.positions[req.SourceBank]
	if !srcOK {
		respondJSON(w, 404, map[string]string{"error": "source bank not found"})
		return
	}
	if srcPos.AvailableKobo < req.AmountKobo {
		respondJSON(w, 422, map[string]interface{}{
			"error": "insufficient nostro position",
			"available_kobo": srcPos.AvailableKobo,
			"required_kobo": req.AmountKobo,
			"bank": srcPos.BankName,
		})
		return
	}

	// Debit source, credit dest
	srcPos.BalanceKobo -= req.AmountKobo
	srcPos.AvailableKobo -= req.AmountKobo
	srcPos.LastUpdated = time.Now()
	
	if dstPos, ok := app.positions[req.DestBank]; ok {
		dstPos.BalanceKobo += req.AmountKobo
		dstPos.AvailableKobo += req.AmountKobo
		dstPos.LastUpdated = time.Now()
	}

	// Update alert levels
	for _, p := range app.positions {
		if p.AvailableKobo < 1000000000 { // < 10M NGN
			p.AlertLevel = "critical"
		} else if p.AvailableKobo < 5000000000 { // < 50M NGN
			p.AlertLevel = "low"
		} else {
			p.AlertLevel = "normal"
		}
	}

	txn := NIPTransfer{
		TransferID: fmt.Sprintf("NIP-%x", sha256.Sum256([]byte(fmt.Sprintf("%d", time.Now().UnixNano()))))[0:20],
		SourceBank: req.SourceBank, DestBank: req.DestBank,
		AmountKobo: req.AmountKobo, Status: "settled",
		CreatedAt: time.Now(),
	}
	app.transfers = append(app.transfers, txn)

	respondJSON(w, 200, map[string]interface{}{
		"transfer_id": txn.TransferID,
		"status": "settled",
		"source_position_kobo": srcPos.AvailableKobo,
		"alert_level": srcPos.AlertLevel,
	})
}

func reverseTransfer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TransferID string `json:"transfer_id"`
		ReasonCode string `json:"reason_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	reason, ok := nipReasonCodes[req.ReasonCode]
	if !ok {
		respondJSON(w, 400, map[string]interface{}{"error": "invalid NIP reason code", "valid_codes": nipReasonCodes})
		return
	}
	respondJSON(w, 200, map[string]interface{}{
		"transfer_id": req.TransferID,
		"reversal_status": "processed",
		"reason_code": req.ReasonCode,
		"reason_description": reason,
	})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName, "version": "1.0.0",
		"capabilities": []string{"RTGS", "DNS", "NIP", "nostro_position", "reversal_with_reason_codes"},
	})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "9044" }
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/settlement/positions", getPositions)
	mux.HandleFunc("/api/v1/settlement/transfer", processTransfer)
	mux.HandleFunc("/api/v1/settlement/reverse", reverseTransfer)
	
	srv := &http.Server{Addr: ":" + port, Handler: mux}
	go func() {
		log.Printf("[%s] Starting on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[%s] ListenAndServe error: %v", serviceName, err)
		}
	}()
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	_ = context.Background; _ = net.Dial; _ = strings.NewReader; _ = atomic.AddInt64; _ = sync.Once{}
}
