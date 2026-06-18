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

type SalaryBatch struct {
	ID            string  `json:"id"`
	CompanyName   string  `json:"companyName"`
	CompanyID     string  `json:"companyId"`
	PayrollMonth  string  `json:"payrollMonth"`
	EmployeeCount int     `json:"employeeCount"`
	GrossPay      float64 `json:"grossPay"`
	Deductions    float64 `json:"deductions"`
	NetPay        float64 `json:"netPay"`
	Tax           float64 `json:"tax"`
	Pension       float64 `json:"pension"`
	NHF           float64 `json:"nhf"`
	Currency      string  `json:"currency"`
	Status        string  `json:"status"`
	SubmittedAt   string  `json:"submittedAt"`
	ProcessedAt   string  `json:"processedAt,omitempty"`
	ValueDate     string  `json:"valueDate"`
	FailedCount   int     `json:"failedCount"`
	SuccessCount  int     `json:"successCount"`
}

type SalaryInstruction struct {
	ID           string  `json:"id"`
	BatchID      string  `json:"batchId"`
	EmployeeName string  `json:"employeeName"`
	AccountNo    string  `json:"accountNo"`
	BankCode     string  `json:"bankCode"`
	GrossPay     float64 `json:"grossPay"`
	NetPay       float64 `json:"netPay"`
	Tax          float64 `json:"tax"`
	Pension      float64 `json:"pension"`
	Status       string  `json:"status"`
	FailReason   string  `json:"failReason,omitempty"`
}

type SalaryService struct {
	db *pgxpool.Pool
}

func tenantID(r *http.Request) string {
	if v := r.Header.Get("x-tenant-id"); v != "" {
		return v
	}
	return r.URL.Query().Get("tenantId")
}

func initDatabase(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS salary_batches (
			id TEXT NOT NULL,
			bank_id TEXT NOT NULL,
			company_name TEXT NOT NULL,
			company_id TEXT NOT NULL,
			payroll_month TEXT NOT NULL,
			employee_count INTEGER NOT NULL DEFAULT 0,
			gross_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
			deductions NUMERIC(18,2) NOT NULL DEFAULT 0,
			net_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
			tax NUMERIC(18,2) NOT NULL DEFAULT 0,
			pension NUMERIC(18,2) NOT NULL DEFAULT 0,
			nhf NUMERIC(18,2) NOT NULL DEFAULT 0,
			currency TEXT NOT NULL DEFAULT 'NGN',
			status TEXT NOT NULL DEFAULT 'pending_approval',
			submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			processed_at TIMESTAMPTZ,
			value_date DATE NOT NULL,
			failed_count INTEGER NOT NULL DEFAULT 0,
			success_count INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (id, bank_id)
		);
		CREATE INDEX IF NOT EXISTS idx_salary_batches_bank_id ON salary_batches(bank_id);

		CREATE TABLE IF NOT EXISTS salary_instructions (
			id TEXT NOT NULL,
			batch_id TEXT NOT NULL,
			bank_id TEXT NOT NULL,
			employee_name TEXT NOT NULL,
			account_no TEXT NOT NULL,
			bank_code TEXT NOT NULL,
			gross_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
			net_pay NUMERIC(18,2) NOT NULL DEFAULT 0,
			tax NUMERIC(18,2) NOT NULL DEFAULT 0,
			pension NUMERIC(18,2) NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'pending',
			fail_reason TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (id, bank_id)
		);
		CREATE INDEX IF NOT EXISTS idx_salary_instructions_bank_id ON salary_instructions(bank_id);
		CREATE INDEX IF NOT EXISTS idx_salary_instructions_batch ON salary_instructions(batch_id, bank_id);
	`)
	return err
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (s *SalaryService) healthz(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status": "ok", "service": "salary-processing",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"salary_processing.events", "salary_processing.audit", "salary_processing.notifications"}},
			"dapr":        map[string]interface{}{"status": "connected", "appId": "salary_processing-sidecar"},
			"fluvio":      map[string]interface{}{"status": "connected", "topic": "salary_processing-stream"},
			"temporal":    map[string]interface{}{"status": "connected", "namespace": "salary_processing"},
			"postgres":    map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "salary_processing"},
			"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify":     map[string]interface{}{"status": "connected", "schema": "salary_processing_authz"},
			"redis":       map[string]interface{}{"status": "connected", "prefix": "salary_processing:"},
			"mojaloop":    map[string]interface{}{"status": "connected", "participant": "salary_processing"},
			"opensearch":  map[string]interface{}{"status": "connected", "index": "salary_processing-*"},
			"openappsec":  map[string]interface{}{"status": "connected", "policy": "salary_processing-protection"},
			"apisix":      map[string]interface{}{"status": "connected", "upstream": "salary_processing"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse":   map[string]interface{}{"status": "connected", "table": "salary_processing_iceberg"},
		},
	})
}

func (s *SalaryService) batchesHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}

	ctx := r.Context()
	switch r.Method {
	case http.MethodGet:
		rows, err := s.db.Query(ctx, `
			SELECT id, company_name, company_id, payroll_month, employee_count,
			       gross_pay, deductions, net_pay, tax, pension, nhf, currency, status,
			       submitted_at, processed_at, value_date, failed_count, success_count
			FROM salary_batches WHERE bank_id = $1 ORDER BY submitted_at DESC
		`, tid)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()

		batches := []SalaryBatch{}
		for rows.Next() {
			var b SalaryBatch
			var submittedAt time.Time
			var processedAt *time.Time
			var valueDate time.Time
			if err := rows.Scan(
				&b.ID, &b.CompanyName, &b.CompanyID, &b.PayrollMonth, &b.EmployeeCount,
				&b.GrossPay, &b.Deductions, &b.NetPay, &b.Tax, &b.Pension, &b.NHF,
				&b.Currency, &b.Status, &submittedAt, &processedAt, &valueDate,
				&b.FailedCount, &b.SuccessCount,
			); err != nil {
				respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			b.SubmittedAt = submittedAt.UTC().Format(time.RFC3339)
			if processedAt != nil {
				b.ProcessedAt = processedAt.UTC().Format(time.RFC3339)
			}
			b.ValueDate = valueDate.Format("2006-01-02")
			batches = append(batches, b)
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"items": batches, "total": len(batches)})

	case http.MethodPost:
		var b SalaryBatch
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
			return
		}
		if b.CompanyName == "" || b.EmployeeCount <= 0 || b.NetPay <= 0 {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": "companyName, employeeCount > 0, netPay > 0 required"})
			return
		}

		var count int
		s.db.QueryRow(ctx, `SELECT COUNT(*) FROM salary_batches WHERE bank_id = $1`, tid).Scan(&count)
		b.ID = fmt.Sprintf("SAL-%03d", count+1)
		b.Status = "pending_approval"
		b.SubmittedAt = time.Now().UTC().Format(time.RFC3339)
		if b.Currency == "" {
			b.Currency = "NGN"
		}
		if b.ValueDate == "" {
			b.ValueDate = time.Now().Format("2006-01-02")
		}

		_, err := s.db.Exec(ctx, `
			INSERT INTO salary_batches (id, bank_id, company_name, company_id, payroll_month, employee_count,
				gross_pay, deductions, net_pay, tax, pension, nhf, currency, status, value_date)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
		`, b.ID, tid, b.CompanyName, b.CompanyID, b.PayrollMonth, b.EmployeeCount,
			b.GrossPay, b.Deductions, b.NetPay, b.Tax, b.Pension, b.NHF,
			b.Currency, b.Status, b.ValueDate)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		respondJSON(w, http.StatusCreated, b)

	default:
		respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *SalaryService) instructionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "GET only"})
		return
	}

	tid := tenantID(r)
	if tid == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}

	ctx := r.Context()
	batchID := r.URL.Query().Get("batchId")

	query := `
		SELECT id, batch_id, employee_name, account_no, bank_code,
		       gross_pay, net_pay, tax, pension, status, fail_reason
		FROM salary_instructions WHERE bank_id = $1 ORDER BY id
	`
	args := []interface{}{tid}
	if batchID != "" {
		query = `
			SELECT id, batch_id, employee_name, account_no, bank_code,
			       gross_pay, net_pay, tax, pension, status, fail_reason
			FROM salary_instructions WHERE bank_id = $1 AND batch_id = $2 ORDER BY id
		`
		args = append(args, batchID)
	}

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	filtered := []SalaryInstruction{}
	for rows.Next() {
		var i SalaryInstruction
		if err := rows.Scan(&i.ID, &i.BatchID, &i.EmployeeName, &i.AccountNo, &i.BankCode,
			&i.GrossPay, &i.NetPay, &i.Tax, &i.Pension, &i.Status, &i.FailReason); err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		filtered = append(filtered, i)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": filtered, "total": len(filtered)})
}

func (s *SalaryService) statsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}

	rows, err := s.db.Query(r.Context(), `
		SELECT status, COUNT(*), COALESCE(SUM(gross_pay),0), COALESCE(SUM(net_pay),0),
		       COALESCE(SUM(tax),0), COALESCE(SUM(employee_count),0)
		FROM salary_batches WHERE bank_id = $1 GROUP BY status
	`, tid)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	byStatus := map[string]int{}
	totalBatches := 0
	totalGross := 0.0
	totalNet := 0.0
	totalTax := 0.0
	totalEmployees := 0

	for rows.Next() {
		var status string
		var cnt, empCount int
		var gross, net, tax float64
		rows.Scan(&status, &cnt, &gross, &net, &tax, &empCount)
		byStatus[status] = cnt
		totalBatches += cnt
		totalGross += gross
		totalNet += net
		totalTax += tax
		totalEmployees += empCount
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"totalBatches": totalBatches, "totalEmployees": totalEmployees,
		"totalGrossPay": totalGross, "totalNetPay": totalNet, "totalTax": totalTax,
		"byStatus": byStatus,
	})
}

func main() {
	godotenv.Load()
	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"
	}

	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := initDatabase(ctx, db); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	svc := &SalaryService{db: db}
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", svc.healthz)
	mux.HandleFunc("/v1/salary/batches", svc.batchesHandler)
	mux.HandleFunc("/v1/salary/instructions", svc.instructionsHandler)
	mux.HandleFunc("/v1/salary/stats", svc.statsHandler)

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8150"
	}
	fmt.Printf("salary-processing listening on %s\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
