package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
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
	if err != nil {
		return err
	}
	// MN-19: expand-migrate — leg_index maps an instruction to its leg inside
	// the bulk-payments-rs batch (idempotency key sha256(batch_id|index)).
	_, err = db.Exec(ctx, `
		ALTER TABLE salary_instructions ADD COLUMN IF NOT EXISTS leg_index INTEGER;
	`)
	return err
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// healthz (MN-19): reports ONLY real dependency checks. The previous version
// fabricated "connected" claims for kafka/dapr/fluvio/temporal/permify/redis/
// mojaloop/opensearch/openappsec/apisix/tigerbeetle/lakehouse — no clients for
// any of those exist in this service. Deleted.
func (s *SalaryService) healthz(w http.ResponseWriter, r *http.Request) {
	pgErr := s.db.Ping(r.Context())
	pg := "connected"
	status := "ok"
	code := http.StatusOK
	if pgErr != nil {
		pg = "unreachable: " + pgErr.Error()
		status = "degraded"
		code = http.StatusServiceUnavailable
	}
	respondJSON(w, code, map[string]interface{}{
		"status": status, "service": "salary-processing",
		"checks": map[string]interface{}{
			"postgres": pg,
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

// ─── Batch execution through bulk-payments-rs (MN-19) ──────────────────────
//
// Previously this service had NO executor: batches/instructions were CRUD-only
// and the status/fail_reason columns were never written. Now
// POST /v1/salary/batches/{id}/execute runs the batch as a bulk-payments-rs
// batch (the de-facto executor) with deterministic per-leg idempotency keys
// sha256(batch_id|index), and POST /v1/salary/batches/{id}/retry re-runs ONLY
// failed legs via bulk-payments-rs /retry-failed. Instruction status
// transitions are durable: pending → sent → paid|failed (fail_reason set from
// the rail's error).

func bulkPaymentsURL() string {
	if v := strings.TrimSpace(os.Getenv("BULK_PAYMENTS_URL")); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "http://bulk-payments-rs:8080"
}

// legIdempotencyKey must match bulk-payments-rs leg_idempotency_key():
// sha256(batch_id|index) hex (MN-18/MN-19).
func legIdempotencyKey(bulkBatchID string, index int) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%d", bulkBatchID, index)))
	return hex.EncodeToString(sum[:])
}

func (s *SalaryService) batchActionHandler(w http.ResponseWriter, r *http.Request) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/salary/batches/"), "/")
	parts := strings.Split(rest, "/")
	if len(parts) != 2 || parts[0] == "" {
		respondJSON(w, http.StatusNotFound, map[string]string{"error": "unknown batch action; use /v1/salary/batches/{id}/execute|retry"})
		return
	}
	switch parts[1] {
	case "execute":
		s.executeBatch(w, r, parts[0])
	case "retry":
		s.retryBatch(w, r, parts[0])
	default:
		respondJSON(w, http.StatusNotFound, map[string]string{"error": "unknown batch action; use execute|retry"})
	}
}

// bulkRequest issues an authenticated request to bulk-payments-rs, passing
// the caller's JWT and tenant/maker-checker headers through.
func bulkRequest(r *http.Request, method, url string, body interface{}) (int, []byte, error) {
	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(r.Context(), method, url, rdr)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	// Pass through the caller's credentials — bulk-payments-rs verifies JWT
	// fail-closed and forwards auth/tenant headers to the payment hub.
	if v := r.Header.Get("Authorization"); v != "" {
		req.Header.Set("Authorization", v)
	}
	for _, h := range []string{"x-tenant-id", "x-keycloak-id", "x-ledger-id", "x-mint-account-id", "x-switch-name", "x-ams-name", "x-maker-checker-approval-id"} {
		if v := r.Header.Get(h); v != "" {
			req.Header.Set(h, v)
		}
	}
	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	return resp.StatusCode, b, nil
}

func (s *SalaryService) executeBatch(w http.ResponseWriter, r *http.Request, batchID string) {
	if r.Method != http.MethodPost {
		respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST required"})
		return
	}
	tid := tenantID(r)
	if tid == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}
	ctx := r.Context()

	var status, companyID, payrollMonth string
	err := s.db.QueryRow(ctx,
		`SELECT status, company_id, payroll_month FROM salary_batches WHERE id=$1 AND bank_id=$2`,
		batchID, tid).Scan(&status, &companyID, &payrollMonth)
	if err == pgx.ErrNoRows {
		respondJSON(w, http.StatusNotFound, map[string]string{"error": "batch not found"})
		return
	}
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if status == "processing" {
		respondJSON(w, http.StatusConflict, map[string]string{"error": "batch execution already in flight"})
		return
	}
	if status == "completed" {
		respondJSON(w, http.StatusConflict, map[string]string{"error": "batch already fully executed; use retry for failed instructions"})
		return
	}

	// Load pending instructions in deterministic order — the row position IS
	// the leg index used in the bulk idempotency key.
	type instr struct {
		id, employeeName, accountNo, bankCode string
		netPay                                float64
	}
	rows, err := s.db.Query(ctx, `
		SELECT id, employee_name, account_no, bank_code, net_pay
		FROM salary_instructions WHERE batch_id=$1 AND bank_id=$2 AND status='pending'
		ORDER BY id`, batchID, tid)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	var instructions []instr
	for rows.Next() {
		var i instr
		if err := rows.Scan(&i.id, &i.employeeName, &i.accountNo, &i.bankCode, &i.netPay); err == nil {
			instructions = append(instructions, i)
		}
	}
	rows.Close()
	if len(instructions) == 0 {
		respondJSON(w, http.StatusBadRequest, map[string]string{
			"error": "no pending instructions in this batch; use /retry to re-run failed instructions"})
		return
	}

	// Assign durable leg indexes (execute runs only on pending instructions,
	// so this is the first and only assignment).
	for i, ins := range instructions {
		if _, err := s.db.Exec(ctx,
			`UPDATE salary_instructions SET leg_index=$3 WHERE id=$1 AND bank_id=$2`,
			ins.id, tid, i); err != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "leg index assignment failed: " + err.Error()})
			return
		}
	}

	// bulk-payments-rs batch id is namespaced by tenant+batch because salary
	// batch ids (SAL-001, …) are only unique per bank.
	bulkBatchID := fmt.Sprintf("salary-%s-%s", tid, batchID)

	// Durable transition pending→sent + batch→processing, one tx.
	tx, err := s.db.Begin(ctx)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx,
		`UPDATE salary_instructions SET status='sent' WHERE batch_id=$1 AND bank_id=$2 AND status='pending'`,
		batchID, tid); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if _, err := tx.Exec(ctx,
		`UPDATE salary_batches SET status='processing' WHERE id=$1 AND bank_id=$2`,
		batchID, tid); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if err := tx.Commit(ctx); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Build the bulk transfer legs. The source account is the employer's
	// settlement account (env SALARY_SOURCE_ACCOUNT_ID, falling back to the
	// batch company id); the rail validates/executes the actual movement.
	sourceAccount := strings.TrimSpace(os.Getenv("SALARY_SOURCE_ACCOUNT_ID"))
	if sourceAccount == "" {
		sourceAccount = companyID
	}
	transfers := make([]map[string]interface{}, 0, len(instructions))
	for _, ins := range instructions {
		transfers = append(transfers, map[string]interface{}{
			"switch_name":   "vfd",
			"fromAccountId": sourceAccount,
			"toAccount": map[string]string{
				"number": ins.accountNo,
				"id":     ins.accountNo,
				"name":   ins.employeeName,
				"status": "active",
			},
			"toBank": ins.bankCode,
			"amount": strconv.FormatFloat(ins.netPay, 'f', 2, 64),
			"remark": fmt.Sprintf("Salary %s — %s", payrollMonth, ins.employeeName),
		})
	}

	code, body, err := bulkRequest(r, http.MethodPost, bulkPaymentsURL()+"/v1/bulk-payments",
		map[string]interface{}{"batch_id": bulkBatchID, "transfers": transfers})
	if err != nil {
		// Execution state at the rail is UNKNOWN — do not guess paid/failed.
		// Batch stays 'processing'; /retry reconciles from persisted leg state.
		respondJSON(w, http.StatusBadGateway, map[string]interface{}{
			"error": "bulk_rail_unreachable", "detail": err.Error(),
			"note": "batch left in 'processing'; POST /v1/salary/batches/" + batchID + "/retry reconciles from persisted leg state",
		})
		return
	}
	if code == http.StatusForbidden {
		// bulk-payments-rs maker-checker gate (MN-18): revert to pre-execution
		// state so the batch can be executed again once an approval id exists.
		s.db.Exec(ctx, `UPDATE salary_instructions SET status='pending' WHERE batch_id=$1 AND bank_id=$2 AND status='sent'`, batchID, tid)
		s.db.Exec(ctx, `UPDATE salary_batches SET status='pending_approval' WHERE id=$1 AND bank_id=$2`, batchID, tid)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		w.Write(body)
		return
	}
	if code != http.StatusOK {
		respondJSON(w, http.StatusBadGateway, map[string]interface{}{
			"error": "bulk_rail_error", "httpStatus": code, "body": string(body),
			"note": "batch left in 'processing'; POST /v1/salary/batches/" + batchID + "/retry reconciles from persisted leg state",
		})
		return
	}

	// Reconcile instruction/batch state from the PERSISTED bulk batch (not
	// the ephemeral response) — the durable legs are the source of truth.
	rec, recErr := s.reconcileFromBulk(r, tid, batchID, bulkBatchID)
	if recErr != nil {
		respondJSON(w, http.StatusBadGateway, map[string]interface{}{
			"error": "reconcile_failed", "detail": recErr.Error(),
			"note": "legs executed at rail; retry /v1/salary/batches/" + batchID + "/retry to reconcile",
		})
		return
	}
	respondJSON(w, http.StatusOK, rec)
}

// retryBatch re-runs ONLY failed instructions: bulk-payments-rs
// /retry-failed re-executes legs persisted as failed (never succeeded ones),
// then instruction/batch state is reconciled from the persisted legs.
func (s *SalaryService) retryBatch(w http.ResponseWriter, r *http.Request, batchID string) {
	if r.Method != http.MethodPost {
		respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST required"})
		return
	}
	tid := tenantID(r)
	if tid == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "x-tenant-id header required"})
		return
	}
	var status string
	err := s.db.QueryRow(r.Context(),
		`SELECT status FROM salary_batches WHERE id=$1 AND bank_id=$2`, batchID, tid).Scan(&status)
	if err == pgx.ErrNoRows {
		respondJSON(w, http.StatusNotFound, map[string]string{"error": "batch not found"})
		return
	}
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	bulkBatchID := fmt.Sprintf("salary-%s-%s", tid, batchID)
	code, body, err := bulkRequest(r, http.MethodPost,
		fmt.Sprintf("%s/v1/bulk-payments/%s/retry-failed", bulkPaymentsURL(), bulkBatchID),
		map[string]interface{}{})
	if err != nil {
		respondJSON(w, http.StatusBadGateway, map[string]string{"error": "bulk_rail_unreachable", "detail": err.Error()})
		return
	}
	if code == http.StatusNotFound {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "batch has no rail execution to retry; use /execute first"})
		return
	}
	if code != http.StatusOK {
		respondJSON(w, http.StatusBadGateway, map[string]interface{}{
			"error": "bulk_rail_error", "httpStatus": code, "body": string(body)})
		return
	}

	rec, recErr := s.reconcileFromBulk(r, tid, batchID, bulkBatchID)
	if recErr != nil {
		respondJSON(w, http.StatusBadGateway, map[string]string{"error": "reconcile_failed", "detail": recErr.Error()})
		return
	}
	respondJSON(w, http.StatusOK, rec)
}

// reconcileFromBulk reads the persisted bulk batch (legs included) and writes
// durable instruction transitions sent→paid|failed plus the batch summary.
func (s *SalaryService) reconcileFromBulk(r *http.Request, tid, batchID, bulkBatchID string) (map[string]interface{}, error) {
	code, body, err := bulkRequest(r, http.MethodGet,
		fmt.Sprintf("%s/v1/bulk-payments/%s", bulkPaymentsURL(), bulkBatchID), nil)
	if err != nil {
		return nil, fmt.Errorf("bulk batch read failed: %w", err)
	}
	if code != http.StatusOK {
		return nil, fmt.Errorf("bulk batch read HTTP %d: %s", code, string(body))
	}
	var batch struct {
		Status    string `json:"status"`
		Succeeded int    `json:"succeeded"`
		Failed    int    `json:"failed"`
		Legs      []struct {
			Index  int    `json:"index"`
			Status string `json:"status"`
			Error  string `json:"error"`
		} `json:"legs"`
	}
	if err := json.Unmarshal(body, &batch); err != nil {
		return nil, fmt.Errorf("bulk batch response unparseable: %w", err)
	}

	ctx := r.Context()
	for _, leg := range batch.Legs {
		newStatus := ""
		failReason := ""
		switch leg.Status {
		case "success":
			newStatus = "paid"
		case "failed":
			newStatus = "failed"
			failReason = leg.Error
		default:
			continue // still pending at the rail — leave as 'sent'
		}
		if _, err := s.db.Exec(ctx,
			`UPDATE salary_instructions SET status=$1, fail_reason=$2
			 WHERE batch_id=$3 AND bank_id=$4 AND leg_index=$5`,
			newStatus, failReason, batchID, tid, leg.Index); err != nil {
			return nil, fmt.Errorf("instruction status update failed: %w", err)
		}
	}

	if _, err := s.db.Exec(ctx, `
		UPDATE salary_batches SET status=$1, success_count=$2, failed_count=$3, processed_at=NOW()
		WHERE id=$4 AND bank_id=$5`,
		batch.Status, batch.Succeeded, batch.Failed, batchID, tid); err != nil {
		return nil, fmt.Errorf("batch summary update failed: %w", err)
	}

	return map[string]interface{}{
		"batchId":     batchID,
		"status":      batch.Status,
		"succeeded":   batch.Succeeded,
		"failed":      batch.Failed,
		"bulkBatchId": bulkBatchID,
	}, nil
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

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jwtRealmURL() string {
	return getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
}

func fetchJWKS(realmURL string) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, _ := base64.RawURLEncoding.DecodeString(k.N)
		eBytes, _ := base64.RawURLEncoding.DecodeString(k.E)
		if len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// tenantFromClaims derives the tenant ONLY from verified token claims — never
// from caller-supplied headers or parameters.
func tenantFromClaims(claims map[string]interface{}) string {
	for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
		if s, ok := claims[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + expiry). Fail-closed: requests without a verifiable token
// get 401. Only health/metrics probes are exempt. Tenant identity is derived
// from the verified claims and stamped onto X-Tenant-ID, overwriting any
// caller-supplied value.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "salary-processing-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "salary-processing-go")
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		json.Unmarshal(headerBytes, &header)
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}

		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}

		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		if sub, ok := claims["sub"].(string); ok {
			r.Header.Set("X-User-Id", sub)
		}
		// Tenant identity comes ONLY from verified claims; overwrite any
		// caller-supplied tenant header before invoking the handler.
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func main() {
	startJWKSRefresh()

	godotenv.Load()
	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("[salary-processing-go] DATABASE_URL must be set; no default DSN is provided (credentials must come from the environment)")
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
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/v1/salary/batches", svc.batchesHandler)
	mux.HandleFunc("/v1/salary/batches/", svc.batchActionHandler) // MN-19: {id}/execute, {id}/retry
	mux.HandleFunc("/v1/salary/instructions", svc.instructionsHandler)
	mux.HandleFunc("/v1/salary/stats", svc.statsHandler)

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8150"
	}
	fmt.Printf("salary-processing listening on %s\n", addr)
	if err := http.ListenAndServe(addr, rateLimitMiddleware(jwtAuthMiddleware(countingMiddleware(mux)))); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}

// --- Request metrics (restored fleet-canonical block) ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func countingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&_reqCount, 1)
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		if rw.status >= 400 {
			atomic.AddUint64(&_errCount, 1)
		}
	})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"salary-processing-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"salary-processing-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"salary-processing-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"salary-processing-go"}`)
}

// --- Rate limiting (restored fleet-canonical token bucket: 100 rps) ---
var _rlTokens int64 = 100
var _rlLastRefill int64

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr-atomic.LoadInt64(&_rlLastRefill) >= 1000 {
		atomic.StoreInt64(&_rlTokens, 100)
		atomic.StoreInt64(&_rlLastRefill, nowr)
	}
	if atomic.AddInt64(&_rlTokens, -1) < 0 {
		atomic.AddInt64(&_rlTokens, 1)
		return false
	}
	return true
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rlAllow() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":"rate_limit_exceeded"}`, 429)
			return
		}
		next.ServeHTTP(w, r)
	})
}
