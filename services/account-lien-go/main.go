package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

var serviceName = "account-lien-go"

type Lien struct {
	LienID     string     `json:"lien_id"`
	AccountID  string     `json:"account_id"`
	AmountKobo int64      `json:"amount_kobo"`
	Type       string     `json:"type"`
	Reason     string     `json:"reason"`
	Reference  string     `json:"reference"`
	Status     string     `json:"status"`
	PlacedBy   string     `json:"placed_by"`
	PlacedAt   time.Time  `json:"placed_at"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	ReleasedAt *time.Time `json:"released_at,omitempty"`
	ReleasedBy string     `json:"released_by,omitempty"`
}

type App struct {
	db *sql.DB
}

var app = &App{}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://localhost:5432/corebanking?sslmode=disable"
	}
	var err error
	app.db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB connection failed (will retry): %v", serviceName, err)
		return
	}
	app.db.SetMaxOpenConns(25)
	app.db.SetMaxIdleConns(5)
	app.db.SetConnMaxLifetime(5 * time.Minute)

	schema := `CREATE TABLE IF NOT EXISTS liens (
		lien_id TEXT PRIMARY KEY,
		account_id TEXT NOT NULL,
		amount_kobo BIGINT NOT NULL,
		type TEXT NOT NULL,
		reason TEXT NOT NULL DEFAULT '',
		reference TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'active',
		placed_by TEXT NOT NULL DEFAULT '',
		placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		expires_at TIMESTAMPTZ,
		released_at TIMESTAMPTZ,
		released_by TEXT NOT NULL DEFAULT ''
	);
	CREATE INDEX IF NOT EXISTS idx_liens_account ON liens(account_id);
	CREATE INDEX IF NOT EXISTS idx_liens_status ON liens(status);`
	if _, err := app.db.Exec(schema); err != nil {
		log.Printf("[%s] Schema init failed: %v", serviceName, err)
	}
	log.Printf("[%s] PostgreSQL connected, schema ready", serviceName)
}

func placeLien(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID     string `json:"account_id"`
		AmountKobo    int64  `json:"amount_kobo"`
		Type          string `json:"type"`
		Reason        string `json:"reason"`
		Reference     string `json:"reference"`
		PlacedBy      string `json:"placed_by"`
		DurationHours int    `json:"duration_hours,omitempty"`
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

	var totalLienKobo int64
	if app.db != nil {
		app.db.QueryRow(`SELECT COALESCE(SUM(amount_kobo), 0) FROM liens WHERE account_id = $1 AND status = 'active'`, req.AccountID).Scan(&totalLienKobo)
	}

	lienID := fmt.Sprintf("LIEN-%x", sha256.Sum256([]byte(fmt.Sprintf("%s-%d", req.AccountID, time.Now().UnixNano()))))[0:20]
	now := time.Now()
	var expiresAt *time.Time
	if req.DurationHours > 0 {
		exp := now.Add(time.Duration(req.DurationHours) * time.Hour)
		expiresAt = &exp
	}

	if app.db != nil {
		_, err := app.db.Exec(`INSERT INTO liens (lien_id, account_id, amount_kobo, type, reason, reference, status, placed_by, placed_at, expires_at)
			VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9)`,
			lienID, req.AccountID, req.AmountKobo, req.Type, req.Reason, req.Reference, req.PlacedBy, now, expiresAt)
		if err != nil {
			log.Printf("[%s] INSERT lien failed: %v", serviceName, err)
			respondJSON(w, 500, map[string]string{"error": "failed to persist lien"})
			return
		}
	}

	respondJSON(w, 201, map[string]interface{}{
		"lien_id": lienID, "status": "active",
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

	if app.db != nil {
		now := time.Now()
		result, err := app.db.Exec(`UPDATE liens SET status = 'released', released_at = $1, released_by = $2 WHERE lien_id = $3 AND status = 'active'`,
			now, req.ReleasedBy, req.LienID)
		if err != nil {
			respondJSON(w, 500, map[string]string{"error": "database error"})
			return
		}
		rows, _ := result.RowsAffected()
		if rows == 0 {
			respondJSON(w, 404, map[string]string{"error": "active lien not found"})
			return
		}
		respondJSON(w, 200, map[string]string{"status": "released", "lien_id": req.LienID})
		return
	}
	respondJSON(w, 503, map[string]string{"error": "database unavailable"})
}

func getAccountLiens(w http.ResponseWriter, r *http.Request) {
	accountID := r.URL.Query().Get("account_id")
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}

	rows, err := app.db.Query(`SELECT lien_id, account_id, amount_kobo, type, reason, reference, status, placed_by, placed_at, expires_at, released_at, released_by FROM liens WHERE account_id = $1 ORDER BY placed_at DESC`, accountID)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()

	result := make([]Lien, 0)
	var totalActiveKobo int64
	for rows.Next() {
		var l Lien
		if err := rows.Scan(&l.LienID, &l.AccountID, &l.AmountKobo, &l.Type, &l.Reason, &l.Reference, &l.Status, &l.PlacedBy, &l.PlacedAt, &l.ExpiresAt, &l.ReleasedAt, &l.ReleasedBy); err != nil {
			continue
		}
		result = append(result, l)
		if l.Status == "active" {
			totalActiveKobo += l.AmountKobo
		}
	}
	respondJSON(w, 200, map[string]interface{}{
		"account_id": accountID, "liens": result, "total_active_kobo": totalActiveKobo,
		"available_balance_note": "Subtract total_active_kobo from account balance to get available balance",
	})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	dbStatus := "disconnected"
	if app.db != nil {
		if err := app.db.Ping(); err == nil {
			dbStatus = "connected"
		}
	}
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName, "version": "1.0.0", "database": dbStatus})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	initDB()
	port := os.Getenv("PORT")
	if port == "" {
		port = "9046"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/lien/place", placeLien)
	mux.HandleFunc("/api/v1/lien/release", releaseLien)
	mux.HandleFunc("/api/v1/lien/account", getAccountLiens)
	srv := &http.Server{Addr: ":" + port, Handler: mux}
	go func() {
		log.Printf("[%s] Starting on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[%s] error: %v", serviceName, err)
		}
	}()
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	if app.db != nil {
		app.db.Close()
	}
	log.Printf("[%s] Shutdown complete", serviceName)
}
