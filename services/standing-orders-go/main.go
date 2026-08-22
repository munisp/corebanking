package main

// Standing Orders Service — scheduled payments, recurring transfers, direct
// debit mandates. Port: 8115
//
// Doctrine: orders/mandates/scheduled payments live in Postgres (not just
// memory). A real scheduler loop executes due orders through the payments
// rail (PAYMENTS_RAIL_URL) and records every execution. An execution is
// marked executed ONLY on a confirmed rail response; failures are recorded
// as failed with the rail's error. Fake middleware connectivity claims and
// never-firing "active" orders are removed.

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	_ "github.com/lib/pq"
)

var db *sql.DB

type StandingOrder struct {
	ID              string    `json:"id"`
	AccountID       string    `json:"accountId"`
	BeneficiaryID   string    `json:"beneficiaryId"`
	BeneficiaryName string    `json:"beneficiaryName"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	Frequency       string    `json:"frequency"` // daily, weekly, biweekly, monthly, quarterly, annually
	NextExecutionAt string    `json:"nextExecutionAt"`
	LastExecutedAt  string    `json:"lastExecutedAt,omitempty"`
	StartDate       string    `json:"startDate"`
	EndDate         string    `json:"endDate,omitempty"`
	ExecutionCount  int       `json:"executionCount"`
	MaxExecutions   int       `json:"maxExecutions,omitempty"` // 0 = unlimited
	Narration       string    `json:"narration"`
	Status          string    `json:"status"` // active, paused, completed, cancelled, failed
	FailureReason   string    `json:"failureReason,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
}

type DirectDebitMandate struct {
	ID            string    `json:"id"`
	MerchantID    string    `json:"merchantId"`
	MerchantName  string    `json:"merchantName"`
	CustomerID    string    `json:"customerId"`
	AccountID     string    `json:"accountId"`
	MaxAmount     float64   `json:"maxAmount"`
	Frequency     string    `json:"frequency"`
	Status        string    `json:"status"` // pending_consent, active, suspended, revoked, expired
	ConsentRef    string    `json:"consentRef"`
	MandateRef    string    `json:"mandateRef"`
	ExpiryDate    string    `json:"expiryDate"`
	LastDebitDate string    `json:"lastDebitDate,omitempty"`
	TotalDebited  float64   `json:"totalDebited"`
	CreatedAt     time.Time `json:"createdAt"`
}

type ScheduledPayment struct {
	ID          string            `json:"id"`
	AccountID   string            `json:"accountId"`
	PaymentType string            `json:"paymentType"` // transfer, bill_payment, loan_repayment
	Amount      float64           `json:"amount"`
	ScheduledAt string            `json:"scheduledAt"`
	Status      string            `json:"status"` // scheduled, executed, failed, cancelled
	Reference   string            `json:"reference"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
}

var soCounter int64

func nextID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, atomic.AddInt64(&soCounter, 1)+time.Now().UnixNano()%1000000)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func writeJSONSO(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func nextExecutionAfter(freq string, from time.Time) time.Time {
	switch freq {
	case "daily":
		return from.Add(24 * time.Hour)
	case "weekly":
		return from.AddDate(0, 0, 7)
	case "biweekly":
		return from.AddDate(0, 0, 14)
	case "monthly":
		return from.AddDate(0, 1, 0)
	case "quarterly":
		return from.AddDate(0, 3, 0)
	case "annually":
		return from.AddDate(1, 0, 0)
	}
	return from.AddDate(0, 1, 0)
}

// ─── Payments rail client ───────────────────────────────────────────────────

var railHTTPClient = &http.Client{Timeout: 20 * time.Second}

func paymentsRailURL() string {
	if v := os.Getenv("PAYMENTS_RAIL_URL"); v != "" {
		return v
	}
	return os.Getenv("PAYMENTS_HUB_URL")
}

// executeTransfer posts a real transfer to the payments rail. Only a
// confirmed rail response counts as executed.
func executeTransfer(accountID, beneficiaryID string, amount float64, narration, reference string) error {
	base := paymentsRailURL()
	if base == "" {
		return fmt.Errorf("payments rail unconfigured (set PAYMENTS_RAIL_URL or PAYMENTS_HUB_URL)")
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"fromAccountId": accountID,
		"beneficiaryId": beneficiaryID,
		"amount":        amount,
		"currency":      "NGN",
		"narration":     narration,
		"reference":     reference,
		"source":        "standing-orders-go",
	})
	resp, err := railHTTPClient.Post(base+"/v1/transfers", "application/json", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("payments rail call failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("payments rail returned status %d: %s", resp.StatusCode, string(body))
	}
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err == nil {
		if success, ok := result["success"].(bool); ok && !success {
			return fmt.Errorf("payments rail rejected transfer: %s", string(body))
		}
		if st, ok := result["status"].(string); ok && st == "failed" {
			return fmt.Errorf("payments rail transfer failed: %s", string(body))
		}
	}
	return nil
}

// ─── Scheduler: real execution engine ───────────────────────────────────────

func startScheduler(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				executeDueStandingOrders()
				executeDueScheduledPayments()
			}
		}
	}()
}

// executeDueStandingOrders atomically CLAIMS each due order (UPDATE ... SET
// status='running' WHERE status='active' ... RETURNING) before executing it.
// Concurrent scheduler instances can never execute the same order twice: the
// claim only succeeds for the instance that flips the row first. Orders left
// in 'running' by a crashed scheduler are reclaimed after a grace period.
// The schedule (next_execution_at) advances ONLY after a confirmed rail
// execution; failures are recorded and retried on the next poll.
func executeDueStandingOrders() {
	if db == nil {
		return
	}
	// Recover orders stuck in 'running' by a crashed/killed scheduler.
	if _, err := db.Exec(`UPDATE standing_orders SET status = 'active', updated_at = NOW()
		WHERE status = 'running' AND updated_at < NOW() - interval '10 minutes'`); err != nil {
		log.Printf("[scheduler] stale-claim recovery failed: %v", err)
	}

	// Atomic claim: only rows still 'active' and due are flipped to 'running'
	// by THIS statement; a concurrent scheduler re-evaluates the predicate
	// after lock wait and skips rows we claimed.
	rows, err := db.Query(`UPDATE standing_orders SET status = 'running', updated_at = NOW()
		WHERE id IN (SELECT id FROM standing_orders
			WHERE status = 'active' AND next_execution_at IS NOT NULL AND next_execution_at <= NOW()
			LIMIT 50)
		RETURNING id, account_id, beneficiary_id, amount, narration, frequency, execution_count, max_executions, end_date`)
	if err != nil {
		log.Printf("[scheduler] due orders claim failed: %v", err)
		return
	}
	type dueOrder struct {
		id, accountID, beneficiaryID, narration, frequency string
		amount                                             float64
		execCount, maxExec                                 int
		endDate                                            sql.NullString
	}
	var due []dueOrder
	for rows.Next() {
		var o dueOrder
		if err := rows.Scan(&o.id, &o.accountID, &o.beneficiaryID, &o.amount, &o.narration, &o.frequency, &o.execCount, &o.maxExec, &o.endDate); err == nil {
			due = append(due, o)
		}
	}
	rows.Close()

	for _, o := range due {
		ref := "SO-EXEC-" + o.id + "-" + fmt.Sprint(time.Now().UnixNano())
		execErr := executeTransfer(o.accountID, o.beneficiaryID, o.amount, o.narration, ref)

		execStatus := "executed"
		errText := ""
		if execErr != nil {
			execStatus = "failed"
			errText = execErr.Error()
		}
		if _, err := db.Exec(`INSERT INTO standing_order_executions (order_id, reference, amount, status, error)
			VALUES ($1,$2,$3,$4,$5)`, o.id, ref, o.amount, execStatus, errText); err != nil {
			log.Printf("[scheduler] execution record insert failed for %s: %v", o.id, err)
		}

		if execErr != nil {
			// Failure: release the claim WITHOUT advancing the schedule — the
			// order stays due and is retried on the next poll. The failure is
			// recorded above and on the order row.
			if _, err := db.Exec(`UPDATE standing_orders SET
				status = 'active', failure_reason = $2, updated_at = NOW()
				WHERE id = $1 AND status = 'running'`,
				o.id, errText); err != nil {
				log.Printf("[scheduler] order %s claim release after failure failed: %v", o.id, err)
			}
			log.Printf("[scheduler] order %s execution FAILED (recorded, schedule NOT advanced): %v", o.id, execErr)
			continue
		}

		// Confirmed execution: advance the schedule exactly once.
		next := nextExecutionAfter(o.frequency, time.Now())
		o.execCount++
		newStatus := "active"
		if o.maxExec > 0 && o.execCount >= o.maxExec {
			newStatus = "completed"
		}
		if o.endDate.Valid && o.endDate.String != "" {
			if t, err := time.Parse("2006-01-02", o.endDate.String); err == nil && next.After(t) {
				newStatus = "completed"
			}
		}
		if _, err := db.Exec(`UPDATE standing_orders SET
			status = $2, execution_count = $3, last_executed_at = NOW(),
			next_execution_at = $4, failure_reason = '', updated_at = NOW()
			WHERE id = $1 AND status = 'running'`,
			o.id, newStatus, o.execCount, next); err != nil {
			log.Printf("[scheduler] order update failed for %s (execution DID succeed at rail, ref=%s): %v", o.id, ref, err)
		}
	}
}

// executeDueScheduledPayments atomically claims each due scheduled payment
// (UPDATE ... SET status='running' WHERE status='scheduled' ... RETURNING)
// before executing it, so concurrent schedulers never double-debit. The final
// status is written only after the rail confirms (executed) or rejects
// (failed) the transfer.
func executeDueScheduledPayments() {
	if db == nil {
		return
	}
	// Recover payments stuck in 'running' by a crashed/killed scheduler back
	// to 'scheduled' so they are retried.
	if _, err := db.Exec(`UPDATE scheduled_payments SET status = 'scheduled', updated_at = NOW()
		WHERE status = 'running' AND updated_at < NOW() - interval '10 minutes'`); err != nil {
		log.Printf("[scheduler] stale-claim recovery (scheduled payments) failed: %v", err)
	}
	rows, err := db.Query(`UPDATE scheduled_payments SET status = 'running', updated_at = NOW()
		WHERE id IN (SELECT id FROM scheduled_payments
			WHERE status = 'scheduled' AND scheduled_at <= NOW()
			LIMIT 50)
		RETURNING id, account_id, amount, payment_type, reference`)
	if err != nil {
		log.Printf("[scheduler] scheduled payment claim failed: %v", err)
		return
	}
	type due struct {
		id, accountID, paymentType, reference string
		amount                                float64
	}
	var payments []due
	for rows.Next() {
		var p due
		if err := rows.Scan(&p.id, &p.accountID, &p.amount, &p.paymentType, &p.reference); err == nil {
			payments = append(payments, p)
		}
	}
	rows.Close()

	for _, p := range payments {
		err := executeTransfer(p.accountID, "", p.amount, "scheduled payment "+p.id, p.reference)
		status := "executed"
		if err != nil {
			status = "failed"
			log.Printf("[scheduler] scheduled payment %s failed: %v", p.id, err)
		}
		if _, uerr := db.Exec(`UPDATE scheduled_payments SET status = $2, updated_at = NOW() WHERE id = $1 AND status = 'running'`, p.id, status); uerr != nil {
			log.Printf("[scheduler] scheduled payment update failed for %s: %v", p.id, uerr)
		}
	}
}

// ─── Handlers (Postgres-backed) ─────────────────────────────────────────────

func dbUnavailable(w http.ResponseWriter) bool {
	if db != nil {
		return false
	}
	writeJSONSO(w, 503, map[string]string{"error": "database unavailable"})
	return true
}

func handleStandingOrders(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "GET" {
		if dbUnavailable(w) {
			return
		}
		rows, err := db.QueryContext(r.Context(), `SELECT payload FROM standing_orders ORDER BY created_at DESC LIMIT 200`)
		if err != nil {
			writeJSONSO(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		var items []json.RawMessage
		for rows.Next() {
			var p string
			if err := rows.Scan(&p); err == nil {
				items = append(items, json.RawMessage(p))
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"items": items, "total": len(items)})
		return
	}
	if r.Method == "POST" {
		var so StandingOrder
		json.NewDecoder(r.Body).Decode(&so)
		if so.AccountID == "" {
			writeJSONSO(w, 400, map[string]string{"error": "accountId is required"})
			return
		}
		if so.Amount <= 0 {
			writeJSONSO(w, 400, map[string]string{"error": "amount must be greater than 0"})
			return
		}
		validFreq := map[string]bool{"daily": true, "weekly": true, "biweekly": true, "monthly": true, "quarterly": true, "annually": true}
		if !validFreq[so.Frequency] {
			writeJSONSO(w, 400, map[string]string{"error": "frequency must be: daily, weekly, biweekly, monthly, quarterly, annually"})
			return
		}
		if dbUnavailable(w) {
			return
		}

		so.ID = nextID("SO")
		so.Status = "active"
		so.Currency = "NGN"
		if so.StartDate == "" {
			so.StartDate = time.Now().Format("2006-01-02")
		}
		so.CreatedAt = time.Now()
		so.NextExecutionAt = nextExecutionAfter(so.Frequency, time.Now()).Format(time.RFC3339)

		payload, _ := json.Marshal(so)
		if _, err := db.Exec(`INSERT INTO standing_orders
			(id, account_id, beneficiary_id, amount, narration, frequency, status, execution_count, max_executions, end_date, next_execution_at, payload)
			VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,NULLIF($9,''),$10,$11)`,
			so.ID, so.AccountID, so.BeneficiaryID, so.Amount, so.Narration, so.Frequency,
			so.Status, so.MaxExecutions, so.EndDate, so.NextExecutionAt, string(payload)); err != nil {
			writeJSONSO(w, 500, map[string]string{"error": "order persist failed: " + err.Error()})
			return
		}
		writeJSONSO(w, 201, so)
		return
	}
	w.WriteHeader(405)
}

func handlePauseOrder(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}
	var body struct {
		OrderID string `json:"orderId"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if dbUnavailable(w) {
		return
	}
	res, err := db.Exec(`UPDATE standing_orders SET status = 'paused', updated_at = NOW() WHERE id = $1 AND status = 'active'`, body.OrderID)
	if err != nil {
		writeJSONSO(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSONSO(w, 400, map[string]string{"error": "order not found or not active"})
		return
	}
	writeJSONSO(w, 200, map[string]string{"id": body.OrderID, "status": "paused"})
}

func handleResumeOrder(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}
	var body struct {
		OrderID string `json:"orderId"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if dbUnavailable(w) {
		return
	}
	res, err := db.Exec(`UPDATE standing_orders SET status = 'active', updated_at = NOW(),
		next_execution_at = COALESCE(next_execution_at, NOW() + interval '1 day') WHERE id = $1 AND status = 'paused'`, body.OrderID)
	if err != nil {
		writeJSONSO(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSONSO(w, 400, map[string]string{"error": "order not found or not paused"})
		return
	}
	writeJSONSO(w, 200, map[string]string{"id": body.OrderID, "status": "active"})
}

func handleMandates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "GET" {
		if dbUnavailable(w) {
			return
		}
		rows, err := db.QueryContext(r.Context(), `SELECT payload FROM direct_debit_mandates ORDER BY created_at DESC LIMIT 200`)
		if err != nil {
			writeJSONSO(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		var items []json.RawMessage
		for rows.Next() {
			var p string
			if err := rows.Scan(&p); err == nil {
				items = append(items, json.RawMessage(p))
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"items": items, "total": len(items)})
		return
	}
	if r.Method == "POST" {
		var m DirectDebitMandate
		json.NewDecoder(r.Body).Decode(&m)
		if m.MerchantID == "" || m.CustomerID == "" {
			writeJSONSO(w, 400, map[string]string{"error": "merchantId and customerId are required"})
			return
		}
		if m.MaxAmount <= 0 {
			writeJSONSO(w, 400, map[string]string{"error": "maxAmount must be greater than 0"})
			return
		}
		if dbUnavailable(w) {
			return
		}

		m.ID = nextID("DDM")
		m.Status = "pending_consent"
		m.ConsentRef = nextID("CNS")
		m.MandateRef = nextID("MND")
		m.CreatedAt = time.Now()

		payload, _ := json.Marshal(m)
		if _, err := db.Exec(`INSERT INTO direct_debit_mandates (id, merchant_id, customer_id, account_id, max_amount, status, payload)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			m.ID, m.MerchantID, m.CustomerID, m.AccountID, m.MaxAmount, m.Status, string(payload)); err != nil {
			writeJSONSO(w, 500, map[string]string{"error": "mandate persist failed: " + err.Error()})
			return
		}
		writeJSONSO(w, 201, m)
		return
	}
	w.WriteHeader(405)
}

func handleRevokeMandate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "POST" {
		w.WriteHeader(405)
		return
	}
	var body struct {
		MandateID string `json:"mandateId"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if dbUnavailable(w) {
		return
	}
	res, err := db.Exec(`UPDATE direct_debit_mandates SET status = 'revoked', updated_at = NOW() WHERE id = $1 AND status <> 'revoked'`, body.MandateID)
	if err != nil {
		writeJSONSO(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeJSONSO(w, 404, map[string]string{"error": "mandate not found"})
		return
	}
	writeJSONSO(w, 200, map[string]string{"id": body.MandateID, "status": "revoked"})
}

func handleScheduledPayments(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "GET" {
		if dbUnavailable(w) {
			return
		}
		rows, err := db.QueryContext(r.Context(), `SELECT payload FROM scheduled_payments ORDER BY created_at DESC LIMIT 200`)
		if err != nil {
			writeJSONSO(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		var items []json.RawMessage
		for rows.Next() {
			var p string
			if err := rows.Scan(&p); err == nil {
				items = append(items, json.RawMessage(p))
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"scheduledPayments": items, "total": len(items)})
		return
	}
	if r.Method == "POST" {
		var sp ScheduledPayment
		json.NewDecoder(r.Body).Decode(&sp)
		if sp.AccountID == "" || sp.Amount <= 0 {
			writeJSONSO(w, 400, map[string]string{"error": "accountId and amount > 0 required"})
			return
		}
		if sp.ScheduledAt == "" {
			writeJSONSO(w, 400, map[string]string{"error": "scheduledAt is required (ISO 8601 format)"})
			return
		}
		if _, err := time.Parse(time.RFC3339, sp.ScheduledAt); err != nil {
			writeJSONSO(w, 400, map[string]string{"error": "scheduledAt must be RFC3339"})
			return
		}
		if dbUnavailable(w) {
			return
		}

		sp.ID = nextID("SP")
		sp.Status = "scheduled"
		sp.Reference = nextID("REF")
		sp.CreatedAt = time.Now()

		payload, _ := json.Marshal(sp)
		if _, err := db.Exec(`INSERT INTO scheduled_payments (id, account_id, payment_type, amount, scheduled_at, status, reference, payload)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			sp.ID, sp.AccountID, sp.PaymentType, sp.Amount, sp.ScheduledAt, sp.Status, sp.Reference, string(payload)); err != nil {
			writeJSONSO(w, 500, map[string]string{"error": "scheduled payment persist failed: " + err.Error()})
			return
		}
		writeJSONSO(w, 201, sp)
		return
	}
	w.WriteHeader(405)
}

// listHandler returns real execution records from Postgres.
func listHandler(w http.ResponseWriter, r *http.Request) {
	if dbUnavailable(w) {
		return
	}
	rows, err := db.QueryContext(r.Context(),
		`SELECT order_id, reference, amount, status, error, executed_at FROM standing_order_executions ORDER BY executed_at DESC LIMIT 100`)
	if err != nil {
		writeJSONSO(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	var items []map[string]interface{}
	for rows.Next() {
		var orderID, ref, status, errText string
		var amount float64
		var at time.Time
		if err := rows.Scan(&orderID, &ref, &amount, &status, &errText, &at); err == nil {
			items = append(items, map[string]interface{}{
				"orderId": orderID, "reference": ref, "amount": amount,
				"status": status, "error": errText, "executedAt": at,
			})
		}
	}
	writeJSONSO(w, 200, map[string]interface{}{"executions": items, "total": len(items)})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	pg := "unavailable"
	if db != nil && db.Ping() == nil {
		pg = "connected"
	}
	writeJSONSO(w, 200, map[string]interface{}{
		"service": "standing-orders-go", "status": "healthy",
		"postgres":      pg,
		"payments_rail": map[string]string{"configured": fmt.Sprint(paymentsRailURL() != "")},
		"scheduler":     "real: executes due orders via payments rail every 30s, records executions",
	})
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": "database not initialized"})
		return
	}
	if err := db.Ping(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"standing-orders-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"standing-orders-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"standing-orders-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

// --- Rate Limiting ---
var _rlTokens int64 = 100
var _rlLastRefill int64 = 0

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

// ── MIDDLEWARE: JWT Validation (JWKS / RS256) ───────────────────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

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

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + expiry). Fail-closed: no token accepted on structure alone.
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":"standing-orders-go"}`)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":"standing-orders-go"}`)
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
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// R3-NEW-6: no wildcard origin — echo the request Origin only when it is
		// on the CORS_ALLOWED_ORIGINS allowlist (comma-separated; restrictive default).
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin && origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// CORS is handled by APISIX gateway

func initSchema() {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS standing_orders (
			id VARCHAR(64) PRIMARY KEY,
			account_id VARCHAR(64) NOT NULL,
			beneficiary_id VARCHAR(64),
			amount NUMERIC(18,2) NOT NULL,
			narration VARCHAR(500),
			frequency VARCHAR(16) NOT NULL,
			status VARCHAR(16) NOT NULL DEFAULT 'active',
			execution_count INT NOT NULL DEFAULT 0,
			max_executions INT NOT NULL DEFAULT 0,
			end_date VARCHAR(16),
			next_execution_at TIMESTAMPTZ,
			last_executed_at TIMESTAMPTZ,
			failure_reason TEXT,
			payload JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS standing_order_executions (
			id BIGSERIAL PRIMARY KEY,
			order_id VARCHAR(64) NOT NULL,
			reference VARCHAR(96),
			amount NUMERIC(18,2),
			status VARCHAR(16) NOT NULL,
			error TEXT,
			executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS direct_debit_mandates (
			id VARCHAR(64) PRIMARY KEY,
			merchant_id VARCHAR(64),
			customer_id VARCHAR(64),
			account_id VARCHAR(64),
			max_amount NUMERIC(18,2),
			status VARCHAR(24) NOT NULL,
			payload JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS scheduled_payments (
			id VARCHAR(64) PRIMARY KEY,
			account_id VARCHAR(64) NOT NULL,
			payment_type VARCHAR(32),
			amount NUMERIC(18,2) NOT NULL,
			scheduled_at TIMESTAMPTZ NOT NULL,
			status VARCHAR(16) NOT NULL DEFAULT 'scheduled',
			reference VARCHAR(96),
			payload JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_standing_orders_due ON standing_orders(status, next_execution_at)`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			log.Fatalf("schema init failed: %v", err)
		}
	}
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

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8115"
	}

	// DATABASE_URL is REQUIRED — no credential-bearing default. Fail fast at startup.
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatalf("[standing-orders-go] DATABASE_URL env var is required; refusing to start with default database credentials")
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("database ping failed: %v — refusing to run standing orders without durable storage", err)
	}
	initSchema()

	startJWKSRefresh()
	schedCtx, stopSched := context.WithCancel(context.Background())
	defer stopSched()
	startScheduler(schedCtx)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
	})
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/v1/standing-orders", handleStandingOrders)
	mux.HandleFunc("/v1/standing-orders/pause", handlePauseOrder)
	mux.HandleFunc("/v1/standing-orders/resume", handleResumeOrder)
	mux.HandleFunc("/v1/standing-orders/executions", listHandler)
	mux.HandleFunc("/v1/mandates", handleMandates)
	mux.HandleFunc("/v1/mandates/revoke", handleRevokeMandate)
	mux.HandleFunc("/v1/scheduled-payments", handleScheduledPayments)

	handler := corsMiddleware(jwtAuthMiddleware(rateLimitMiddleware(mux))) // CORS is handled by APISIX gateway
	log.Printf("Standing Orders Service starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
