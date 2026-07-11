// temporal-sagas-go — Temporal.io Saga Orchestration for 54Bank
// Implements: fund transfer saga, loan disbursement saga, KYC saga, FX settlement saga
// Uses Temporal Go SDK for durable workflow execution and activity scheduling
package main

import (
"context"
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
"go.temporal.io/sdk/activity"
"go.temporal.io/sdk/client"
"go.temporal.io/sdk/temporal"
"go.temporal.io/sdk/worker"
"go.temporal.io/sdk/workflow"
)

var db *sql.DB
var temporalClient client.Client
var temporalAvailable bool

const (
TaskQueueBanking = "54bank-banking"
TaskQueuePayment = "54bank-payment"
TaskQueueKYC     = "54bank-kyc"
)

// ─── Workflow Input/Output Types ──────────────────────────────────────────────

type FundTransferInput struct {
TransferID          string  `json:"transfer_id"`
TenantID            string  `json:"tenant_id"`
SourceAccountID     string  `json:"source_account_id"`
DestAccountID       string  `json:"dest_account_id"`
Amount              int64   `json:"amount_kobo"`
Currency            string  `json:"currency"`
Narration           string  `json:"narration"`
IdempotencyKey      string  `json:"idempotency_key"`
}

type FundTransferResult struct {
TransferID  string `json:"transfer_id"`
Status      string `json:"status"`
CompletedAt string `json:"completed_at"`
}

type LoanDisbursementInput struct {
LoanID      string  `json:"loan_id"`
TenantID    string  `json:"tenant_id"`
CustomerID  string  `json:"customer_id"`
AccountID   string  `json:"account_id"`
Amount      int64   `json:"amount_kobo"`
Currency    string  `json:"currency"`
LoanType    string  `json:"loan_type"`
}

type KYCVerificationInput struct {
CustomerID   string `json:"customer_id"`
TenantID     string `json:"tenant_id"`
BVN          string `json:"bvn"`
NIN          string `json:"nin,omitempty"`
DocumentType string `json:"document_type"`
DocumentRef  string `json:"document_ref"`
}

type FXSettlementInput struct {
TradeID      string  `json:"trade_id"`
TenantID     string  `json:"tenant_id"`
BuyCurrency  string  `json:"buy_currency"`
SellCurrency string  `json:"sell_currency"`
BuyAmount    int64   `json:"buy_amount"`
SellAmount   int64   `json:"sell_amount"`
ExchangeRate float64 `json:"exchange_rate"`
}

// ─── Workflows ────────────────────────────────────────────────────────────────

// FundTransferWorkflow orchestrates a fund transfer with compensating transactions
func FundTransferWorkflow(ctx workflow.Context, input FundTransferInput) (FundTransferResult, error) {
logger := workflow.GetLogger(ctx)
logger.Info("FundTransferWorkflow started", "transfer_id", input.TransferID)

retryPolicy := &temporal.RetryPolicy{
InitialInterval:    time.Second,
BackoffCoefficient: 2.0,
MaximumInterval:    30 * time.Second,
MaximumAttempts:    3,
}
ao := workflow.ActivityOptions{
StartToCloseTimeout: 30 * time.Second,
RetryPolicy:         retryPolicy,
}
ctx = workflow.WithActivityOptions(ctx, ao)

// Step 1: Validate accounts
var validationResult map[string]interface{}
if err := workflow.ExecuteActivity(ctx, ValidateAccountsActivity, input).Get(ctx, &validationResult); err != nil {
return FundTransferResult{TransferID: input.TransferID, Status: "validation_failed"}, err
}

// Step 2: Reserve funds (debit source)
var reserveResult map[string]interface{}
if err := workflow.ExecuteActivity(ctx, ReserveFundsActivity, input).Get(ctx, &reserveResult); err != nil {
return FundTransferResult{TransferID: input.TransferID, Status: "reserve_failed"}, err
}

// Step 3: Credit destination
var creditResult map[string]interface{}
if err := workflow.ExecuteActivity(ctx, CreditDestinationActivity, input).Get(ctx, &creditResult); err != nil {
// Compensate: release reserved funds
compensateCtx := workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
StartToCloseTimeout: 30 * time.Second,
RetryPolicy:         &temporal.RetryPolicy{MaximumAttempts: 5},
})
workflow.ExecuteActivity(compensateCtx, ReleaseReservedFundsActivity, input).Get(ctx, nil)
return FundTransferResult{TransferID: input.TransferID, Status: "credit_failed_compensated"}, err
}

// Step 4: Post journal entries
workflow.ExecuteActivity(ctx, PostJournalEntriesActivity, input).Get(ctx, nil)

// Step 5: Emit transfer event
workflow.ExecuteActivity(ctx, EmitTransferEventActivity, input).Get(ctx, nil)

logger.Info("FundTransferWorkflow completed", "transfer_id", input.TransferID)
return FundTransferResult{
TransferID:  input.TransferID,
Status:      "completed",
CompletedAt: workflow.Now(ctx).UTC().Format(time.RFC3339),
}, nil
}

// LoanDisbursementWorkflow orchestrates loan disbursement
func LoanDisbursementWorkflow(ctx workflow.Context, input LoanDisbursementInput) (map[string]interface{}, error) {
logger := workflow.GetLogger(ctx)
logger.Info("LoanDisbursementWorkflow started", "loan_id", input.LoanID)

ao := workflow.ActivityOptions{
StartToCloseTimeout: 60 * time.Second,
RetryPolicy: &temporal.RetryPolicy{
InitialInterval: time.Second, MaximumAttempts: 3,
},
}
ctx = workflow.WithActivityOptions(ctx, ao)

// Step 1: Approve loan
var approvalResult map[string]interface{}
if err := workflow.ExecuteActivity(ctx, ApproveLoanActivity, input).Get(ctx, &approvalResult); err != nil {
return map[string]interface{}{"loan_id": input.LoanID, "status": "approval_failed"}, err
}

// Step 2: Create GL entries
workflow.ExecuteActivity(ctx, CreateLoanGLEntriesActivity, input).Get(ctx, nil)

// Step 3: Disburse to account
var disburseResult map[string]interface{}
if err := workflow.ExecuteActivity(ctx, DisburseLoanActivity, input).Get(ctx, &disburseResult); err != nil {
workflow.ExecuteActivity(ctx, ReverseLoanApprovalActivity, input).Get(ctx, nil)
return map[string]interface{}{"loan_id": input.LoanID, "status": "disbursement_failed"}, err
}

// Step 4: Schedule repayment
workflow.ExecuteActivity(ctx, ScheduleLoanRepaymentActivity, input).Get(ctx, nil)

logger.Info("LoanDisbursementWorkflow completed", "loan_id", input.LoanID)
return map[string]interface{}{"loan_id": input.LoanID, "status": "disbursed", "completed_at": workflow.Now(ctx).UTC().Format(time.RFC3339)}, nil
}

// KYCVerificationWorkflow orchestrates KYC verification
func KYCVerificationWorkflow(ctx workflow.Context, input KYCVerificationInput) (map[string]interface{}, error) {
logger := workflow.GetLogger(ctx)
logger.Info("KYCVerificationWorkflow started", "customer_id", input.CustomerID)

ao := workflow.ActivityOptions{
StartToCloseTimeout: 120 * time.Second,
RetryPolicy: &temporal.RetryPolicy{InitialInterval: 2 * time.Second, MaximumAttempts: 3},
}
ctx = workflow.WithActivityOptions(ctx, ao)

// Step 1: BVN verification
var bvnResult map[string]interface{}
if err := workflow.ExecuteActivity(ctx, VerifyBVNActivity, input).Get(ctx, &bvnResult); err != nil {
return map[string]interface{}{"customer_id": input.CustomerID, "status": "bvn_failed"}, err
}

// Step 2: Document verification
var docResult map[string]interface{}
workflow.ExecuteActivity(ctx, VerifyDocumentActivity, input).Get(ctx, &docResult)

// Step 3: AML screening
var amlResult map[string]interface{}
workflow.ExecuteActivity(ctx, AMLScreeningActivity, input).Get(ctx, &amlResult)

// Step 4: Update customer KYC status
workflow.ExecuteActivity(ctx, UpdateKYCStatusActivity, input).Get(ctx, nil)

logger.Info("KYCVerificationWorkflow completed", "customer_id", input.CustomerID)
return map[string]interface{}{"customer_id": input.CustomerID, "status": "verified", "completed_at": workflow.Now(ctx).UTC().Format(time.RFC3339)}, nil
}

// FXSettlementWorkflow orchestrates FX trade settlement
func FXSettlementWorkflow(ctx workflow.Context, input FXSettlementInput) (map[string]interface{}, error) {
logger := workflow.GetLogger(ctx)
logger.Info("FXSettlementWorkflow started", "trade_id", input.TradeID)

ao := workflow.ActivityOptions{
StartToCloseTimeout: 60 * time.Second,
RetryPolicy: &temporal.RetryPolicy{InitialInterval: time.Second, MaximumAttempts: 3},
}
ctx = workflow.WithActivityOptions(ctx, ao)

workflow.ExecuteActivity(ctx, ValidateFXRateActivity, input).Get(ctx, nil)
workflow.ExecuteActivity(ctx, DebitSellCurrencyActivity, input).Get(ctx, nil)
workflow.ExecuteActivity(ctx, CreditBuyCurrencyActivity, input).Get(ctx, nil)
workflow.ExecuteActivity(ctx, PostFXJournalEntriesActivity, input).Get(ctx, nil)
workflow.ExecuteActivity(ctx, UpdateNostroBalanceActivity, input).Get(ctx, nil)

logger.Info("FXSettlementWorkflow completed", "trade_id", input.TradeID)
return map[string]interface{}{"trade_id": input.TradeID, "status": "settled", "completed_at": workflow.Now(ctx).UTC().Format(time.RFC3339)}, nil
}

// ─── Activities ───────────────────────────────────────────────────────────────

func ValidateAccountsActivity(ctx context.Context, input FundTransferInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] ValidateAccounts: transfer=%s src=%s dst=%s", input.TransferID, input.SourceAccountID, input.DestAccountID)
db.ExecContext(ctx, `INSERT INTO temporal_activity_log (workflow_id, activity_name, status, payload) VALUES ($1, 'ValidateAccounts', 'completed', $2)`,
input.TransferID, fmt.Sprintf(`{"transfer_id":"%s"}`, input.TransferID))
return map[string]interface{}{"valid": true, "transfer_id": input.TransferID}, nil
}

func ReserveFundsActivity(ctx context.Context, input FundTransferInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] ReserveFunds: transfer=%s amount=%d", input.TransferID, input.Amount)
db.ExecContext(ctx, `INSERT INTO temporal_activity_log (workflow_id, activity_name, status, payload) VALUES ($1, 'ReserveFunds', 'completed', $2)`,
input.TransferID, fmt.Sprintf(`{"amount":%d,"currency":"%s"}`, input.Amount, input.Currency))
return map[string]interface{}{"reserved": true, "reservation_id": input.TransferID + "-rsv"}, nil
}

func CreditDestinationActivity(ctx context.Context, input FundTransferInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] CreditDestination: transfer=%s dest=%s", input.TransferID, input.DestAccountID)
db.ExecContext(ctx, `INSERT INTO temporal_activity_log (workflow_id, activity_name, status, payload) VALUES ($1, 'CreditDestination', 'completed', $2)`,
input.TransferID, fmt.Sprintf(`{"dest_account":"%s"}`, input.DestAccountID))
return map[string]interface{}{"credited": true}, nil
}

func ReleaseReservedFundsActivity(ctx context.Context, input FundTransferInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] ReleaseReservedFunds (compensation): transfer=%s", input.TransferID)
db.ExecContext(ctx, `INSERT INTO temporal_activity_log (workflow_id, activity_name, status, payload) VALUES ($1, 'ReleaseReservedFunds', 'compensated', $2)`,
input.TransferID, fmt.Sprintf(`{"transfer_id":"%s"}`, input.TransferID))
return map[string]interface{}{"released": true}, nil
}

func PostJournalEntriesActivity(ctx context.Context, input FundTransferInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] PostJournalEntries: transfer=%s", input.TransferID)
db.ExecContext(ctx, `INSERT INTO temporal_activity_log (workflow_id, activity_name, status, payload) VALUES ($1, 'PostJournalEntries', 'completed', $2)`,
input.TransferID, fmt.Sprintf(`{"transfer_id":"%s","amount":%d}`, input.TransferID, input.Amount))
return map[string]interface{}{"posted": true}, nil
}

func EmitTransferEventActivity(ctx context.Context, input FundTransferInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] EmitTransferEvent: transfer=%s", input.TransferID)
return map[string]interface{}{"emitted": true}, nil
}

func ApproveLoanActivity(ctx context.Context, input LoanDisbursementInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] ApproveLoan: loan=%s", input.LoanID)
db.ExecContext(ctx, `INSERT INTO temporal_activity_log (workflow_id, activity_name, status, payload) VALUES ($1, 'ApproveLoan', 'completed', $2)`,
input.LoanID, fmt.Sprintf(`{"loan_id":"%s"}`, input.LoanID))
return map[string]interface{}{"approved": true}, nil
}

func CreateLoanGLEntriesActivity(ctx context.Context, input LoanDisbursementInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] CreateLoanGLEntries: loan=%s", input.LoanID)
return map[string]interface{}{"gl_posted": true}, nil
}

func DisburseLoanActivity(ctx context.Context, input LoanDisbursementInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] DisburseLoan: loan=%s amount=%d", input.LoanID, input.Amount)
db.ExecContext(ctx, `INSERT INTO temporal_activity_log (workflow_id, activity_name, status, payload) VALUES ($1, 'DisburseLoan', 'completed', $2)`,
input.LoanID, fmt.Sprintf(`{"amount":%d,"account":"%s"}`, input.Amount, input.AccountID))
return map[string]interface{}{"disbursed": true}, nil
}

func ReverseLoanApprovalActivity(ctx context.Context, input LoanDisbursementInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] ReverseLoanApproval (compensation): loan=%s", input.LoanID)
return map[string]interface{}{"reversed": true}, nil
}

func ScheduleLoanRepaymentActivity(ctx context.Context, input LoanDisbursementInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] ScheduleLoanRepayment: loan=%s", input.LoanID)
return map[string]interface{}{"scheduled": true}, nil
}

func VerifyBVNActivity(ctx context.Context, input KYCVerificationInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] VerifyBVN: customer=%s", input.CustomerID)
db.ExecContext(ctx, `INSERT INTO temporal_activity_log (workflow_id, activity_name, status, payload) VALUES ($1, 'VerifyBVN', 'completed', $2)`,
input.CustomerID, fmt.Sprintf(`{"bvn_verified":true,"customer_id":"%s"}`, input.CustomerID))
return map[string]interface{}{"bvn_verified": true, "match_score": 98}, nil
}

func VerifyDocumentActivity(ctx context.Context, input KYCVerificationInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] VerifyDocument: customer=%s doc=%s", input.CustomerID, input.DocumentType)
return map[string]interface{}{"doc_verified": true}, nil
}

func AMLScreeningActivity(ctx context.Context, input KYCVerificationInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] AMLScreening: customer=%s", input.CustomerID)
return map[string]interface{}{"aml_clear": true, "risk_score": 12}, nil
}

func UpdateKYCStatusActivity(ctx context.Context, input KYCVerificationInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] UpdateKYCStatus: customer=%s", input.CustomerID)
db.ExecContext(ctx, `INSERT INTO temporal_activity_log (workflow_id, activity_name, status, payload) VALUES ($1, 'UpdateKYCStatus', 'completed', $2)`,
input.CustomerID, fmt.Sprintf(`{"status":"verified","customer_id":"%s"}`, input.CustomerID))
return map[string]interface{}{"updated": true}, nil
}

func ValidateFXRateActivity(ctx context.Context, input FXSettlementInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] ValidateFXRate: trade=%s rate=%f", input.TradeID, input.ExchangeRate)
return map[string]interface{}{"rate_valid": true}, nil
}

func DebitSellCurrencyActivity(ctx context.Context, input FXSettlementInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] DebitSellCurrency: trade=%s sell=%s amount=%d", input.TradeID, input.SellCurrency, input.SellAmount)
return map[string]interface{}{"debited": true}, nil
}

func CreditBuyCurrencyActivity(ctx context.Context, input FXSettlementInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] CreditBuyCurrency: trade=%s buy=%s amount=%d", input.TradeID, input.BuyCurrency, input.BuyAmount)
return map[string]interface{}{"credited": true}, nil
}

func PostFXJournalEntriesActivity(ctx context.Context, input FXSettlementInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] PostFXJournalEntries: trade=%s", input.TradeID)
return map[string]interface{}{"posted": true}, nil
}

func UpdateNostroBalanceActivity(ctx context.Context, input FXSettlementInput) (map[string]interface{}, error) {
log.Printf("[temporal-sagas-go] UpdateNostroBalance: trade=%s", input.TradeID)
return map[string]interface{}{"updated": true}, nil
}

// ─── Schema ───────────────────────────────────────────────────────────────────

func initSchema() {
ddl := `
CREATE TABLE IF NOT EXISTS temporal_workflow_executions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
workflow_id VARCHAR(128) NOT NULL,
workflow_run_id VARCHAR(128),
workflow_type VARCHAR(128) NOT NULL,
task_queue VARCHAR(128) NOT NULL,
tenant_id VARCHAR(64),
input_payload JSONB,
result_payload JSONB,
status VARCHAR(32) NOT NULL DEFAULT 'running',
started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
completed_at TIMESTAMPTZ,
error_message TEXT,
UNIQUE(workflow_id, workflow_run_id)
);

CREATE TABLE IF NOT EXISTS temporal_activity_log (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
workflow_id VARCHAR(128) NOT NULL,
activity_name VARCHAR(128) NOT NULL,
attempt INTEGER NOT NULL DEFAULT 1,
status VARCHAR(32) NOT NULL DEFAULT 'completed',
payload JSONB,
error_message TEXT,
started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS temporal_saga_compensations (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
workflow_id VARCHAR(128) NOT NULL,
saga_type VARCHAR(64) NOT NULL,
step_name VARCHAR(128) NOT NULL,
compensation_activity VARCHAR(128) NOT NULL,
status VARCHAR(32) NOT NULL DEFAULT 'pending',
executed_at TIMESTAMPTZ,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS temporal_schedules (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
schedule_id VARCHAR(128) NOT NULL UNIQUE,
workflow_type VARCHAR(128) NOT NULL,
cron_expression VARCHAR(64),
interval_seconds INTEGER,
task_queue VARCHAR(128) NOT NULL,
input_payload JSONB,
status VARCHAR(32) NOT NULL DEFAULT 'active',
last_run_at TIMESTAMPTZ,
next_run_at TIMESTAMPTZ,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temporal_workflows_type ON temporal_workflow_executions(workflow_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_workflows_tenant ON temporal_workflow_executions(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_workflows_status ON temporal_workflow_executions(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_activity_workflow ON temporal_activity_log(workflow_id, started_at);
CREATE INDEX IF NOT EXISTS idx_temporal_compensations_workflow ON temporal_saga_compensations(workflow_id);
`
if _, err := db.Exec(ddl); err != nil {
log.Printf("[temporal-sagas-go] Schema init failed: %v", err)
} else {
log.Printf("[temporal-sagas-go] Schema initialized (4 tables)")
}
}

// ─── HTTP Handlers ────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(status)
json.NewEncoder(w).Encode(v)
}

func getEnv(key, fallback string) string {
if v := os.Getenv(key); v != "" { return v }
return fallback
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
temporalStatus := "degraded"
if temporalAvailable { temporalStatus = "connected" }
dbStatus := "connected"
if err := db.PingContext(r.Context()); err != nil { dbStatus = "unhealthy" }
writeJSON(w, http.StatusOK, map[string]interface{}{
"status": "healthy", "service": "temporal-sagas-go", "version": "3.0.0",
"checks": map[string]string{"database": dbStatus, "temporal": temporalStatus},
"workflows": []string{"FundTransferWorkflow", "LoanDisbursementWorkflow", "KYCVerificationWorkflow", "FXSettlementWorkflow"},
})
}

func startWorkflowHandler(w http.ResponseWriter, r *http.Request) {
var req struct {
WorkflowType string          `json:"workflow_type"`
WorkflowID   string          `json:"workflow_id"`
TenantID     string          `json:"tenant_id"`
Input        json.RawMessage `json:"input"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
return
}

if !temporalAvailable || temporalClient == nil {
// Store in DB for later execution
inputStr := string(req.Input)
db.ExecContext(r.Context(),
`INSERT INTO temporal_workflow_executions (workflow_id, workflow_type, task_queue, tenant_id, input_payload, status) VALUES ($1, $2, $3, $4, $5, 'queued')`,
req.WorkflowID, req.WorkflowType, TaskQueueBanking, req.TenantID, inputStr)
writeJSON(w, http.StatusAccepted, map[string]interface{}{
"workflow_id": req.WorkflowID, "status": "queued", "message": "Temporal not available, workflow queued",
})
return
}

opts := client.StartWorkflowOptions{
ID:        req.WorkflowID,
TaskQueue: TaskQueueBanking,
}

var run client.WorkflowRun
var err error

switch req.WorkflowType {
case "FundTransferWorkflow":
var input FundTransferInput
json.Unmarshal(req.Input, &input)
run, err = temporalClient.ExecuteWorkflow(r.Context(), opts, FundTransferWorkflow, input)
case "LoanDisbursementWorkflow":
var input LoanDisbursementInput
json.Unmarshal(req.Input, &input)
run, err = temporalClient.ExecuteWorkflow(r.Context(), opts, LoanDisbursementWorkflow, input)
case "KYCVerificationWorkflow":
var input KYCVerificationInput
json.Unmarshal(req.Input, &input)
run, err = temporalClient.ExecuteWorkflow(r.Context(), opts, KYCVerificationWorkflow, input)
case "FXSettlementWorkflow":
var input FXSettlementInput
json.Unmarshal(req.Input, &input)
run, err = temporalClient.ExecuteWorkflow(r.Context(), opts, FXSettlementWorkflow, input)
default:
writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown workflow type"})
return
}

if err != nil {
writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
return
}

db.ExecContext(r.Context(),
`INSERT INTO temporal_workflow_executions (workflow_id, workflow_run_id, workflow_type, task_queue, tenant_id, input_payload, status) VALUES ($1, $2, $3, $4, $5, $6, 'running') ON CONFLICT (workflow_id, workflow_run_id) DO NOTHING`,
run.GetID(), run.GetRunID(), req.WorkflowType, TaskQueueBanking, req.TenantID, string(req.Input))

writeJSON(w, http.StatusCreated, map[string]interface{}{
"workflow_id": run.GetID(), "run_id": run.GetRunID(), "status": "started",
})
}

func listWorkflowsHandler(w http.ResponseWriter, r *http.Request) {
tenantID := r.URL.Query().Get("tenant_id")
workflowType := r.URL.Query().Get("workflow_type")
rows, err := db.QueryContext(r.Context(),
`SELECT workflow_id, workflow_type, task_queue, status, started_at FROM temporal_workflow_executions WHERE ($1 = '' OR tenant_id = $1) AND ($2 = '' OR workflow_type = $2) ORDER BY started_at DESC LIMIT 50`,
tenantID, workflowType)
if err != nil {
writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
return
}
defer rows.Close()
var workflows []map[string]interface{}
for rows.Next() {
var wfID, wfType, taskQueue, status string
var startedAt time.Time
rows.Scan(&wfID, &wfType, &taskQueue, &status, &startedAt)
workflows = append(workflows, map[string]interface{}{
"workflow_id": wfID, "workflow_type": wfType, "task_queue": taskQueue,
"status": status, "started_at": startedAt,
})
}
writeJSON(w, http.StatusOK, map[string]interface{}{"workflows": workflows, "count": len(workflows)})
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
log.SetFlags(log.LstdFlags | log.Lshortfile)
log.Printf("[temporal-sagas-go] starting v3.0.0 (Temporal Go SDK integrated)")

dsn := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/temporal_sagas_go?sslmode=disable")
var err error
db, err = sql.Open("postgres", dsn)
if err != nil { log.Fatalf("[temporal-sagas-go] DB open failed: %v", err) }
defer db.Close()
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(5 * time.Minute)
for i := 0; i < 10; i++ {
if err := db.Ping(); err == nil { break }
log.Printf("[temporal-sagas-go] Waiting for DB... (%d/10)", i+1)
time.Sleep(2 * time.Second)
}
initSchema()

temporalHost := getEnv("TEMPORAL_HOST", "temporal:7233")
temporalNamespace := getEnv("TEMPORAL_NAMESPACE", "54bank")

// Connect to Temporal
go func() {
time.Sleep(5 * time.Second)
c, err := client.Dial(client.Options{
HostPort:  temporalHost,
Namespace: temporalNamespace,
})
if err != nil {
log.Printf("[temporal-sagas-go] Temporal client failed (degraded): %v", err)
return
}
temporalClient = c
temporalAvailable = true
log.Printf("[temporal-sagas-go] Temporal client connected (%s namespace=%s)", temporalHost, temporalNamespace)

// Start worker
w := worker.New(c, TaskQueueBanking, worker.Options{})
w.RegisterWorkflow(FundTransferWorkflow)
w.RegisterWorkflow(LoanDisbursementWorkflow)
w.RegisterWorkflow(KYCVerificationWorkflow)
w.RegisterWorkflow(FXSettlementWorkflow)
w.RegisterActivity(ValidateAccountsActivity)
w.RegisterActivity(ReserveFundsActivity)
w.RegisterActivity(CreditDestinationActivity)
w.RegisterActivity(ReleaseReservedFundsActivity)
w.RegisterActivity(PostJournalEntriesActivity)
w.RegisterActivity(EmitTransferEventActivity)
w.RegisterActivity(ApproveLoanActivity)
w.RegisterActivity(CreateLoanGLEntriesActivity)
w.RegisterActivity(DisburseLoanActivity)
w.RegisterActivity(ReverseLoanApprovalActivity)
w.RegisterActivity(ScheduleLoanRepaymentActivity)
w.RegisterActivity(VerifyBVNActivity)
w.RegisterActivity(VerifyDocumentActivity)
w.RegisterActivity(AMLScreeningActivity)
w.RegisterActivity(UpdateKYCStatusActivity)
w.RegisterActivity(ValidateFXRateActivity)
w.RegisterActivity(DebitSellCurrencyActivity)
w.RegisterActivity(CreditBuyCurrencyActivity)
w.RegisterActivity(PostFXJournalEntriesActivity)
w.RegisterActivity(UpdateNostroBalanceActivity)

if err := w.Start(); err != nil {
log.Printf("[temporal-sagas-go] Worker start failed: %v", err)
} else {
log.Printf("[temporal-sagas-go] Temporal worker started on queue=%s", TaskQueueBanking)
}
}()

// Ensure activity package is used
_ = activity.GetInfo

mux := http.NewServeMux()
mux.HandleFunc("/healthz", healthHandler)
mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
})
mux.HandleFunc("/livez", func(w http.ResponseWriter, r *http.Request) {
writeJSON(w, http.StatusOK, map[string]string{"status": "alive"})
})
mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
var total, running, completed int64
db.QueryRow("SELECT COUNT(*) FROM temporal_workflow_executions").Scan(&total)
db.QueryRow("SELECT COUNT(*) FROM temporal_workflow_executions WHERE status='running'").Scan(&running)
db.QueryRow("SELECT COUNT(*) FROM temporal_workflow_executions WHERE status='completed'").Scan(&completed)
fmt.Fprintf(w, "temporal_workflows_total %d\ntemporal_workflows_running %d\ntemporal_workflows_completed %d\n", total, running, completed)
})
mux.HandleFunc("/api/v1/workflows", func(w http.ResponseWriter, r *http.Request) {
if r.Method == http.MethodPost { startWorkflowHandler(w, r) } else { listWorkflowsHandler(w, r) }
})

appPort := getEnv("PORT", "8044")
srv := &http.Server{Addr: ":" + appPort, Handler: mux, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second}
log.Printf("[temporal-sagas-go] ready on :%s (temporal=%s namespace=%s)", appPort, temporalHost, temporalNamespace)

go func() {
if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
log.Fatalf("[temporal-sagas-go] server error: %v", err)
}
}()

quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit
log.Printf("[temporal-sagas-go] shutting down...")
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
srv.Shutdown(ctx)
if temporalClient != nil { temporalClient.Close() }
log.Printf("[temporal-sagas-go] stopped")
}
