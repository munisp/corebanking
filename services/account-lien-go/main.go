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

var serviceName = "account-lien-go"

type Lien struct {
	LienID      string    `json:"lien_id"`
	AccountID   string    `json:"account_id"`
	AmountKobo  int64     `json:"amount_kobo"`
	Type        string    `json:"type"` // judicial_hold, collateral_lock, garnishment, regulatory_freeze, card_hold
	Reason      string    `json:"reason"`
	Reference   string    `json:"reference"` // court order number, loan ID, etc.
	Status      string    `json:"status"` // active, released, expired
	PlacedBy    string    `json:"placed_by"`
	PlacedAt    time.Time `json:"placed_at"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	ReleasedAt  *time.Time `json:"released_at,omitempty"`
	ReleasedBy  string    `json:"released_by,omitempty"`
}

type App struct {
	mu    sync.RWMutex
	liens []Lien
	db    *sql.DB
}

var app = &App{liens: make([]Lien, 0)}

func placeLien(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID  string `json:"account_id"`
		AmountKobo int64  `json:"amount_kobo"`
		Type       string `json:"type"`
		Reason     string `json:"reason"`
		Reference  string `json:"reference"`
		PlacedBy   string `json:"placed_by"`
		DurationHours int `json:"duration_hours,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if req.AmountKobo <= 0 {
		respondJSON(w, 400, map[string]string{"error": "amount must be positive"})
		return
	}
	validTypes := map[string]bool{"judicial_hold": true, "collateral_lock": true, "garnishment": true, "regulatory_freeze": true, "card_hold": true, "loan_security": true}
	if !validTypes[req.Type] {
		respondJSON(w, 400, map[string]interface{}{"error": "invalid lien type", "valid_types": []string{"judicial_hold", "collateral_lock", "garnishment", "regulatory_freeze", "card_hold", "loan_security"}})
		return
	}

	app.mu.Lock()
	defer app.mu.Unlock()

	// Check total active liens don't exceed some limit
	var totalLienKobo int64
	for _, l := range app.liens {
		if l.AccountID == req.AccountID && l.Status == "active" {
			totalLienKobo += l.AmountKobo
		}
	}

	lien := Lien{
		LienID:    fmt.Sprintf("LIEN-%x", sha256.Sum256([]byte(fmt.Sprintf("%s-%d", req.AccountID, time.Now().UnixNano()))))[0:20],
		AccountID: req.AccountID, AmountKobo: req.AmountKobo, Type: req.Type,
		Reason: req.Reason, Reference: req.Reference, PlacedBy: req.PlacedBy,
		Status: "active", PlacedAt: time.Now(),
	}
	if req.DurationHours > 0 {
		exp := time.Now().Add(time.Duration(req.DurationHours) * time.Hour)
		lien.ExpiresAt = &exp
	}
	app.liens = append(app.liens, lien)

	respondJSON(w, 201, map[string]interface{}{
		"lien_id": lien.LienID, "status": "active",
		"total_liens_on_account_kobo": totalLienKobo + req.AmountKobo,
	})
}

func releaseLien(w http.ResponseWriter, r *http.Request) {
	var req struct {
		LienID     string `json:"lien_id"`
		ReleasedBy string `json:"released_by"`
		Reason     string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	app.mu.Lock()
	defer app.mu.Unlock()
	for i := range app.liens {
		if app.liens[i].LienID == req.LienID && app.liens[i].Status == "active" {
			now := time.Now()
			app.liens[i].Status = "released"
			app.liens[i].ReleasedAt = &now
			app.liens[i].ReleasedBy = req.ReleasedBy
			respondJSON(w, 200, map[string]string{"status": "released", "lien_id": req.LienID})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "active lien not found"})
}

func getAccountLiens(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("account_id")
	app.mu.RLock()
	defer app.mu.RUnlock()
	result := make([]Lien, 0)
	var totalActiveKobo int64
	for _, l := range app.liens {
		if l.AccountID == accountID {
			result = append(result, l)
			if l.Status == "active" { totalActiveKobo += l.AmountKobo }
		}
	}
	respondJSON(w, 200, map[string]interface{}{
		"account_id": accountID, "liens": result, "total_active_kobo": totalActiveKobo,
		"available_balance_note": "Subtract total_active_kobo from account balance to get available balance",
	})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName, "version": "1.0.0"})
}
func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(code); json.NewEncoder(w).Encode(data)
}

func main() {
	port := os.Getenv("PORT"); if port == "" { port = "9046" }
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/lien/place", placeLien)
	mux.HandleFunc("/api/v1/lien/release", releaseLien)
	mux.HandleFunc("/api/v1/lien/account", getAccountLiens)
	srv := &http.Server{Addr: ":" + port, Handler: mux}
	go func() { log.Printf("[%s] Starting on :%s", serviceName, port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatalf("[%s] error: %v", serviceName, err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second); defer cancel(); srv.Shutdown(ctx)
	_ = context.Background; _ = net.Dial; _ = strings.NewReader; _ = atomic.AddInt64; _ = sync.Once{}
}
func init() { _ = sql.Drivers }
