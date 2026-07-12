// kyb-service — Know Your Business verification for 54Bank
//
// Status lifecycle: DRAFT → UNDER_REVIEW → APPROVED / REJECTED / EXPIRED
//
// Maker-checker: first approver sets first_approver_id; a different user
// calls /finalize to complete approval. Both must have x-keycloak-id header.
//
// External dependencies (called on submit):
//   - cac-realtime-api-go  (Dapr)  GET /api/companies/search?rc=
//   - bvn-nin-verification-go (Dapr) POST /api/bvn/verify
//   - sanctions-screening-service (HTTP) POST /api/screen
//
// On final approval: publishes Dapr event kyb.approved on the configured
// pubsub component so the orchestrator-service can create the business account.
//
// Port: 9166

package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

// ── Environment ────────────────────────────────────────────────────────────────

func ev(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

var (
	port               = ev("PORT", "9166")
	databaseURL        = ev("DATABASE_URL", "")
	daprHost           = ev("DAPR_HOST", "localhost")
	daprPort           = ev("DAPR_HTTP_PORT", "3500")
	daprPubsub         = ev("DAPR_PUBSUB_NAME", "pubsub")
	sanctionsURL       = ev("SANCTIONS_SCREENING_URL", "http://sanctions-screening-service:8283")
	cacAppID           = ev("CAC_SERVICE_APP_ID", "cac-realtime-api-go")
	bvnAppID           = ev("BVN_SERVICE_APP_ID", "bvn-nin-verification-go")
)

func daprInvokeURL(appID, path string) string {
	return fmt.Sprintf("http://%s:%s/v1.0/invoke/%s/method/%s",
		daprHost, daprPort, appID, strings.TrimPrefix(path, "/"))
}

func daprPublishURL(topic string) string {
	return fmt.Sprintf("http://%s:%s/v1.0/publish/%s/%s",
		daprHost, daprPort, daprPubsub, topic)
}

// ── Database ───────────────────────────────────────────────────────────────────

var db *sql.DB

const schema = `
CREATE TABLE IF NOT EXISTS kyb_applications (
    id                 TEXT        PRIMARY KEY,
    business_name      TEXT        NOT NULL,
    rc_number          TEXT        NOT NULL,
    tin                TEXT,
    status             TEXT        NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','under_review','approved','rejected','expired')),
    cac_verified       BOOLEAN     NOT NULL DEFAULT FALSE,
    firs_verified      BOOLEAN     NOT NULL DEFAULT FALSE,
    sanctions_clear    BOOLEAN     NOT NULL DEFAULT TRUE,
    risk_level         TEXT        NOT NULL DEFAULT 'unknown',
    documents          JSONB       NOT NULL DEFAULT '{}',
    directors          JSONB       NOT NULL DEFAULT '[]',
    verification_detail JSONB      NOT NULL DEFAULT '{}',
    tenant_id          TEXT        NOT NULL,
    submitted_by       TEXT,
    first_approver_id  TEXT,
    reviewed_at        TIMESTAMPTZ,
    reviewed_by        TEXT,
    rejection_reason   TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kyb_tenant  ON kyb_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kyb_status  ON kyb_applications(status);
CREATE INDEX IF NOT EXISTS idx_kyb_rc      ON kyb_applications(rc_number);
`

func initDB() error {
	var err error
	db, err = sql.Open("postgres", databaseURL)
	if err != nil {
		return err
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err = db.PingContext(ctx); err != nil {
		return err
	}
	_, err = db.Exec(schema)
	return err
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

var httpClient = &http.Client{Timeout: 10 * time.Second}

func doJSON(method, url string, body interface{}, headers map[string]string, out interface{}) (int, error) {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, err
		}
		reqBody = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if out != nil {
		json.NewDecoder(resp.Body).Decode(out)
	}
	return resp.StatusCode, nil
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func errResp(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func tenantID(r *http.Request) string {
	if v := r.Header.Get("x-tenant-id"); v != "" {
		return v
	}
	return r.Header.Get("x-tenent-id")
}

func keycloakID(r *http.Request) string {
	return r.Header.Get("x-keycloak-id")
}

func newID() string {
	return fmt.Sprintf("KYB-%d", time.Now().UnixNano())
}

// ── Application struct ─────────────────────────────────────────────────────────

type KYBApplication struct {
	ID                 string          `json:"id"`
	BusinessName       string          `json:"business_name"`
	RCNumber           string          `json:"rc_number"`
	TIN                string          `json:"tin"`
	Status             string          `json:"status"`
	CACVerified        bool            `json:"cac_verified"`
	FIRSVerified       bool            `json:"firs_verified"`
	SanctionsClear     bool            `json:"sanctions_clear"`
	RiskLevel          string          `json:"risk_level"`
	Documents          json.RawMessage `json:"documents"`
	Directors          json.RawMessage `json:"directors"`
	VerificationDetail json.RawMessage `json:"verification_detail"`
	TenantID           string          `json:"tenant_id"`
	SubmittedBy        string          `json:"submitted_by"`
	FirstApproverID    string          `json:"first_approver_id,omitempty"`
	ReviewedAt         *time.Time      `json:"reviewed_at,omitempty"`
	ReviewedBy         string          `json:"reviewed_by,omitempty"`
	RejectionReason    string          `json:"rejection_reason,omitempty"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

// ── DB operations ──────────────────────────────────────────────────────────────

func insertApplication(app *KYBApplication) error {
	_, err := db.Exec(`
		INSERT INTO kyb_applications
		  (id, business_name, rc_number, tin, status, cac_verified, firs_verified,
		   sanctions_clear, risk_level, documents, directors, verification_detail,
		   tenant_id, submitted_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		app.ID, app.BusinessName, app.RCNumber, app.TIN, app.Status,
		app.CACVerified, app.FIRSVerified, app.SanctionsClear, app.RiskLevel,
		app.Documents, app.Directors, app.VerificationDetail,
		app.TenantID, app.SubmittedBy,
	)
	return err
}

func getApplication(id, tid string) (*KYBApplication, error) {
	row := db.QueryRow(`
		SELECT id, business_name, rc_number, tin, status, cac_verified, firs_verified,
		       sanctions_clear, risk_level, documents, directors, verification_detail,
		       tenant_id, submitted_by, first_approver_id, reviewed_at, reviewed_by,
		       rejection_reason, created_at, updated_at
		FROM kyb_applications WHERE id=$1 AND tenant_id=$2`, id, tid)

	var app KYBApplication
	var firstApproverID, reviewedBy, rejectionReason sql.NullString
	var reviewedAt sql.NullTime
	err := row.Scan(
		&app.ID, &app.BusinessName, &app.RCNumber, &app.TIN, &app.Status,
		&app.CACVerified, &app.FIRSVerified, &app.SanctionsClear, &app.RiskLevel,
		&app.Documents, &app.Directors, &app.VerificationDetail,
		&app.TenantID, &app.SubmittedBy, &firstApproverID, &reviewedAt,
		&reviewedBy, &rejectionReason, &app.CreatedAt, &app.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if firstApproverID.Valid {
		app.FirstApproverID = firstApproverID.String
	}
	if reviewedAt.Valid {
		app.ReviewedAt = &reviewedAt.Time
	}
	if reviewedBy.Valid {
		app.ReviewedBy = reviewedBy.String
	}
	if rejectionReason.Valid {
		app.RejectionReason = rejectionReason.String
	}
	return &app, nil
}

func listApplications(tid string) ([]KYBApplication, error) {
	rows, err := db.Query(`
		SELECT id, business_name, rc_number, tin, status, cac_verified, firs_verified,
		       sanctions_clear, risk_level, documents, directors, verification_detail,
		       tenant_id, submitted_by, first_approver_id, reviewed_at, reviewed_by,
		       rejection_reason, created_at, updated_at
		FROM kyb_applications WHERE tenant_id=$1 ORDER BY created_at DESC`, tid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []KYBApplication
	for rows.Next() {
		var app KYBApplication
		var firstApproverID, reviewedBy, rejectionReason sql.NullString
		var reviewedAt sql.NullTime
		if err := rows.Scan(
			&app.ID, &app.BusinessName, &app.RCNumber, &app.TIN, &app.Status,
			&app.CACVerified, &app.FIRSVerified, &app.SanctionsClear, &app.RiskLevel,
			&app.Documents, &app.Directors, &app.VerificationDetail,
			&app.TenantID, &app.SubmittedBy, &firstApproverID, &reviewedAt,
			&reviewedBy, &rejectionReason, &app.CreatedAt, &app.UpdatedAt,
		); err != nil {
			continue
		}
		if firstApproverID.Valid {
			app.FirstApproverID = firstApproverID.String
		}
		if reviewedAt.Valid {
			app.ReviewedAt = &reviewedAt.Time
		}
		if reviewedBy.Valid {
			app.ReviewedBy = reviewedBy.String
		}
		if rejectionReason.Valid {
			app.RejectionReason = rejectionReason.String
		}
		apps = append(apps, app)
	}
	return apps, nil
}

// ── External verification calls ────────────────────────────────────────────────

type CACDirector struct {
	Name  string `json:"name"`
	BVN   string `json:"bvn"`
	Role  string `json:"role"`
}

type CACCompany struct {
	RCNumber    string        `json:"rcNumber"`
	CompanyName string        `json:"companyName"`
	Status      string        `json:"status"`
	Directors   []CACDirector `json:"directors"`
}

type SanctionsResult struct {
	Action     string  `json:"action"`
	RiskLevel  string  `json:"risk_level"`
	MatchCount int     `json:"match_count"`
	HighScore  float64 `json:"highest_score"`
}

type BVNResult struct {
	Verified bool   `json:"verified"`
	BVN      string `json:"bvn"`
}

type verificationSummary struct {
	CACVerified    bool          `json:"cac_verified"`
	FIRSVerified   bool          `json:"firs_verified"`
	SanctionsClear bool          `json:"sanctions_clear"`
	RiskLevel      string        `json:"risk_level"`
	Directors      []CACDirector `json:"directors"`
	DirectorBVNs   map[string]bool `json:"director_bvns"`
	SanctionHits   []string      `json:"sanction_hits"`
}

func verifyCAC(rcNumber, tenantID string) (*CACCompany, bool) {
	url := daprInvokeURL(cacAppID, fmt.Sprintf("api/companies/search?rc=%s", rcNumber))
	var company CACCompany
	status, err := doJSON("GET", url, nil, map[string]string{"x-tenant-id": tenantID}, &company)
	if err != nil || status != 200 {
		log.Printf("[kyb] CAC lookup failed rc=%s err=%v status=%d", rcNumber, err, status)
		return nil, false
	}
	verified := strings.EqualFold(company.Status, "active") || strings.EqualFold(company.Status, "registered")
	return &company, verified
}

func screenSanctions(name, tenantID, triggeredBy, appID string) (*SanctionsResult, bool) {
	url := sanctionsURL + "/api/screen"
	body := map[string]string{
		"name":         name,
		"tenant_id":    tenantID,
		"triggered_by": triggeredBy,
		"customer_id":  appID,
		"screen_type":  "kyb",
	}
	var result SanctionsResult
	status, err := doJSON("POST", url, body, nil, &result)
	if err != nil || status != 200 {
		log.Printf("[kyb] Sanctions screen failed name=%q err=%v", name, err)
		// fail-open on service error: flag as requiring review, not as blocked
		return &SanctionsResult{Action: "hold_and_review", RiskLevel: "medium"}, false
	}
	return &result, result.Action == "proceed"
}

func verifyBVN(bvn, tenantID, appID string) bool {
	if bvn == "" {
		return false
	}
	url := daprInvokeURL(bvnAppID, "api/bvn/verify")
	body := map[string]string{
		"bvn":         bvn,
		"tenant_id":   tenantID,
		"customer_id": appID,
	}
	var result BVNResult
	status, err := doJSON("POST", url, body, map[string]string{"x-tenant-id": tenantID}, &result)
	if err != nil || status != 200 {
		log.Printf("[kyb] BVN verify failed bvn=%s err=%v", bvn, err)
		return false
	}
	return result.Verified
}

func publishKYBApproved(app *KYBApplication) {
	payload := map[string]interface{}{
		"applicationId": app.ID,
		"businessName":  app.BusinessName,
		"rcNumber":      app.RCNumber,
		"tin":           app.TIN,
		"tenantId":      app.TenantID,
		"reviewedBy":    app.ReviewedBy,
		"approvedAt":    time.Now().UTC().Format(time.RFC3339),
	}
	_, err := doJSON("POST", daprPublishURL("kyb.approved"), payload, nil, nil)
	if err != nil {
		log.Printf("[kyb] Failed to publish kyb.approved for %s: %v", app.ID, err)
	}
}

// ── Verification orchestration ─────────────────────────────────────────────────

func runVerifications(app *KYBApplication) verificationSummary {
	summary := verificationSummary{
		SanctionsClear: true,
		DirectorBVNs:   make(map[string]bool),
	}

	var mu sync.Mutex
	var wg sync.WaitGroup

	// 1. CAC verification
	wg.Add(1)
	go func() {
		defer wg.Done()
		company, verified := verifyCAC(app.RCNumber, app.TenantID)
		mu.Lock()
		defer mu.Unlock()
		summary.CACVerified = verified
		if company != nil {
			summary.Directors = company.Directors
		}
	}()

	// 2. Business name sanctions screen
	wg.Add(1)
	go func() {
		defer wg.Done()
		result, clear := screenSanctions(app.BusinessName, app.TenantID, "kyb-service", app.ID)
		mu.Lock()
		defer mu.Unlock()
		if !clear {
			summary.SanctionsClear = false
			summary.SanctionHits = append(summary.SanctionHits,
				fmt.Sprintf("business:%s (action=%s score=%.2f)", app.BusinessName, result.Action, result.HighScore))
		}
	}()

	wg.Wait() // wait for CAC and business sanctions before director BVN/sanctions

	// 3. Director sanctions + BVN (parallel, uses directors from CAC)
	var dirWg sync.WaitGroup
	for _, d := range summary.Directors {
		d := d
		dirWg.Add(1)
		go func() {
			defer dirWg.Done()
			sanctionResult, sanctionClear := screenSanctions(d.Name, app.TenantID, "kyb-service", app.ID)
			bvnOK := verifyBVN(d.BVN, app.TenantID, app.ID)
			mu.Lock()
			defer mu.Unlock()
			if !sanctionClear {
				summary.SanctionsClear = false
				summary.SanctionHits = append(summary.SanctionHits,
					fmt.Sprintf("director:%s (action=%s score=%.2f)", d.Name, sanctionResult.Action, sanctionResult.HighScore))
			}
			summary.DirectorBVNs[d.BVN] = bvnOK
		}()
	}
	dirWg.Wait()

	// 4. Compute risk level
	allBVNsVerified := len(summary.Directors) == 0 || func() bool {
		for _, ok := range summary.DirectorBVNs {
			if !ok {
				return false
			}
		}
		return true
	}()

	switch {
	case !summary.SanctionsClear:
		summary.RiskLevel = "high"
	case !summary.CACVerified:
		summary.RiskLevel = "high"
	case !allBVNsVerified:
		summary.RiskLevel = "medium"
	default:
		summary.RiskLevel = "low"
	}

	return summary
}

// ── Handlers ───────────────────────────────────────────────────────────────────

func handleApplications(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		errResp(w, 400, "x-tenant-id header required")
		return
	}

	switch r.Method {
	case http.MethodGet:
		apps, err := listApplications(tid)
		if err != nil {
			log.Printf("[kyb] list error: %v", err)
			errResp(w, 500, "failed to fetch applications")
			return
		}
		if apps == nil {
			apps = []KYBApplication{}
		}
		writeJSON(w, 200, map[string]interface{}{"applications": apps, "total": len(apps)})

	case http.MethodPost:
		var req struct {
			BusinessName string          `json:"business_name"`
			RCNumber     string          `json:"rc_number"`
			TIN          string          `json:"tin"`
			Documents    json.RawMessage `json:"documents"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.BusinessName == "" || req.RCNumber == "" {
			errResp(w, 400, "business_name and rc_number are required")
			return
		}
		docs := req.Documents
		if len(docs) == 0 {
			docs = json.RawMessage("{}")
		}
		app := &KYBApplication{
			ID:           newID(),
			BusinessName: req.BusinessName,
			RCNumber:     req.RCNumber,
			TIN:          req.TIN,
			Status:       "draft",
			SanctionsClear: true,
			RiskLevel:    "unknown",
			Documents:    docs,
			Directors:    json.RawMessage("[]"),
			VerificationDetail: json.RawMessage("{}"),
			TenantID:     tid,
			SubmittedBy:  keycloakID(r),
		}
		if err := insertApplication(app); err != nil {
			log.Printf("[kyb] insert error: %v", err)
			errResp(w, 500, "failed to create application")
			return
		}
		app2, _ := getApplication(app.ID, tid)
		writeJSON(w, 201, app2)

	default:
		errResp(w, 405, "method not allowed")
	}
}

func handleApplicationByID(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		errResp(w, 400, "x-tenant-id header required")
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/v1/kyb/applications/")
	// strip any trailing action suffix
	if idx := strings.Index(id, "/"); idx >= 0 {
		id = id[:idx]
	}

	app, err := getApplication(id, tid)
	if err == sql.ErrNoRows {
		errResp(w, 404, "application not found")
		return
	}
	if err != nil {
		errResp(w, 500, "database error")
		return
	}

	action := ""
	full := strings.TrimPrefix(r.URL.Path, "/v1/kyb/applications/"+id)
	full = strings.TrimPrefix(full, "/")
	if full != "" {
		action = full
	}

	switch {
	case r.Method == http.MethodGet && action == "":
		writeJSON(w, 200, app)

	case r.Method == http.MethodPost && action == "submit":
		handleSubmit(w, app, tid)

	case r.Method == http.MethodPost && action == "approve":
		handleApprove(w, r, app, tid)

	case r.Method == http.MethodPost && action == "finalize":
		handleFinalize(w, r, app, tid)

	case r.Method == http.MethodPost && action == "reject":
		handleReject(w, r, app, tid)

	default:
		errResp(w, 404, "not found")
	}
}

func handleSubmit(w http.ResponseWriter, app *KYBApplication, tid string) {
	if app.Status != "draft" {
		errResp(w, 409, fmt.Sprintf("application is already in status '%s'", app.Status))
		return
	}

	// Run verifications synchronously (they are internally parallel)
	log.Printf("[kyb] Running verifications for %s rc=%s", app.ID, app.RCNumber)
	summary := runVerifications(app)

	directorsJSON, _ := json.Marshal(summary.Directors)
	detailJSON, _ := json.Marshal(summary)

	_, err := db.Exec(`
		UPDATE kyb_applications SET
			status              = 'under_review',
			cac_verified        = $1,
			sanctions_clear     = $2,
			risk_level          = $3,
			directors           = $4,
			verification_detail = $5,
			updated_at          = NOW()
		WHERE id = $6`,
		summary.CACVerified, summary.SanctionsClear, summary.RiskLevel,
		directorsJSON, detailJSON, app.ID,
	)
	if err != nil {
		log.Printf("[kyb] submit update error: %v", err)
		errResp(w, 500, "failed to update application")
		return
	}
	updated, _ := getApplication(app.ID, tid)
	writeJSON(w, 200, updated)
}

func handleApprove(w http.ResponseWriter, r *http.Request, app *KYBApplication, tid string) {
	if app.Status != "under_review" {
		errResp(w, 409, fmt.Sprintf("application must be under_review to approve (current: %s)", app.Status))
		return
	}
	approver := keycloakID(r)
	if approver == "" {
		errResp(w, 401, "x-keycloak-id header required for approval")
		return
	}
	if app.FirstApproverID != "" {
		errResp(w, 409, "first approval already recorded — call /finalize for checker approval")
		return
	}
	_, err := db.Exec(`
		UPDATE kyb_applications SET first_approver_id=$1, updated_at=NOW() WHERE id=$2`,
		approver, app.ID,
	)
	if err != nil {
		errResp(w, 500, "failed to record approval")
		return
	}
	updated, _ := getApplication(app.ID, tid)
	writeJSON(w, 200, map[string]interface{}{
		"message":          "First approval recorded. A different officer must call /finalize to complete.",
		"application":      updated,
		"first_approver":   approver,
	})
}

func handleFinalize(w http.ResponseWriter, r *http.Request, app *KYBApplication, tid string) {
	if app.Status != "under_review" {
		errResp(w, 409, fmt.Sprintf("application must be under_review to finalize (current: %s)", app.Status))
		return
	}
	if app.FirstApproverID == "" {
		errResp(w, 409, "maker approval required first — call /approve")
		return
	}
	checker := keycloakID(r)
	if checker == "" {
		errResp(w, 401, "x-keycloak-id header required")
		return
	}
	if checker == app.FirstApproverID {
		errResp(w, 409, "checker must be a different officer than the maker")
		return
	}

	now := time.Now().UTC()
	_, err := db.Exec(`
		UPDATE kyb_applications SET
			status      = 'approved',
			reviewed_at = $1,
			reviewed_by = $2,
			updated_at  = NOW()
		WHERE id = $3`,
		now, checker, app.ID,
	)
	if err != nil {
		errResp(w, 500, "failed to finalize approval")
		return
	}

	updated, _ := getApplication(app.ID, tid)
	go publishKYBApproved(updated)

	writeJSON(w, 200, map[string]interface{}{
		"message":     "KYB approved. Business account creation initiated.",
		"application": updated,
	})
}

func handleReject(w http.ResponseWriter, r *http.Request, app *KYBApplication, tid string) {
	if app.Status == "approved" || app.Status == "rejected" {
		errResp(w, 409, fmt.Sprintf("cannot reject application in status '%s'", app.Status))
		return
	}
	reviewer := keycloakID(r)
	if reviewer == "" {
		errResp(w, 401, "x-keycloak-id header required")
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.Reason == "" {
		errResp(w, 400, "rejection reason is required")
		return
	}
	now := time.Now().UTC()
	_, err := db.Exec(`
		UPDATE kyb_applications SET
			status           = 'rejected',
			rejection_reason = $1,
			reviewed_at      = $2,
			reviewed_by      = $3,
			updated_at       = NOW()
		WHERE id = $4`,
		req.Reason, now, reviewer, app.ID,
	)
	if err != nil {
		errResp(w, 500, "failed to reject application")
		return
	}
	updated, _ := getApplication(app.ID, tid)
	writeJSON(w, 200, updated)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		errResp(w, 400, "x-tenant-id header required")
		return
	}
	rows, err := db.Query(`
		SELECT status, COUNT(*) FROM kyb_applications WHERE tenant_id=$1 GROUP BY status`, tid)
	if err != nil {
		errResp(w, 500, "stats query failed")
		return
	}
	defer rows.Close()
	counts := map[string]int{}
	total := 0
	for rows.Next() {
		var status string
		var count int
		rows.Scan(&status, &count)
		counts[status] = count
		total += count
	}
	writeJSON(w, 200, map[string]interface{}{
		"total":        total,
		"draft":        counts["draft"],
		"under_review": counts["under_review"],
		"approved":     counts["approved"],
		"rejected":     counts["rejected"],
		"expired":      counts["expired"],
	})
}

// ── Main ───────────────────────────────────────────────────────────────────────

func main() {
	if databaseURL == "" {
		log.Fatal("[kyb] DATABASE_URL is required")
	}
	if err := initDB(); err != nil {
		log.Fatalf("[kyb] DB init failed: %v", err)
	}
	log.Println("[kyb] Database schema ready")

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		dbOK := db.Ping() == nil
		status := "healthy"
		code := 200
		if !dbOK {
			status = "unhealthy"
			code = 503
		}
		writeJSON(w, code, map[string]interface{}{
			"service":  "kyb-service",
			"status":   status,
			"db":       dbOK,
		})
	})

	mux.HandleFunc("/v1/kyb/applications", handleApplications)
	mux.HandleFunc("/v1/kyb/applications/", handleApplicationByID)
	mux.HandleFunc("/v1/kyb/stats", handleStats)

	log.Printf("[kyb] listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
