package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func tenantID(r *http.Request) string {
	if v := r.Header.Get("x-tenant-id"); v != "" {
		return v
	}
	return r.URL.Query().Get("tenantId")
}

type Expense struct {
	ID          string  `json:"id"`
	Category    string  `json:"category"`
	Department  string  `json:"department"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	ApprovedBy  string  `json:"approved_by"`
	Date        string  `json:"date"`
	Status      string  `json:"status"`
}

type ExpenseService struct {
	db *pgxpool.Pool
}

func initDatabase(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS expenses (
			id TEXT NOT NULL,
			bank_id TEXT NOT NULL,
			category TEXT NOT NULL,
			department TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			amount NUMERIC(18,2) NOT NULL,
			currency TEXT NOT NULL DEFAULT 'NGN',
			approved_by TEXT NOT NULL DEFAULT '',
			date DATE NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (id, bank_id)
		);
		CREATE INDEX IF NOT EXISTS idx_expenses_bank_id ON expenses(bank_id);
	`)
	return err
}

func (s *ExpenseService) healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "expense-mgmt-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379")},
			"postgres":    map[string]interface{}{"url": os.Getenv("DATABASE_URL")},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "expense-mgmt-go"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003")},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233")},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002")},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000")},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181")},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080")},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000")},
		},
	})
}

func (s *ExpenseService) listItems(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		http.Error(w, "x-tenant-id header required", http.StatusBadRequest)
		return
	}

	rows, err := s.db.Query(r.Context(), `
		SELECT id, category, department, description, amount, currency, approved_by, date, status
		FROM expenses WHERE bank_id = $1 ORDER BY date DESC
	`, tid)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []Expense{}
	for rows.Next() {
		var e Expense
		var date time.Time
		if err := rows.Scan(&e.ID, &e.Category, &e.Department, &e.Description, &e.Amount, &e.Currency, &e.ApprovedBy, &date, &e.Status); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		e.Date = date.Format("2006-01-02")
		items = append(items, e)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"items": items, "total": len(items)})
}

func (s *ExpenseService) createItem(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		http.Error(w, "x-tenant-id header required", http.StatusBadRequest)
		return
	}

	var e Expense
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if e.ID == "" || e.Category == "" || e.Department == "" || e.Amount <= 0 {
		http.Error(w, "id, category, department, amount required", http.StatusBadRequest)
		return
	}
	if e.Currency == "" {
		e.Currency = "NGN"
	}
	if e.Status == "" {
		e.Status = "pending"
	}
	if e.Date == "" {
		e.Date = time.Now().Format("2006-01-02")
	}

	_, err := s.db.Exec(r.Context(), `
		INSERT INTO expenses (id, bank_id, category, department, description, amount, currency, approved_by, date, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, e.ID, tid, e.Category, e.Department, e.Description, e.Amount, e.Currency, e.ApprovedBy, e.Date, e.Status)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(e)
}

func (s *ExpenseService) getStats(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		http.Error(w, "x-tenant-id header required", http.StatusBadRequest)
		return
	}

	var total int
	var totalAmount float64
	if err := s.db.QueryRow(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM expenses WHERE bank_id = $1
	`, tid).Scan(&total, &totalAmount); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"total_expenses": total, "total_amount": totalAmount})
}

func main() {
	godotenv.Load()
	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := initDatabase(ctx, db); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	svc := &ExpenseService{db: db}

	http.HandleFunc("/healthz", svc.healthz)
	http.HandleFunc("/v1/expense-mgmt-go/list", svc.listItems)
	http.HandleFunc("/v1/expense-mgmt-go/stats", svc.getStats)
	http.HandleFunc("/v1/expense-mgmt-go", svc.createItem)

	port := envOr("PORT", "8192")
	fmt.Printf("Expense Management Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
