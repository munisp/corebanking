// EOD Processor — Production Implementation
//
// Orchestrates the nightly End-of-Day batch pipeline by calling real
// downstream services in dependency order and persisting all results to
// PostgreSQL for audit and reconciliation purposes.
//
// Pipeline steps (in execution order):
//   STEP-001  EOTI Mark          — lock business date in DB
//   STEP-002  Interest Accrual   — POST interest-accrual-engine-go /v1/interest/accrue
//   STEP-003  Reconciliation     — POST reconciliation-engine-rs /v1/settlement-recon/run
//   STEP-004  Settlement Finalize— SKIPPED explicitly: no real settlement executor
//                                  exists (mojaloop-settlement-mgr-go is a 501 scaffold)
//   STEP-005  GL Balance Check   — GET gl-engine-go /v1/gl/trial-balance
//   STEP-006  CTR Filing         — trigger NFIU CTR extract for the day
//   STEP-007  Audit Finalization — publish eod.completed event
//   STEP-008  EOFI Mark          — unlock for next business date
//
// Idempotency: one EOD run per tenant per business_date (enforced by UNIQUE constraint).
// Running EOD twice for the same date returns the existing run.
//
// Port: 8207
//
// Required environment variables:
//   DATABASE_URL                  — PostgreSQL DSN
//   INTEREST_ACCRUAL_URL          — interest-accrual-engine-go base URL (MN-24)
//   RECON_URL                     — reconciliation-engine-rs base URL (MN-24)
//   GL_ENGINE_URL                 — gl-engine-go base URL (MN-24)
//   NFIU_CTR_STR_URL              — nfiu-ctr-str-filing-py base URL
//   EOD_SERVICE_TOKEN             — service Bearer token for downstream calls
//                                   (interest-accrual-engine-go, reconciliation-engine-rs
//                                   and gl-engine-go all enforce JWT, fail-closed) (MN-24)
//   DAPR_URL                      — Dapr sidecar
//   DAPR_PUBSUB                   — Dapr pub/sub component name
//   ALLOWED_ORIGINS               — CORS allowed origins

package main

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

	"go.opentelemetry.io/otel/attribute"
	"shared/otel/go/otelkit"
)

// ── Config ────────────────────────────────────────────────────────────────────

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func allowedOrigins() string {
	raw := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS"))
	if raw == "" {
		return "http://localhost:3000,http://localhost:8080"
	}
	return raw
}

// ── Database ──────────────────────────────────────────────────────────────────

var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}
	var err error
	db, err = otelkit.OpenSQLDB("postgres", dsn)
	if err != nil {
		log.Fatalf("DB open: %v", err)
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Fatalf("DB ping: %v", err)
	}
	if err = ensureSchema(); err != nil {
		log.Fatalf("Schema setup: %v", err)
	}
	log.Println("PostgreSQL connected and schema ready")
}

func ensureSchema() error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS eod_runs (
			id              SERIAL PRIMARY KEY,
			tenant_id       TEXT NOT NULL,
			business_date   DATE NOT NULL,
			status          TEXT NOT NULL DEFAULT 'running'
			                CHECK (status IN ('running','completed','completed_with_errors','failed','cancelled')),
			initiated_by    TEXT NOT NULL DEFAULT 'system',
			approved_by     TEXT,
			started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
			completed_at    TIMESTAMPTZ,
			total_steps     INT NOT NULL DEFAULT 0,
			completed_steps INT NOT NULL DEFAULT 0,
			failed_steps    INT NOT NULL DEFAULT 0,
			error_summary   TEXT,
			UNIQUE (tenant_id, business_date)
		);

		CREATE TABLE IF NOT EXISTS eod_step_records (
			id                SERIAL PRIMARY KEY,
			run_id            INT NOT NULL REFERENCES eod_runs(id),
			step_id           TEXT NOT NULL,
			step_name         TEXT NOT NULL,
			status            TEXT NOT NULL DEFAULT 'pending'
			                  CHECK (status IN ('pending','running','completed','failed','skipped')),
			started_at        TIMESTAMPTZ,
			completed_at      TIMESTAMPTZ,
			records_processed INT NOT NULL DEFAULT 0,
			error_message     TEXT,
			result_json       TEXT,
			UNIQUE (run_id, step_id)
		);

		CREATE INDEX IF NOT EXISTS idx_eod_runs_tenant_date
			ON eod_runs (tenant_id, business_date DESC);
		CREATE INDEX IF NOT EXISTS idx_eod_steps_run
			ON eod_step_records (run_id, step_id);
	`)
	return err
}

// ── Types ─────────────────────────────────────────────────────────────────────

type StepDef struct {
	ID        string
	Name      string
	DependsOn []string
}

// Canonical EOD pipeline — steps execute in this order; each one must complete
// before the next starts (sequential for financial correctness).
var pipeline = []StepDef{
	{ID: "STEP-001", Name: "EOTI Mark — lock business date"},
	{ID: "STEP-002", Name: "Interest Accrual", DependsOn: []string{"STEP-001"}},
	{ID: "STEP-003", Name: "Reconciliation", DependsOn: []string{"STEP-002"}},
	{ID: "STEP-004", Name: "Settlement Finalize", DependsOn: []string{"STEP-003"}},
	{ID: "STEP-005", Name: "GL Balance Check", DependsOn: []string{"STEP-004"}},
	{ID: "STEP-006", Name: "CTR/Regulatory Extract", DependsOn: []string{"STEP-005"}},
	{ID: "STEP-007", Name: "Audit Finalization", DependsOn: []string{"STEP-006"}},
	{ID: "STEP-008", Name: "EOFI Mark — unlock for next date", DependsOn: []string{"STEP-007"}},
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func tenantID(r *http.Request) string {
	return r.Header.Get("x-tenant-id")
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func errorJSON(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func callService(method, url string, tenantID string, body interface{}) (int, []byte, error) {
	var reqBody io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return 0, nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("x-tenant-id", tenantID)
	req.Header.Set("x-keycloak-id", "eod-processor")
	req.Header.Set("x-user-role", "system")
	// MN-24: downstream targets (interest-accrual-engine-go,
	// reconciliation-engine-rs, gl-engine-go) all enforce JWT fail-closed, so
	// EOD attaches its service token. When unset, calls will 401 and the step
	// fails loudly — that is the intended fail-closed behaviour.
	if tok := strings.TrimSpace(os.Getenv("EOD_SERVICE_TOKEN")); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}

	client := &http.Client{Timeout: 300 * time.Second} // 5min per step
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, respBody, nil
}

// pbacCheck calls auth-enforcer-rs to make an authorization decision.
// Returns true if allowed, false if denied or if the PDP is unreachable (fail-closed).
func pbacCheck(tid, userID, permission, entityType string) bool {
	pdpURL := getEnv("AUTH_ENFORCER_URL", "http://auth-enforcer-rs:8314") + "/v1/authz/check"
	payload, _ := json.Marshal(map[string]string{
		"userId": userID, "tenantId": tid,
		"permission": permission, "entityType": entityType, "entityId": "global",
	})
	req, err := http.NewRequest("POST", pdpURL, bytes.NewReader(payload))
	if err != nil {
		log.Printf("AUTHZ build request failed: %v", err)
		return false // fail-closed
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("AUTHZ PDP unreachable (fail-closed): %v", err)
		return false
	}
	defer resp.Body.Close()
	var result struct {
		Allowed bool `json:"allowed"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Allowed
}

func publishEvent(topic string, payload interface{}) {
	daprURL := getEnv("DAPR_URL", "http://localhost:3500")
	pubsub := getEnv("DAPR_PUBSUB", "eod-pubsub")
	url := fmt.Sprintf("%s/v1.0/publish/%s/%s", daprURL, pubsub, topic)
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("WARN publish %s: %v", topic, err)
		return
	}
	resp.Body.Close()
}

func stepStarted(runID int, stepID, stepName string) int {
	var id int
	db.QueryRow(`
		INSERT INTO eod_step_records (run_id, step_id, step_name, status, started_at)
		VALUES ($1,$2,$3,'running',now())
		ON CONFLICT (run_id, step_id) DO UPDATE SET status='running', started_at=now()
		RETURNING id`, runID, stepID, stepName).Scan(&id)
	return id
}

func stepDone(id int, recordsProcessed int, result interface{}) {
	resultJSON := ""
	if b, err := json.Marshal(result); err == nil {
		resultJSON = string(b)
	}
	db.Exec(`UPDATE eod_step_records SET status='completed', completed_at=now(),
		records_processed=$1, result_json=$2 WHERE id=$3`,
		recordsProcessed, resultJSON, id)
	db.Exec(`UPDATE eod_runs SET completed_steps=completed_steps+1 WHERE id IN (
		SELECT run_id FROM eod_step_records WHERE id=$1)`, id)
}

func stepFailed(id int, stepID, errMsg string) {
	db.Exec(`UPDATE eod_step_records SET status='failed', completed_at=now(),
		error_message=$1 WHERE id=$2`, errMsg, id)
	db.Exec(`UPDATE eod_runs SET failed_steps=failed_steps+1 WHERE id IN (
		SELECT run_id FROM eod_step_records WHERE id=$1)`, id)
	// MN-24: EVERY failed step increments eod_run_failures_total (Wave-9 counter;
	// feeds the EODRunFailed alert rule), not only hard-aborting ones.
	otelkit.IncCounter(context.Background(), "eod_run_failures_total",
		attribute.String("service", "eod-processor-go"),
		attribute.String("step", stepID))
}

// stepSkipped records a step as explicitly skipped with an operator-visible
// reason (e.g. MN-24: no real settlement executor exists to call).
func stepSkipped(id int, note string) {
	db.Exec(`UPDATE eod_step_records SET status='skipped', completed_at=now(),
		result_json=$1 WHERE id=$2`, fmt.Sprintf(`{"note":%q}`, note), id)
}

// ── EOD Step Executors ────────────────────────────────────────────────────────

// STEP-001: Record EOTI mark in eod_runs — no external service call needed
func executeEOTI(runID int, tid, businessDate string) (int, error) {
	recID := stepStarted(runID, "STEP-001", "EOTI Mark — lock business date")
	// The INSERT of the eod_run itself IS the EOTI lock. Record it.
	stepDone(recID, 1, map[string]string{
		"eotiAt":       time.Now().UTC().Format(time.RFC3339),
		"businessDate": businessDate,
	})
	log.Printf("EOD run=%d STEP-001 EOTI marked date=%s", runID, businessDate)
	return 1, nil
}

// STEP-002: Trigger interest accrual for businessDate.
// MN-24/F2-01: previously pointed at interest-computation-rs:8336
// /api/interest/accrue — a route that does not exist on that service (it only
// serves /api/v1/service_configs* on :8103), so EOD hard-aborted here every
// run. The real accrual engine is interest-accrual-engine-go
// (POST /v1/interest/accrue, container port 8080 in-cluster), which posts
// balanced GL journals with a per-(tenant,account,date) idempotency fence.
func executeInterestAccrual(runID int, tid, businessDate string) (int, error) {
	recID := stepStarted(runID, "STEP-002", "Interest Accrual")
	url := getEnv("INTEREST_ACCRUAL_URL", "http://interest-accrual-engine-go:8080") + "/v1/interest/accrue"

	code, body, err := callService("POST", url, tid, map[string]interface{}{
		"businessDate": businessDate,
	})
	if err != nil {
		stepFailed(recID, "STEP-002", err.Error())
		return 0, fmt.Errorf("interest accrual call failed: %w", err)
	}
	if code != 202 && code != 200 {
		msg := fmt.Sprintf("interest accrual HTTP %d: %s", code, string(body))
		stepFailed(recID, "STEP-002", msg)
		return 0, fmt.Errorf("%s", msg)
	}

	var result map[string]interface{}
	json.Unmarshal(body, &result)
	stepDone(recID, 1, result)
	log.Printf("EOD run=%d STEP-002 interest accrual triggered batchId=%v status=%v", runID, result["batchId"], result["status"])
	return 1, nil
}

// STEP-003: Trigger reconciliation run.
// MN-24/F2-01: previously called reconciliation-engine-rs:8290
// /api/recon/trigger — neither the port (real: 8234, 8080 in-cluster) nor the
// route exists. The real route is POST /v1/settlement-recon/run, which reads
// nostro_positions, compares integer kobo balances and persists recon_breaks /
// suspense items on discrepancy (MN-17). It fails closed with 503
// source_unavailable when its data source is missing — treated as a step
// failure here (hard-abort), which is the correct behaviour for EOD.
func executeReconciliation(runID int, tid, businessDate string) (int, error) {
	recID := stepStarted(runID, "STEP-003", "Reconciliation")
	url := getEnv("RECON_URL", "http://reconciliation-engine-rs:8080") + "/v1/settlement-recon/run"

	code, body, err := callService("POST", url, tid, map[string]interface{}{
		"recon_type":    "nostro",
		"business_date": businessDate,
	})
	if err != nil {
		stepFailed(recID, "STEP-003", err.Error())
		return 0, fmt.Errorf("reconciliation call failed: %w", err)
	}
	if code != 202 && code != 200 {
		msg := fmt.Sprintf("reconciliation HTTP %d: %s", code, string(body))
		stepFailed(recID, "STEP-003", msg)
		return 0, fmt.Errorf("%s", msg)
	}

	var result struct {
		Recon struct {
			ReconID          string `json:"recon_id"`
			Status           string `json:"status"`
			ItemsOutstanding int    `json:"items_outstanding"`
		} `json:"recon"`
	}
	json.Unmarshal(body, &result)
	stepDone(recID, result.Recon.ItemsOutstanding, map[string]interface{}{
		"reconId": result.Recon.ReconID, "reconStatus": result.Recon.Status,
		"itemsOutstanding": result.Recon.ItemsOutstanding,
	})
	log.Printf("EOD run=%d STEP-003 reconciliation done reconId=%s status=%s outstanding=%d",
		runID, result.Recon.ReconID, result.Recon.Status, result.Recon.ItemsOutstanding)
	return 1, nil
}

// STEP-004: Settlement Finalize.
// MN-24/F2-01: the previous implementation called mojaloop-settlement-mgr-go
// /v1/settlement/windows* — routes that DO NOT EXIST on that service; its only
// processing endpoint is an explicit 501 (services/mojaloop-settlement-mgr-go
// handleProcess). There is no real settlement executor in the fleet today.
// Rather than calling fiction (or failing EOD forever on a 501 scaffold), the
// step is recorded as explicitly SKIPPED with an operator-visible reason, and
// the run continues. Re-enable a real call here only when a settlement
// executor with real window close/settle routes is deployed.
func executeSettlement(runID int, tid, businessDate string) (int, error) {
	recID := stepStarted(runID, "STEP-004", "Settlement Finalize")
	note := "skipped: no settlement executor deployed — mojaloop-settlement-mgr-go is a 501 scaffold with no /v1/settlement/windows routes; refusing to call fiction"
	stepSkipped(recID, note)
	log.Printf("EOD run=%d STEP-004 %s (date=%s tenant=%s)", runID, note, businessDate, tid)
	return 0, nil
}

// STEP-005: Verify GL trial balance debits == credits.
// MN-24/F2-01: previously called gl-engine-rs:8251 GET /v1/gl/trial-balance —
// wrong service AND wrong method (gl-engine-rs :8101 serves that route
// POST-only). The real read endpoint is gl-engine-go GET
// /v1/gl/trial-balance?tenantId=..., which returns persisted trial-balance
// rows {items: [{total_debits_kobo, total_credits_kobo, ...}]}. EOD sums the
// integer kobo columns and requires exact debit == credit equality.
func executeGLBalanceCheck(runID int, tid, businessDate string) (int, error) {
	recID := stepStarted(runID, "STEP-005", "GL Balance Check")
	glURL := getEnv("GL_ENGINE_URL", "http://gl-engine-go:8080")

	code, body, err := callService("GET",
		fmt.Sprintf("%s/v1/gl/trial-balance?tenantId=%s", glURL, tid), tid, nil)
	if err != nil {
		stepFailed(recID, "STEP-005", err.Error())
		return 0, fmt.Errorf("GL trial balance call: %w", err)
	}
	if code != 200 {
		msg := fmt.Sprintf("GL trial balance HTTP %d: %s", code, string(body))
		stepFailed(recID, "STEP-005", msg)
		return 0, fmt.Errorf("%s", msg)
	}

	var tbResult struct {
		Items []struct {
			GLAccountCode      string `json:"glAccountCode"`
			TotalDebitsKobo    int64  `json:"total_debits_kobo"`
			TotalCreditsKobo   int64  `json:"total_credits_kobo"`
			ClosingBalanceKobo int64  `json:"closing_balance_kobo"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(body, &tbResult); err != nil {
		msg := fmt.Sprintf("GL trial balance unparseable response: %v", err)
		stepFailed(recID, "STEP-005", msg)
		return 0, fmt.Errorf("%s", msg)
	}
	if len(tbResult.Items) == 0 {
		// Fail-closed: with no trial-balance rows the balance check cannot be
		// verified, so the step must NOT pass silently.
		msg := "GL trial balance returned zero rows — balance cannot be verified (fail-closed)"
		stepFailed(recID, "STEP-005", msg)
		return 0, fmt.Errorf("%s", msg)
	}

	// Integer kobo comparison — no float money.
	var totalDebit, totalCredit int64
	for _, it := range tbResult.Items {
		totalDebit += it.TotalDebitsKobo
		totalCredit += it.TotalCreditsKobo
	}
	if totalDebit != totalCredit {
		msg := fmt.Sprintf("GL OUT OF BALANCE: debitKobo=%d creditKobo=%d diffKobo=%d",
			totalDebit, totalCredit, totalDebit-totalCredit)
		stepFailed(recID, "STEP-005", msg)
		return 0, fmt.Errorf("%s", msg)
	}

	stepDone(recID, len(tbResult.Items), map[string]interface{}{
		"accountsChecked":  len(tbResult.Items),
		"totalDebitsKobo":  totalDebit,
		"totalCreditsKobo": totalCredit,
		"businessDate":     businessDate,
	})
	log.Printf("EOD run=%d STEP-005 GL balanced accounts=%d debitKobo=%d creditKobo=%d",
		runID, len(tbResult.Items), totalDebit, totalCredit)
	return len(tbResult.Items), nil
}

// STEP-006: Request NFIU CTR extract for business date
func executeCTRExtract(runID int, tid, businessDate string) (int, error) {
	recID := stepStarted(runID, "STEP-006", "CTR/Regulatory Extract")
	nfiuURL := getEnv("NFIU_CTR_STR_URL", "http://nfiu-ctr-str-filing-py:8283")

	code, body, err := callService("GET",
		fmt.Sprintf("%s/api/ctrs?date=%s&status=pending", nfiuURL, businessDate),
		tid, nil)
	if err != nil {
		// NFIU service being down does not fail EOD — log and continue
		log.Printf("EOD run=%d STEP-006 NFIU unavailable: %v (non-fatal)", runID, err)
		stepDone(recID, 0, map[string]string{"note": "NFIU service unavailable — deferred"})
		return 0, nil
	}
	if code == 200 {
		var ctrResp struct {
			Total int `json:"total"`
		}
		json.Unmarshal(body, &ctrResp)
		stepDone(recID, ctrResp.Total, map[string]interface{}{
			"ctrsPendingFiling": ctrResp.Total, "extractDate": businessDate,
		})
		log.Printf("EOD run=%d STEP-006 CTR extract date=%s pending=%d", runID, businessDate, ctrResp.Total)
		return ctrResp.Total, nil
	}

	stepDone(recID, 0, map[string]string{"httpStatus": fmt.Sprintf("%d", code)})
	return 0, nil
}

// STEP-007: Publish eod.completed event
func executeAuditFinalization(runID int, tid, businessDate string) (int, error) {
	recID := stepStarted(runID, "STEP-007", "Audit Finalization")

	payload := map[string]interface{}{
		"runId":        runID,
		"tenantId":     tid,
		"businessDate": businessDate,
		"completedAt":  time.Now().UTC().Format(time.RFC3339),
	}
	publishEvent("eod.completed", payload)
	stepDone(recID, 1, payload)
	log.Printf("EOD run=%d STEP-007 audit event published", runID)
	return 1, nil
}

// STEP-008: EOFI mark — EOD is done
func executeEOFI(runID int, tid, businessDate string) (int, error) {
	recID := stepStarted(runID, "STEP-008", "EOFI Mark — unlock for next date")
	stepDone(recID, 1, map[string]string{
		"eofiAt": time.Now().UTC().Format(time.RFC3339), "businessDate": businessDate,
	})
	log.Printf("EOD run=%d STEP-008 EOFI marked date=%s", runID, businessDate)
	return 1, nil
}

// ── Core Pipeline ─────────────────────────────────────────────────────────────

func runEOD(runID int, tid, businessDate string) {
	type executor struct {
		fn func(int, string, string) (int, error)
	}
	steps := []executor{
		{executeEOTI},
		{executeInterestAccrual},
		{executeReconciliation},
		{executeSettlement},
		{executeGLBalanceCheck},
		{executeCTRExtract},
		{executeAuditFinalization},
		{executeEOFI},
	}

	// Initialise step records
	db.Exec("UPDATE eod_runs SET total_steps=$1 WHERE id=$2", len(steps), runID)

	failedAny := false
	for i, step := range steps {
		log.Printf("EOD run=%d executing step %d/%d", runID, i+1, len(steps))
		_, err := step.fn(runID, tid, businessDate)
		if err != nil {
			log.Printf("EOD run=%d step %d FAILED: %v", runID, i+1, err)
			failedAny = true
			// Steps 001–005 are hard-required; failures abort the run
			// Steps 006–008 are best-effort
			if i < 5 {
				// MN-24: eod_run_failures_total is incremented by stepFailed for
				// every failed step (hard or soft); here we only mark the run
				// failed and hard-abort (fail-closed semantics unchanged).
				db.Exec(`UPDATE eod_runs SET status='failed', completed_at=now(),
					error_summary=$1 WHERE id=$2`, err.Error(), runID)
				return
			}
		}
	}

	finalStatus := "completed"
	if failedAny {
		finalStatus = "completed_with_errors"
	}
	db.Exec(`UPDATE eod_runs SET status=$1, completed_at=now() WHERE id=$2`, finalStatus, runID)
	log.Printf("EOD run=%d FINISHED status=%s date=%s", runID, finalStatus, businessDate)
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	dbOK := db.Ping() == nil
	status := "healthy"
	code := http.StatusOK
	if !dbOK {
		status = "degraded"
		code = http.StatusServiceUnavailable
	}
	writeJSON(w, code, map[string]interface{}{
		"service":  "eod-processor-go",
		"status":   status,
		"checks":   map[string]string{"postgres": boolStatus(dbOK)},
		"pipeline": map[string]int{"steps": len(pipeline)},
	})
}

func boolStatus(ok bool) string {
	if ok {
		return "connected"
	}
	return "unreachable"
}

// POST /v1/eod/trigger
func handleTrigger(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errorJSON(w, http.StatusMethodNotAllowed, "POST required")
		return
	}
	tid := tenantID(r)
	if tid == "" {
		errorJSON(w, http.StatusBadRequest, "x-tenant-id required")
		return
	}
	initiatedBy := r.Header.Get("x-keycloak-id")
	if initiatedBy == "" {
		initiatedBy = "system"
	}
	// PBAC: only users with eod:trigger permission may start the batch pipeline
	if !pbacCheck(tid, initiatedBy, "eod:trigger", "financial_operation") {
		errorJSON(w, http.StatusForbidden, "forbidden: eod:trigger permission required")
		return
	}

	var body struct {
		BusinessDate string `json:"businessDate"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.BusinessDate == "" {
		// Default to yesterday (EOD processes the previous business day)
		body.BusinessDate = time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
	}

	// Idempotency: if a run already exists for this date, return it
	var existingID int
	var existingStatus string
	err := db.QueryRow(
		"SELECT id, status FROM eod_runs WHERE tenant_id=$1 AND business_date=$2",
		tid, body.BusinessDate,
	).Scan(&existingID, &existingStatus)
	if err == nil {
		writeJSON(w, http.StatusConflict, map[string]interface{}{
			"error":        "EOD run already exists for this business date",
			"runId":        existingID,
			"status":       existingStatus,
			"businessDate": body.BusinessDate,
		})
		return
	}
	if err != sql.ErrNoRows {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	var runID int
	err = db.QueryRow(`
		INSERT INTO eod_runs (tenant_id, business_date, initiated_by)
		VALUES ($1,$2,$3)
		RETURNING id`, tid, body.BusinessDate, initiatedBy,
	).Scan(&runID)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Execute pipeline asynchronously
	go runEOD(runID, tid, body.BusinessDate)

	log.Printf("EOD triggered run=%d date=%s by=%s", runID, body.BusinessDate, initiatedBy)
	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"runId":        runID,
		"businessDate": body.BusinessDate,
		"status":       "running",
		"initiatedBy":  initiatedBy,
	})
}

// GET /v1/eod/runs
func handleListRuns(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		errorJSON(w, http.StatusBadRequest, "x-tenant-id required")
		return
	}
	rows, err := db.Query(`
		SELECT id, business_date, status, initiated_by, approved_by,
		       started_at, completed_at, total_steps, completed_steps, failed_steps
		FROM eod_runs WHERE tenant_id=$1
		ORDER BY business_date DESC LIMIT 30`, tid)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var items []map[string]interface{}
	for rows.Next() {
		var id, totalSteps, completedSteps, failedSteps int
		var businessDate, status, initiatedBy string
		var approvedBy sql.NullString
		var startedAt time.Time
		var completedAt sql.NullTime
		rows.Scan(&id, &businessDate, &status, &initiatedBy, &approvedBy,
			&startedAt, &completedAt, &totalSteps, &completedSteps, &failedSteps)
		item := map[string]interface{}{
			"id": id, "businessDate": businessDate, "status": status,
			"initiatedBy": initiatedBy,
			"startedAt":   startedAt.Format(time.RFC3339),
			"totalSteps":  totalSteps, "completedSteps": completedSteps, "failedSteps": failedSteps,
		}
		if approvedBy.Valid {
			item["approvedBy"] = approvedBy.String
		}
		if completedAt.Valid {
			item["completedAt"] = completedAt.Time.Format(time.RFC3339)
		}
		items = append(items, item)
	}
	if items == nil {
		items = []map[string]interface{}{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

// GET /v1/eod/runs/{id}
func handleGetRun(w http.ResponseWriter, r *http.Request, runIDStr string) {
	tid := tenantID(r)
	if tid == "" {
		errorJSON(w, http.StatusBadRequest, "x-tenant-id required")
		return
	}
	var id int
	fmt.Sscanf(runIDStr, "%d", &id)

	var businessDate, status, initiatedBy string
	var approvedBy sql.NullString
	var startedAt time.Time
	var completedAt sql.NullTime
	var totalSteps, completedSteps, failedSteps int
	var errorSummary sql.NullString

	err := db.QueryRow(`
		SELECT id, business_date, status, initiated_by, approved_by,
		       started_at, completed_at, total_steps, completed_steps, failed_steps, error_summary
		FROM eod_runs WHERE id=$1 AND tenant_id=$2`, id, tid,
	).Scan(&id, &businessDate, &status, &initiatedBy, &approvedBy,
		&startedAt, &completedAt, &totalSteps, &completedSteps, &failedSteps, &errorSummary)
	if err == sql.ErrNoRows {
		errorJSON(w, http.StatusNotFound, "EOD run not found")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Load steps
	stepRows, err := db.Query(`
		SELECT step_id, step_name, status, started_at, completed_at,
		       records_processed, error_message, result_json
		FROM eod_step_records WHERE run_id=$1 ORDER BY id`, id)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer stepRows.Close()

	var steps []map[string]interface{}
	for stepRows.Next() {
		var stepID, stepName, stepStatus string
		var stepStarted sql.NullTime
		var stepCompleted sql.NullTime
		var recordsProcessed int
		var errMsg, resultJSON sql.NullString
		stepRows.Scan(&stepID, &stepName, &stepStatus, &stepStarted, &stepCompleted,
			&recordsProcessed, &errMsg, &resultJSON)
		s := map[string]interface{}{
			"stepId": stepID, "stepName": stepName, "status": stepStatus,
			"recordsProcessed": recordsProcessed,
		}
		if stepStarted.Valid {
			s["startedAt"] = stepStarted.Time.Format(time.RFC3339)
		}
		if stepCompleted.Valid {
			s["completedAt"] = stepCompleted.Time.Format(time.RFC3339)
			if stepStarted.Valid {
				s["durationSeconds"] = stepCompleted.Time.Sub(stepStarted.Time).Seconds()
			}
		}
		if errMsg.Valid {
			s["errorMessage"] = errMsg.String
		}
		if resultJSON.Valid && resultJSON.String != "" {
			var result interface{}
			if json.Unmarshal([]byte(resultJSON.String), &result) == nil {
				s["result"] = result
			}
		}
		steps = append(steps, s)
	}
	if steps == nil {
		steps = []map[string]interface{}{}
	}

	run := map[string]interface{}{
		"id": id, "businessDate": businessDate, "status": status,
		"initiatedBy": initiatedBy, "startedAt": startedAt.Format(time.RFC3339),
		"totalSteps": totalSteps, "completedSteps": completedSteps, "failedSteps": failedSteps,
		"steps": steps,
	}
	if approvedBy.Valid {
		run["approvedBy"] = approvedBy.String
	}
	if completedAt.Valid {
		run["completedAt"] = completedAt.Time.Format(time.RFC3339)
	}
	if errorSummary.Valid {
		run["errorSummary"] = errorSummary.String
	}
	writeJSON(w, http.StatusOK, run)
}

// GET /v1/eod/pipeline
func handlePipeline(w http.ResponseWriter, r *http.Request) {
	var steps []map[string]interface{}
	for i, s := range pipeline {
		steps = append(steps, map[string]interface{}{
			"id": s.ID, "name": s.Name, "order": i + 1, "dependsOn": s.DependsOn,
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"steps": steps, "total": len(steps)})
}

// ── Router ────────────────────────────────────────────────────────────────────

func corsMiddleware(next http.Handler) http.Handler {
	origins := allowedOrigins()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origins)
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization,x-tenant-id,x-keycloak-id,x-user-role,x-request-id")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "eod-processor-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "eod-processor-go")
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
	shutdown, oerr := otelkit.Init(context.Background(), "eod-processor-go")
	if oerr != nil {
		log.Fatalf("otelkit init: %v", oerr)
	}
	defer func() {
		sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if serr := shutdown(sctx); serr != nil {
			log.Printf("otelkit shutdown: %v", serr)
		}
	}()
	startJWKSRefresh()

	initDB()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/v1/eod/trigger", handleTrigger)
	mux.HandleFunc("/v1/eod/pipeline", handlePipeline)
	mux.HandleFunc("/v1/eod/runs", handleListRuns)
	mux.HandleFunc("/v1/eod/runs/", func(w http.ResponseWriter, r *http.Request) {
		runIDStr := strings.TrimPrefix(r.URL.Path, "/v1/eod/runs/")
		if runIDStr == "" {
			handleListRuns(w, r)
			return
		}
		handleGetRun(w, r, runIDStr)
	})

	port := getEnv("PORT", "8207")
	log.Printf("eod-processor-go listening on :%s — %d pipeline steps", port, len(pipeline))
	log.Fatal(http.ListenAndServe(":"+port, otelkit.HTTPMiddleware(rateLimitMiddleware(jwtAuthMiddleware(countingMiddleware(corsMiddleware(mux)))))))
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
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"eod-processor-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"eod-processor-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"eod-processor-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"eod-processor-go"}`)
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
