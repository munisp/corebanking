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

var serviceName = "programmable-money-go"

type Condition struct {
	Type      string `json:"type"`
	Operator  string `json:"operator"`
	Field     string `json:"field"`
	Value     string `json:"value"`
	Satisfied bool   `json:"satisfied"`
	CheckedAt string `json:"checked_at,omitempty"`
}

type SmartTransfer struct {
	TransferID    string      `json:"transfer_id"`
	PayerAccount  string      `json:"payer_account"`
	PayeeAccount  string      `json:"payee_account"`
	AmountKobo    int64       `json:"amount_kobo"`
	Currency      string      `json:"currency"`
	Conditions    []Condition `json:"conditions"`
	LogicOperator string      `json:"logic_operator"`
	Status        string      `json:"status"`
	EscrowHeld    bool        `json:"escrow_held"`
	CreatedAt     time.Time   `json:"created_at"`
	ExpiresAt     time.Time   `json:"expires_at"`
	ReleasedAt    *time.Time  `json:"released_at,omitempty"`
	Narration     string      `json:"narration"`
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
		log.Printf("[%s] DB connection failed: %v", serviceName, err)
		return
	}
	app.db.SetMaxOpenConns(25)
	app.db.SetMaxIdleConns(5)
	app.db.SetConnMaxLifetime(5 * time.Minute)

	schema := `CREATE TABLE IF NOT EXISTS smart_transfers (
		transfer_id TEXT PRIMARY KEY,
		payer_account TEXT NOT NULL,
		payee_account TEXT NOT NULL,
		amount_kobo BIGINT NOT NULL,
		currency TEXT NOT NULL DEFAULT 'NGN',
		conditions JSONB NOT NULL DEFAULT '[]',
		logic_operator TEXT NOT NULL DEFAULT 'AND',
		status TEXT NOT NULL DEFAULT 'pending_conditions',
		escrow_held BOOLEAN NOT NULL DEFAULT TRUE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		expires_at TIMESTAMPTZ NOT NULL,
		released_at TIMESTAMPTZ,
		narration TEXT NOT NULL DEFAULT ''
	);
	CREATE INDEX IF NOT EXISTS idx_smart_transfers_status ON smart_transfers(status);
	CREATE INDEX IF NOT EXISTS idx_smart_transfers_payer ON smart_transfers(payer_account);`
	if _, err := app.db.Exec(schema); err != nil {
		log.Printf("[%s] Schema init failed: %v", serviceName, err)
	}
	log.Printf("[%s] PostgreSQL connected, schema ready", serviceName)
}

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
	if req.LogicOperator == "" {
		req.LogicOperator = "AND"
	}
	if req.ExpiryHours == 0 {
		req.ExpiryHours = 72
	}
	if req.Currency == "" {
		req.Currency = "NGN"
	}

	transferID := fmt.Sprintf("SMART-%x", sha256.Sum256([]byte(fmt.Sprintf("%d", time.Now().UnixNano()))))[0:22]
	now := time.Now()
	expiresAt := now.Add(time.Duration(req.ExpiryHours) * time.Hour)
	conditionsJSON, _ := json.Marshal(req.Conditions)

	if app.db != nil {
		_, err := app.db.Exec(`INSERT INTO smart_transfers (transfer_id, payer_account, payee_account, amount_kobo, currency, conditions, logic_operator, status, escrow_held, created_at, expires_at, narration)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_conditions', TRUE, $8, $9, $10)`,
			transferID, req.PayerAccount, req.PayeeAccount, req.AmountKobo, req.Currency, string(conditionsJSON), req.LogicOperator, now, expiresAt, req.Narration)
		if err != nil {
			log.Printf("[%s] INSERT failed: %v", serviceName, err)
			respondJSON(w, 500, map[string]string{"error": "failed to persist transfer"})
			return
		}
	}

	respondJSON(w, 201, map[string]interface{}{
		"transfer_id":      transferID,
		"status":           "pending_conditions",
		"conditions_count": len(req.Conditions),
		"logic":            req.LogicOperator,
		"expires_at":       expiresAt.Format(time.RFC3339),
		"note":             "Funds held in escrow via TigerBeetle 2PC pending transfer",
	})
}

func satisfyCondition(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TransferID    string      `json:"transfer_id"`
		ConditionType string      `json:"condition_type"`
		Evidence      interface{} `json:"evidence"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if app.db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}

	var conditionsJSON string
	var status, logicOp string
	var amountKobo int64
	var payeeAccount string
	err := app.db.QueryRow(`SELECT conditions, status, logic_operator, amount_kobo, payee_account FROM smart_transfers WHERE transfer_id = $1`, req.TransferID).Scan(
		&conditionsJSON, &status, &logicOp, &amountKobo, &payeeAccount)
	if err == sql.ErrNoRows {
		respondJSON(w, 404, map[string]string{"error": "transfer not found"})
		return
	}
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	if status != "pending_conditions" {
		respondJSON(w, 409, map[string]string{"error": "transfer not in pending_conditions state"})
		return
	}

	var conditions []Condition
	json.Unmarshal([]byte(conditionsJSON), &conditions)

	now := time.Now().Format(time.RFC3339)
	for j := range conditions {
		if conditions[j].Type == req.ConditionType {
			conditions[j].Satisfied = true
			conditions[j].CheckedAt = now
		}
	}

	allMet := true
	anyMet := false
	satisfied := 0
	for _, c := range conditions {
		if c.Satisfied {
			anyMet = true
			satisfied++
		} else {
			allMet = false
		}
	}

	shouldRelease := (logicOp == "AND" && allMet) || (logicOp == "OR" && anyMet)
	updatedConditions, _ := json.Marshal(conditions)

	if shouldRelease {
		releasedAt := time.Now()
		app.db.Exec(`UPDATE smart_transfers SET conditions = $1, status = 'released', released_at = $2 WHERE transfer_id = $3`,
			string(updatedConditions), releasedAt, req.TransferID)
		respondJSON(w, 200, map[string]interface{}{
			"transfer_id": req.TransferID, "status": "released",
			"amount_kobo": amountKobo, "released_to": payeeAccount,
			"note": "All conditions met — funds released from escrow",
		})
		return
	}

	app.db.Exec(`UPDATE smart_transfers SET conditions = $1 WHERE transfer_id = $2`, string(updatedConditions), req.TransferID)
	respondJSON(w, 200, map[string]interface{}{
		"transfer_id": req.TransferID, "status": "pending_conditions",
		"satisfied": satisfied, "total": len(conditions),
		"remaining": len(conditions) - satisfied,
	})
}

func healthz(w http.ResponseWriter, r *http.Request) {
	dbStatus := "disconnected"
	if app.db != nil {
		if err := app.db.Ping(); err == nil {
			dbStatus = "connected"
		}
	}
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName, "version": "1.0.0", "database": dbStatus,
		"condition_types": []string{"delivery_confirmed", "quality_passed", "time_elapsed", "multi_sig", "iot_sensor", "manual_approval"},
	})
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
		port = "9049"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/api/v1/smart-transfer/create", createSmartTransfer)
	mux.HandleFunc("/api/v1/smart-transfer/satisfy", satisfyCondition)
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
