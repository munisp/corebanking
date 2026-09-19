package main

// LN-11 (L12): real debt-collection case store and lifecycle. Cases are
// opened from arrears (loan-service aging buckets / education arrears),
// assigned to agents, tracked through contact and promise-to-pay, and closed
// by recovery receipts. All state lives in Postgres.

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var caseDB *sql.DB

// initCaseStore connects and creates the schema (expand-only).
func initCaseStore() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatalf("[debt-collection] DATABASE_URL env var is required; refusing to start")
	}
	var err error
	caseDB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("[debt-collection] database open failed: %v", err)
	}
	if err := caseDB.Ping(); err != nil {
		log.Fatalf("[debt-collection] database ping failed: %v", err)
	}

	stmts := []string{
		`CREATE TABLE IF NOT EXISTS collection_cases (
			id BIGSERIAL PRIMARY KEY,
			case_ref VARCHAR(64) UNIQUE NOT NULL,
			tenant_id VARCHAR(64) NOT NULL,
			loan_id VARCHAR(64) NOT NULL,
			loan_book VARCHAR(32) NOT NULL, -- generic | education | agricultural | mortgage
			customer_id VARCHAR(64),
			amount_outstanding_kobo BIGINT NOT NULL,
			days_past_due INT NOT NULL DEFAULT 0,
			aging_bucket VARCHAR(10) NOT NULL DEFAULT 'current',
			status VARCHAR(32) NOT NULL DEFAULT 'open', -- open, assigned, contacted, promise_to_pay, recovered, closed
			assigned_to VARCHAR(100),
			created_by VARCHAR(100),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, loan_id, status) DEFERRABLE INITIALLY DEFERRED
		)`,
		`CREATE TABLE IF NOT EXISTS collection_case_events (
			id BIGSERIAL PRIMARY KEY,
			case_ref VARCHAR(64) NOT NULL REFERENCES collection_cases(case_ref),
			tenant_id VARCHAR(64) NOT NULL,
			event_type VARCHAR(32) NOT NULL, -- assigned, contact, promise_to_pay, promise_broken, recovery, note, closed
			detail JSONB,
			actor VARCHAR(100),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_collection_cases_tenant_status ON collection_cases (tenant_id, status)`,
	}
	for _, q := range stmts {
		if _, err := caseDB.Exec(q); err != nil {
			log.Fatalf("[debt-collection] schema init failed: %v", err)
		}
	}
	log.Println("[debt-collection] case store ready")
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func registerCaseRoutes() {
	http.HandleFunc("/api/debt-collection/cases", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			createCase(w, r)
		case http.MethodGet:
			listCases(w, r)
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "GET or POST required"})
		}
	})
	http.HandleFunc("/api/debt-collection/cases/", caseSubroutes)
}

// createCase opens a collection case from an arrears position. Amounts are
// integer kobo. Re-opening a loan with an active case returns 409.
func createCase(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	actor := r.Header.Get("X-User-Id")
	var req struct {
		LoanID                string `json:"loan_id"`
		LoanBook              string `json:"loan_book"`
		CustomerID            string `json:"customer_id"`
		AmountOutstandingKobo int64  `json:"amount_outstanding_kobo"`
		DaysPastDue           int    `json:"days_past_due"`
		AgingBucket           string `json:"aging_bucket"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if tenantID == "" || req.LoanID == "" || req.AmountOutstandingKobo <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "tenant header, loan_id and positive amount_outstanding_kobo are required"})
		return
	}
	switch req.LoanBook {
	case "generic", "education", "agricultural", "mortgage":
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "loan_book must be one of generic|education|agricultural|mortgage"})
		return
	}

	caseRef := fmt.Sprintf("DC-%s-%s", req.LoanBook, req.LoanID)
	res, err := caseDB.Exec(`
		INSERT INTO collection_cases (case_ref, tenant_id, loan_id, loan_book, customer_id, amount_outstanding_kobo, days_past_due, aging_bucket, status, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9)
		ON CONFLICT (case_ref) DO NOTHING`,
		caseRef, tenantID, req.LoanID, req.LoanBook, req.CustomerID, req.AmountOutstandingKobo, req.DaysPastDue, req.AgingBucket, actor)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create case"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "case already exists for this loan", "case_ref": caseRef})
		return
	}
	addCaseEvent(caseRef, tenantID, "opened", map[string]interface{}{"dpd": req.DaysPastDue}, actor)
	writeJSON(w, http.StatusCreated, map[string]interface{}{"case_ref": caseRef, "status": "open"})
}

func listCases(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	status := r.URL.Query().Get("status")
	q := `SELECT case_ref, loan_id, loan_book, COALESCE(customer_id,''), amount_outstanding_kobo, days_past_due, aging_bucket, status, COALESCE(assigned_to,''), created_at, updated_at
		FROM collection_cases WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	if status != "" {
		q += ` AND status = $2`
		args = append(args, status)
	}
	q += ` ORDER BY days_past_due DESC LIMIT 200`
	rows, err := caseDB.Query(q, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()
	cases := []map[string]interface{}{}
	for rows.Next() {
		var ref, loanID, book, cust, st, assigned string
		var amount int64
		var dpd int
		var bucket string
		var created, updated time.Time
		if err := rows.Scan(&ref, &loanID, &book, &cust, &amount, &dpd, &bucket, &st, &assigned, &created, &updated); err != nil {
			continue
		}
		cases = append(cases, map[string]interface{}{
			"case_ref": ref, "loan_id": loanID, "loan_book": book, "customer_id": cust,
			"amount_outstanding_kobo": amount, "days_past_due": dpd, "aging_bucket": bucket,
			"status": st, "assigned_to": assigned, "created_at": created, "updated_at": updated,
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"cases": cases, "total": len(cases)})
}

// caseSubroutes handles /cases/{ref}/{action}: assign, contact, promise, recovery, close.
func caseSubroutes(w http.ResponseWriter, r *http.Request) {
	rest := r.URL.Path[len("/api/debt-collection/cases/"):]
	var ref, action string
	if n, _ := fmt.Sscanf(rest, "%s", &rest); n == 0 || rest == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "case ref required"})
		return
	}
	for i := 0; i < len(rest); i++ {
		if rest[i] == '/' {
			ref, action = rest[:i], rest[i+1:]
			break
		}
	}
	if ref == "" {
		ref = rest
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST required"})
		return
	}
	switch action {
	case "assign":
		caseAssign(w, r, ref)
	case "contact":
		caseContact(w, r, ref)
	case "promise":
		casePromise(w, r, ref)
	case "recovery":
		caseRecovery(w, r, ref)
	case "close":
		caseClose(w, r, ref)
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "unknown action"})
	}
}

func transitionCase(w http.ResponseWriter, r *http.Request, ref, fromClause, toStatus, eventType string, detail map[string]interface{}) bool {
	tenantID := r.Header.Get("X-Tenant-ID")
	actor := r.Header.Get("X-User-Id")
	res, err := caseDB.Exec(`
		UPDATE collection_cases SET status = $1, updated_at = NOW()
		WHERE case_ref = $2 AND tenant_id = $3 AND status `+fromClause,
		toStatus, ref, tenantID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "transition failed"})
		return false
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "case not found or not in a valid state for this transition"})
		return false
	}
	addCaseEvent(ref, tenantID, eventType, detail, actor)
	return true
}

func caseAssign(w http.ResponseWriter, r *http.Request, ref string) {
	var req struct {
		Assignee string `json:"assignee"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Assignee == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "assignee is required"})
		return
	}
	tenantID := r.Header.Get("X-Tenant-ID")
	res, err := caseDB.Exec(`UPDATE collection_cases SET assigned_to = $1, status = 'assigned', updated_at = NOW()
		WHERE case_ref = $2 AND tenant_id = $3 AND status IN ('open','assigned')`, req.Assignee, ref, tenantID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "assign failed"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "case not found or not assignable"})
		return
	}
	addCaseEvent(ref, tenantID, "assigned", map[string]interface{}{"assignee": req.Assignee}, r.Header.Get("X-User-Id"))
	writeJSON(w, http.StatusOK, map[string]string{"case_ref": ref, "status": "assigned", "assigned_to": req.Assignee})
}

func caseContact(w http.ResponseWriter, r *http.Request, ref string) {
	var req struct {
		Channel string `json:"channel"`
		Outcome string `json:"outcome"`
		Notes   string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Outcome == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "outcome is required"})
		return
	}
	if transitionCase(w, r, ref, `IN ('assigned','contacted','promise_to_pay')`, "contacted", "contact",
		map[string]interface{}{"channel": req.Channel, "outcome": req.Outcome, "notes": req.Notes}) {
		writeJSON(w, http.StatusOK, map[string]string{"case_ref": ref, "status": "contacted"})
	}
}

func casePromise(w http.ResponseWriter, r *http.Request, ref string) {
	var req struct {
		PromiseDate string `json:"promise_date"`
		AmountKobo  int64  `json:"amount_kobo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PromiseDate == "" || req.AmountKobo <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "promise_date and positive amount_kobo are required"})
		return
	}
	if _, err := time.Parse("2006-01-02", req.PromiseDate); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "promise_date must be YYYY-MM-DD"})
		return
	}
	if transitionCase(w, r, ref, `IN ('assigned','contacted','promise_to_pay')`, "promise_to_pay", "promise_to_pay",
		map[string]interface{}{"promise_date": req.PromiseDate, "amount_kobo": req.AmountKobo}) {
		writeJSON(w, http.StatusOK, map[string]string{"case_ref": ref, "status": "promise_to_pay"})
	}
}

// caseRecovery records a recovery receipt against the case balance.
func caseRecovery(w http.ResponseWriter, r *http.Request, ref string) {
	var req struct {
		AmountKobo     int64  `json:"amount_kobo"`
		TransactionRef string `json:"transaction_ref"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.AmountKobo <= 0 || req.TransactionRef == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "positive amount_kobo and transaction_ref (server-issued payment reference) are required"})
		return
	}
	tenantID := r.Header.Get("X-Tenant-ID")
	// Atomic decrement; never below zero.
	res, err := caseDB.Exec(`
		UPDATE collection_cases SET amount_outstanding_kobo = amount_outstanding_kobo - $1, updated_at = NOW()
		WHERE case_ref = $2 AND tenant_id = $3 AND amount_outstanding_kobo >= $1
		RETURNING amount_outstanding_kobo`, req.AmountKobo, ref, tenantID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "recovery posting failed"})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "case not found or recovery exceeds outstanding balance"})
		return
	}
	var remaining int64
	if rows, err := caseDB.Query(`SELECT amount_outstanding_kobo FROM collection_cases WHERE case_ref = $1 AND tenant_id = $2`, ref, tenantID); err == nil {
		if rows.Next() {
			rows.Scan(&remaining)
		}
		rows.Close()
	}
	addCaseEvent(ref, tenantID, "recovery", map[string]interface{}{"amount_kobo": req.AmountKobo, "transaction_ref": req.TransactionRef, "remaining_kobo": remaining}, r.Header.Get("X-User-Id"))
	newStatus := "recovered_partial"
	if remaining == 0 {
		caseDB.Exec(`UPDATE collection_cases SET status = 'recovered', updated_at = NOW() WHERE case_ref = $1 AND tenant_id = $2`, ref, tenantID)
		newStatus = "recovered"
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"case_ref": ref, "status": newStatus, "remaining_kobo": remaining})
}

func caseClose(w http.ResponseWriter, r *http.Request, ref string) {
	var req struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.Reason == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "reason is required"})
		return
	}
	if transitionCase(w, r, ref, `IN ('open','assigned','contacted','promise_to_pay','recovered')`, "closed", "closed",
		map[string]interface{}{"reason": req.Reason}) {
		writeJSON(w, http.StatusOK, map[string]string{"case_ref": ref, "status": "closed"})
	}
}

func addCaseEvent(caseRef, tenantID, eventType string, detail map[string]interface{}, actor string) {
	d, _ := json.Marshal(detail)
	if _, err := caseDB.Exec(`INSERT INTO collection_case_events (case_ref, tenant_id, event_type, detail, actor) VALUES ($1,$2,$3,$4,$5)`,
		caseRef, tenantID, eventType, d, actor); err != nil {
		log.Printf("WARN: case event insert failed (%s %s): %v", caseRef, eventType, err)
	}
}
