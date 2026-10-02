package main

import (
	"bytes"
	"context"
	"crypto"
	crand "crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/binary"
	"github.com/IBM/sarama"
	_ "github.com/lib/pq"
	"math/big"
	"math/rand"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"

	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// _jitterW11 applies full jitter to retry backoff sleeps (GPT-04): returns a
// duration in [d/2, d), matching the service-framework-go Retry pattern.
func _jitterW11(d time.Duration) time.Duration {
	return d/2 + time.Duration(rand.Int63n(int64(d)/2))
}

// jwksRefreshOnce ensures the shared JWKS poller is started exactly once.
var jwksRefreshOnce sync.Once

// ensureJWKSRefresh starts the initial JWKS fetch and the 5-minute refresher
// exactly once per process, no matter how many routes register the middleware
// (GPT-10: was one poller goroutine pair per route registration).
func ensureJWKSRefresh(realmURL string) {
	jwksRefreshOnce.Do(func() {
		go fetchJWKS(realmURL)
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				fetchJWKS(realmURL)
			}
		}()
	})
}

// sharedHTTPClient is a process-wide pooled HTTP client for outbound calls
// (replaces per-call &http.Client{} construction).
var sharedHTTPClient = &http.Client{
	Timeout: 10 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 25,
		IdleConnTimeout:     90 * time.Second,
	},
}

// secureUint32 returns a CSPRNG-derived uint32 for internal record IDs (L-16).
// Fails fast if the system CSPRNG is unavailable.
func secureUint32() uint32 {
	var b [4]byte
	if _, err := crand.Read(b[:]); err != nil {
		panic("crypto/rand unavailable: " + err.Error())
	}
	return binary.BigEndian.Uint32(b[:])
}

var serviceName = "safe-deposit-go"

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type BoxStatus string
type BoxSize string

const (
	BoxStatusOccupied    BoxStatus = "occupied"
	BoxStatusAvailable   BoxStatus = "available"
	BoxStatusMaintenance BoxStatus = "maintenance"

	BoxSizeSmall  BoxSize = "small"
	BoxSizeMedium BoxSize = "medium"
	BoxSizeLarge  BoxSize = "large"
)

type DepositBox struct {
	ID           string    `json:"id"`
	BoxSize      BoxSize   `json:"box_size"`
	CustomerName string    `json:"customer_name"`
	CustomerID   string    `json:"customer_id,omitempty"`
	Branch       string    `json:"branch"`
	AnnualRent   float64   `json:"annual_rent"`
	Currency     string    `json:"currency"`
	RenewalDate  string    `json:"renewal_date"`
	Status       BoxStatus `json:"status"`
	CreatedAt    string    `json:"created_at"`
	UpdatedAt    string    `json:"updated_at"`
	TenantID     string    `json:"tenant_id,omitempty"`
}

type DepositBoxListResponse struct {
	Items []DepositBox `json:"items"`
	Total int          `json:"total"`
}

type DepositBoxStats struct {
	TotalBoxes  int `json:"total_boxes"`
	Occupied    int `json:"occupied"`
	Available   int `json:"available"`
	Maintenance int `json:"maintenance"`
}

type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	RecordID  string `json:"recordId"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	Details   string `json:"details"`
}

// C3-P2-B5-go-2 (c3-0301): the in-memory boxes/auditLog slices, appendBox and
// appendAudit were removed. Deposit boxes are business records and MUST be
// durable: they now live in Postgres (deposit_boxes + deposit_box_audit, see
// initSchema) with all mutations transactional and fail-closed (503
// persistence_unavailable) — no in-memory fallback on business data.

// parsePageParams extracts limit/offset query params with a hard cap (GPT-07).
func parsePageParams(r *http.Request, defLimit, maxLimit int) (limit, offset int) {
	limit = defLimit
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		limit = l
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if o, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && o > 0 {
		offset = o
	}
	return
}

// Pagination is applied in SQL (LIMIT/OFFSET) on the Postgres-backed queries;
// the former in-memory paginateBoxes/paginateAudit helpers were removed with
// the slice store (c3-0301).

// requireDB fails closed when Postgres is unavailable: business data has no
// in-memory fallback (c3-0301).
func requireDB(w http.ResponseWriter) bool {
	if db == nil {
		respondJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "persistence_unavailable"})
		return false
	}
	return true
}

// boxColumns is the canonical column list for deposit_boxes scans.
const boxColumns = `box_number, box_size, customer_name, assigned_customer, branch, annual_rent, currency, renewal_date, status, created_at, updated_at`

func scanDepositBox(sc interface {
	Scan(dest ...interface{}) error
}) (DepositBox, error) {
	var b DepositBox
	var createdAt, updatedAt time.Time
	err := sc.Scan(&b.ID, &b.BoxSize, &b.CustomerName, &b.CustomerID, &b.Branch, &b.AnnualRent, &b.Currency, &b.RenewalDate, &b.Status, &createdAt, &updatedAt)
	b.CreatedAt = createdAt.Format(time.RFC3339)
	b.UpdatedAt = updatedAt.Format(time.RFC3339)
	return b, err
}

// tenantOf returns the tenant identity from the verified-JWT header (set by
// jwtMiddleware from token claims only). Empty → caller must fail closed.
func tenantOf(r *http.Request) string { return r.Header.Get("X-Tenant-ID") }

// insertAuditTx records a safe-deposit audit entry inside tx (idempotent on
// the random entry id).
func insertAuditTx(tx *sql.Tx, tenantID, action, recordID, actor, details string) error {
	_, err := tx.Exec(`INSERT INTO deposit_box_audit (id, tenant_id, action, record_id, actor, details)
		VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
		fmt.Sprintf("AUD-%08X", secureUint32()), tenantID, action, recordID, actor, details)
	return err
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "safe-deposit-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "safe-deposit-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain":      "Safe Deposit — Payments",
		"middleware": map[string]string{
			"kafka":      "safe-deposit.events, safe-deposit.audit",
			"postgres":   "safe_deposit_records",
			"redis":      "safe-deposit_cache",
			"temporal":   "SafeDepositWorkflow",
			"permify":    "safe-deposit:manage, safe-deposit:view",
			"opensearch": "safe-deposit-2026",
		},
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	tenantID := tenantOf(r)
	if tenantID == "" {
		respondJSON(w, 403, map[string]string{"error": "forbidden: tenant required"})
		return
	}
	limit, offset := parsePageParams(r, 100, 500)
	rows, err := db.QueryContext(r.Context(),
		`SELECT `+boxColumns+` FROM deposit_boxes WHERE tenant_id = $1 ORDER BY box_number LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		log.Printf("[%s] handleList query failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	defer rows.Close()
	items := []DepositBox{}
	for rows.Next() {
		b, err := scanDepositBox(rows)
		if err != nil {
			log.Printf("[%s] handleList scan failed: %v", serviceName, err)
			respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
			return
		}
		b.TenantID = tenantID
		items = append(items, b)
	}
	var total int
	if err := db.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM deposit_boxes WHERE tenant_id = $1`, tenantID).Scan(&total); err != nil {
		log.Printf("[%s] handleList count failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	respondJSON(w, 200, DepositBoxListResponse{Items: items, Total: total})
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	if !requireDB(w) {
		return
	}

	var body struct {
		BoxSize      string  `json:"box_size"`
		Branch       string  `json:"branch"`
		AnnualRent   float64 `json:"annual_rent"`
		Currency     string  `json:"currency"`
		CustomerName string  `json:"customer_name"`
		CustomerID   string  `json:"customer_id"`
		RenewalDate  string  `json:"renewal_date"`
		TenantID     string  `json:"tenant_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if body.BoxSize == "" || body.Branch == "" {
		respondJSON(w, 400, map[string]string{"error": "box_size and branch are required"})
		return
	}
	currency := body.Currency
	if currency == "" {
		currency = "NGN"
	}
	status := BoxStatusAvailable
	if body.CustomerID != "" || body.CustomerName != "" {
		status = BoxStatusOccupied
	}

	// Tenant identity comes from verified JWT claims (X-Tenant-ID is set by
	// jwtMiddleware); fall back to the request body only when the header is
	// absent, and fail closed when neither carries a tenant.
	tenantID := tenantOf(r)
	if tenantID == "" {
		tenantID = body.TenantID
	}
	if tenantID == "" {
		respondJSON(w, 403, map[string]string{"error": "forbidden: tenant required"})
		return
	}

	// Transactional create: box row + audit entry commit atomically. The box
	// number comes from a Postgres sequence (durable across restarts).
	tx, err := db.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("[%s] handleCreate begin tx failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	defer tx.Rollback()

	var seq int64
	if err := tx.QueryRowContext(r.Context(), `SELECT nextval('deposit_box_number_seq')`).Scan(&seq); err != nil {
		log.Printf("[%s] handleCreate seq failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	box := DepositBox{
		ID:           fmt.Sprintf("BOX-%04d", seq),
		BoxSize:      BoxSize(body.BoxSize),
		Branch:       body.Branch,
		AnnualRent:   body.AnnualRent,
		Currency:     currency,
		CustomerName: body.CustomerName,
		CustomerID:   body.CustomerID,
		RenewalDate:  body.RenewalDate,
		Status:       status,
		TenantID:     tenantID,
	}
	var createdAt, updatedAt time.Time
	err = tx.QueryRowContext(r.Context(),
		`INSERT INTO deposit_boxes (tenant_id, branch, box_number, box_size, status, assigned_customer, customer_name, annual_rent, currency, renewal_date, payload)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		 ON CONFLICT (tenant_id, branch, box_number) DO NOTHING
		 RETURNING created_at, updated_at`,
		tenantID, box.Branch, box.ID, string(box.BoxSize), string(box.Status), box.CustomerID, box.CustomerName, box.AnnualRent, box.Currency, box.RenewalDate, "{}").Scan(&createdAt, &updatedAt)
	if err == sql.ErrNoRows {
		respondJSON(w, 409, map[string]string{"error": "box already exists: " + box.ID})
		return
	}
	if err != nil {
		log.Printf("[%s] handleCreate insert failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	box.CreatedAt = createdAt.Format(time.RFC3339)
	box.UpdatedAt = updatedAt.Format(time.RFC3339)

	if err := insertAuditTx(tx, tenantID, "create", box.ID, body.CustomerID, "Box created"); err != nil {
		log.Printf("[%s] handleCreate audit failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	if err := tx.Commit(); err != nil {
		log.Printf("[%s] handleCreate commit failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}

	respondJSON(w, 201, map[string]interface{}{"created": true, "box": box})
}

// handleAssign assigns an existing available box to a customer.
func handleAssign(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}

	var body struct {
		ID           string  `json:"id"`
		CustomerName string  `json:"customer_name"`
		CustomerID   string  `json:"customer_id"`
		AnnualRent   float64 `json:"annual_rent"`
		RenewalDate  string  `json:"renewal_date"`
		UpdatedBy    string  `json:"updated_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if body.ID == "" || body.CustomerID == "" {
		respondJSON(w, 400, map[string]string{"error": "id and customer_id are required"})
		return
	}

	if !requireDB(w) {
		return
	}
	tenantID := tenantOf(r)
	if tenantID == "" {
		respondJSON(w, 403, map[string]string{"error": "forbidden: tenant required"})
		return
	}

	// Transactional conditional assignment: the UPDATE only fires while the
	// box is still 'available', so concurrent assigns cannot double-book.
	tx, err := db.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("[%s] handleAssign begin tx failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(r.Context(),
		`UPDATE deposit_boxes
		 SET customer_name = $1,
		     assigned_customer = $2,
		     annual_rent = CASE WHEN $3 > 0 THEN $3 ELSE annual_rent END,
		     renewal_date = CASE WHEN $4 <> '' THEN $4 ELSE renewal_date END,
		     status = 'occupied',
		     updated_at = NOW()
		 WHERE tenant_id = $5 AND box_number = $6 AND status = 'available'`,
		body.CustomerName, body.CustomerID, body.AnnualRent, body.RenewalDate, tenantID, body.ID)
	if err != nil {
		log.Printf("[%s] handleAssign update failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		// Either the box does not exist, or it is not available. Distinguish,
		// and make assignment idempotent: replaying the SAME assignment
		// (same customer on the already-occupied box) returns success without
		// writing a duplicate audit entry.
		var curStatus, curCustomer string
		err := tx.QueryRowContext(r.Context(),
			`SELECT status, assigned_customer FROM deposit_boxes WHERE tenant_id = $1 AND box_number = $2`,
			tenantID, body.ID).Scan(&curStatus, &curCustomer)
		if err == sql.ErrNoRows {
			respondJSON(w, 404, map[string]string{"error": "box not found: " + body.ID})
			return
		}
		if err != nil {
			log.Printf("[%s] handleAssign lookup failed: %v", serviceName, err)
			respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
			return
		}
		if curStatus == string(BoxStatusOccupied) && curCustomer == body.CustomerID {
			box, err := loadDepositBox(r, tenantID, body.ID)
			if err != nil {
				log.Printf("[%s] handleAssign replay load failed: %v", serviceName, err)
				respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
				return
			}
			respondJSON(w, 200, map[string]interface{}{"updated": true, "replayed": true, "box": box})
			return
		}
		respondJSON(w, 409, map[string]string{"error": "box is not available for assignment"})
		return
	}
	if err := insertAuditTx(tx, tenantID, "assign", body.ID, body.UpdatedBy, "Box assigned to customer"); err != nil {
		log.Printf("[%s] handleAssign audit failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	if err := tx.Commit(); err != nil {
		log.Printf("[%s] handleAssign commit failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	box, err := loadDepositBox(r, tenantID, body.ID)
	if err != nil {
		log.Printf("[%s] handleAssign reload failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	respondJSON(w, 200, map[string]interface{}{"updated": true, "box": box})
}

// loadDepositBox reads one box by tenant + box number (post-mutation reload).
func loadDepositBox(r *http.Request, tenantID, boxNumber string) (DepositBox, error) {
	row := db.QueryRowContext(r.Context(),
		`SELECT `+boxColumns+` FROM deposit_boxes WHERE tenant_id = $1 AND box_number = $2`,
		tenantID, boxNumber)
	b, err := scanDepositBox(row)
	b.TenantID = tenantID
	return b, err
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "PUT" {
		respondJSON(w, 405, map[string]string{"error": "POST/PUT required"})
		return
	}

	var body struct {
		ID          string  `json:"id"`
		Status      string  `json:"status"`
		RenewalDate string  `json:"renewal_date"`
		AnnualRent  float64 `json:"annual_rent"`
		UpdatedBy   string  `json:"updated_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if body.ID == "" {
		respondJSON(w, 400, map[string]string{"error": "id is required"})
		return
	}

	if !requireDB(w) {
		return
	}
	tenantID := tenantOf(r)
	if tenantID == "" {
		respondJSON(w, 403, map[string]string{"error": "forbidden: tenant required"})
		return
	}

	// Transactional update: row mutation + audit entry commit atomically;
	// 404 when the box does not exist for this tenant.
	tx, err := db.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("[%s] handleUpdate begin tx failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(r.Context(),
		`UPDATE deposit_boxes
		 SET status = CASE WHEN $1 <> '' THEN $1 ELSE status END,
		     renewal_date = CASE WHEN $2 <> '' THEN $2 ELSE renewal_date END,
		     annual_rent = CASE WHEN $3 > 0 THEN $3 ELSE annual_rent END,
		     updated_at = NOW()
		 WHERE tenant_id = $4 AND box_number = $5`,
		body.Status, body.RenewalDate, body.AnnualRent, tenantID, body.ID)
	if err != nil {
		log.Printf("[%s] handleUpdate update failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		respondJSON(w, 404, map[string]string{"error": "box not found: " + body.ID})
		return
	}
	if err := insertAuditTx(tx, tenantID, "update", body.ID, body.UpdatedBy, "Box updated"); err != nil {
		log.Printf("[%s] handleUpdate audit failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	if err := tx.Commit(); err != nil {
		log.Printf("[%s] handleUpdate commit failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	box, err := loadDepositBox(r, tenantID, body.ID)
	if err != nil {
		log.Printf("[%s] handleUpdate reload failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	respondJSON(w, 200, map[string]interface{}{"updated": true, "box": box})
}

func handleVacate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}

	var body struct {
		ID        string `json:"id"`
		UpdatedBy string `json:"updated_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if body.ID == "" {
		respondJSON(w, 400, map[string]string{"error": "id is required"})
		return
	}

	if !requireDB(w) {
		return
	}
	tenantID := tenantOf(r)
	if tenantID == "" {
		respondJSON(w, 403, map[string]string{"error": "forbidden: tenant required"})
		return
	}

	// Transactional vacate: row mutation + audit entry commit atomically.
	tx, err := db.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("[%s] handleVacate begin tx failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(r.Context(),
		`UPDATE deposit_boxes
		 SET customer_name = '', assigned_customer = '', renewal_date = '',
		     status = 'available', updated_at = NOW()
		 WHERE tenant_id = $1 AND box_number = $2`,
		tenantID, body.ID)
	if err != nil {
		log.Printf("[%s] handleVacate update failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		respondJSON(w, 404, map[string]string{"error": "box not found: " + body.ID})
		return
	}
	if err := insertAuditTx(tx, tenantID, "vacate", body.ID, body.UpdatedBy, "Box vacated"); err != nil {
		log.Printf("[%s] handleVacate audit failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	if err := tx.Commit(); err != nil {
		log.Printf("[%s] handleVacate commit failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	box, err := loadDepositBox(r, tenantID, body.ID)
	if err != nil {
		log.Printf("[%s] handleVacate reload failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	respondJSON(w, 200, map[string]interface{}{"updated": true, "box": box})
}

func handleProcess(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"message": "use /assign or /update for box operations"})
}

func handleAudit(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	tenantID := tenantOf(r)
	if tenantID == "" {
		respondJSON(w, 403, map[string]string{"error": "forbidden: tenant required"})
		return
	}
	limit, offset := parsePageParams(r, 100, 500)
	rows, err := db.QueryContext(r.Context(),
		`SELECT id, action, record_id, actor, details, created_at
		 FROM deposit_box_audit WHERE tenant_id = $1
		 ORDER BY created_at DESC, id LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		log.Printf("[%s] handleAudit query failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	defer rows.Close()
	entries := []AuditEntry{}
	for rows.Next() {
		var e AuditEntry
		var createdAt time.Time
		if err := rows.Scan(&e.ID, &e.Action, &e.RecordID, &e.Actor, &e.Details, &createdAt); err != nil {
			log.Printf("[%s] handleAudit scan failed: %v", serviceName, err)
			respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
			return
		}
		e.Timestamp = createdAt.Format(time.RFC3339)
		entries = append(entries, e)
	}
	var total int
	if err := db.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM deposit_box_audit WHERE tenant_id = $1`, tenantID).Scan(&total); err != nil {
		log.Printf("[%s] handleAudit count failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	respondJSON(w, 200, map[string]interface{}{"auditLog": entries, "total": total})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	tenantID := tenantOf(r)
	if tenantID == "" {
		respondJSON(w, 403, map[string]string{"error": "forbidden: tenant required"})
		return
	}
	var stats DepositBoxStats
	err := db.QueryRowContext(r.Context(),
		`SELECT COUNT(*),
		        COUNT(*) FILTER (WHERE status = 'occupied'),
		        COUNT(*) FILTER (WHERE status = 'available'),
		        COUNT(*) FILTER (WHERE status = 'maintenance')
		 FROM deposit_boxes WHERE tenant_id = $1`, tenantID).
		Scan(&stats.TotalBoxes, &stats.Occupied, &stats.Available, &stats.Maintenance)
	if err != nil {
		log.Printf("[%s] handleStats query failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence_unavailable"})
		return
	}
	respondJSON(w, 200, stats)
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

// --- Production Hardening ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"safe-deposit-go"}`)
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"alive":true}`)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"safe-deposit-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"safe-deposit-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"safe-deposit-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

// --- Counting Middleware ---
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

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// --- Database Layer ---
var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — in-memory mode", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	log.Printf("[%s] Postgres connected (pool: 25/5)", serviceName)
	// Boot-time schema + idempotent seeds (c3-0301): deposit_boxes and
	// deposit_box_audit are created idempotently; without them every business
	// handler would fail closed (503 persistence_unavailable).
	initSchema()
}

// ── MIDDLEWARE: JWT Validation ───────────────────────────────────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func fetchJWKS(realmURL string) {
	resp, err := http.Get(realmURL + "/protocol/openid-connect/certs")
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
		pub := &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
		jwtCache.keys[k.Kid] = pub
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

// expectedIssuer returns the expected JWT issuer: KEYCLOAK_ISSUER when set,
// otherwise KEYCLOAK_REALM_URL. Empty means issuer validation is skipped
// (a startup warning is logged by warnIfAuthUnconfigured).
func expectedIssuer() string {
	if iss := os.Getenv("KEYCLOAK_ISSUER"); iss != "" {
		return iss
	}
	return os.Getenv("KEYCLOAK_REALM_URL")
}

// audienceMatches checks the expected audience against the JWT aud claim,
// which may be a string or an array of strings.
func audienceMatches(aud interface{}, expected string) bool {
	switch v := aud.(type) {
	case string:
		return v == expected
	case []interface{}:
		for _, a := range v {
			if a == expected {
				return true
			}
		}
	}
	return false
}

func init() {
	warnIfAuthUnconfigured()
}

func warnIfAuthUnconfigured() {
	if os.Getenv("KEYCLOAK_ISSUER") == "" && os.Getenv("KEYCLOAK_REALM_URL") == "" {
		log.Printf("WARNING: KEYCLOAK_ISSUER/KEYCLOAK_REALM_URL unset - JWT iss claim will NOT be validated")
	}
	if os.Getenv("EXPECTED_AUDIENCE") == "" {
		log.Printf("WARNING: EXPECTED_AUDIENCE unset - JWT aud claim will NOT be validated")
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

func jwtMiddleware(realmURL string, next http.Handler) http.Handler {
	// Single shared JWKS poller per process (started once, not per route)
	ensureJWKSRefresh(realmURL)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip health endpoints
		if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" || r.URL.Path == "/livez" || r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := auth[7:]
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
			return
		}
		// Decode header for kid
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
		}
		json.Unmarshal(headerBytes, &header)

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Try refresh
			fetchJWKS(realmURL)
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}
		// Verify signature (RS256)
		signingInput := parts[0] + "." + parts[1]
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(signingInput))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}
		// Decode claims
		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		// Check expiry
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Validate issuer/audience when configured (M-55)
		if iss := expectedIssuer(); iss != "" {
			if claims["iss"] != iss {
				http.Error(w, `{"error":"invalid issuer"}`, http.StatusUnauthorized)
				return
			}
		}
		if aud := os.Getenv("EXPECTED_AUDIENCE"); aud != "" {
			if !audienceMatches(claims["aud"], aud) {
				http.Error(w, `{"error":"invalid audience"}`, http.StatusUnauthorized)
				return
			}
		}
		// Pass claims in context
		// Tenant identity comes ONLY from verified JWT claims (fail-closed):
		// overwrite any caller-supplied tenant header and reject tokens that
		// carry no tenant claim before any query runs.
		tenant := tenantFromClaims(claims)
		if tenant == "" {
			http.Error(w, `{"error":"forbidden: token has no tenant claim"}`, http.StatusForbidden)
			return
		}
		r.Header.Set("X-Tenant-ID", tenant)
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// enforceTenantClaim cross-checks a client-supplied tenant identifier against
// the verified JWT claims (C-15). When the token carries a tenant (or
// tenant_id) claim and it does not match the requested tenant, the request is
// rejected with 403 and false is returned. Fail-closed (wave-7.5): an empty
// requested tenant, missing verified claims, or a token without a tenant claim
// is rejected instead of being allowed.
func enforceTenantClaim(w http.ResponseWriter, r *http.Request, requestedTenant string) bool {
	if requestedTenant == "" {
		http.Error(w, `{"error":"forbidden: tenant required"}`, http.StatusForbidden)
		return false
	}
	claims, _ := r.Context().Value("jwt_claims").(map[string]interface{})
	if claims == nil {
		http.Error(w, `{"error":"unauthorized: no verified token claims"}`, http.StatusUnauthorized)
		return false
	}
	claimTenant, _ := claims["tenant"].(string)
	if claimTenant == "" {
		claimTenant, _ = claims["tenant_id"].(string)
	}
	if claimTenant == "" {
		http.Error(w, `{"error":"forbidden: token has no tenant claim"}`, http.StatusForbidden)
		return false
	}
	if claimTenant != requestedTenant {
		http.Error(w, `{"error":"tenant mismatch: token tenant does not match requested tenant"}`, http.StatusForbidden)
		return false
	}
	return true
}

// sanitizeLogValue strips CR/LF and other control characters from
// client-supplied values (e.g. trace headers) before they reach log
// statements, preventing log injection/forgery (L-18). Output length is
// bounded to keep log lines small.
func sanitizeLogValue(s string) string {
	const maxLen = 128
	if len(s) > maxLen {
		s = s[:maxLen]
	}
	return strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return -1
		}
		return r
	}, s)
}

// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := sanitizeLogValue(r.Header.Get("X-Trace-Id"))
		if traceID == "" {
			traceID = sanitizeLogValue(r.Header.Get("traceparent"))
		}
		if traceID == "" {
			traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid())
		}
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- JWT Auth Middleware ---
func jwtAuthMiddleware(next http.Handler) http.Handler {
	// Chain-level guard delegates to the canonical RS256/JWKS verifier
	// (jwtMiddleware): every non-probe request gets real Keycloak signature
	// verification with exp/iss/aud enforcement; probe/health paths stay exempt.
	inner := jwtMiddleware(jwtRealmURL(), next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		inner.ServeHTTP(w, r)
	})
}

// --- Redis Caching Layer ---
var redisAddr string

func init() {
	redisAddr = os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
}

// W11 GPT-01: pooled go-redis client shared per service (replaces per-op TCP dial).
// Lazy init so REDIS_URL env override in init() is honored; DialTimeout kept as dial fallback.
var (
	redisClientOnce sync.Once
	redisClient     *redis.Client
	redisCtx        = context.Background()
)

func getRedisClient() *redis.Client {
	redisClientOnce.Do(func() {
		redisClient = redis.NewClient(&redis.Options{
			Addr:         redisAddr,
			DialTimeout:  2 * time.Second,
			ReadTimeout:  3 * time.Second,
			WriteTimeout: 3 * time.Second,
			PoolSize:     50,
		})
	})
	return redisClient
}

func cacheGet(key string) (string, bool) {
	s, err := getRedisClient().Get(redisCtx, key).Result()
	if err != nil {
		return "", false
	}
	return s, true
}
func cacheSet(key, value string, ttlSeconds int) {
	if err := getRedisClient().Set(redisCtx, key, value, time.Duration(ttlSeconds)*time.Second).Err(); err != nil {
		log.Printf("[%s] cacheSet(%s) failed: %v", serviceName, key, err)
	}
}

// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" {
		return false, "", ""
	}
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" {
		cert = "/etc/54bank/certs/service.crt"
	}
	if key == "" {
		key = "/etc/54bank/certs/service.key"
	}
	return true, cert, key
}

// --- CORS + Security Headers Middleware ---
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ── MIDDLEWARE: Outbox Relay (Kafka) ────────────────────────────────────────

func startOutboxRelay(ctx context.Context, brokers string, topic string) {
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				relayOutbox(brokers, topic)
			}
		}
	}()
}

func relayOutbox(brokers string, topic string) {
	if db == nil {
		return
	}

	// Events are marked published ONLY after a confirmed Kafka produce.
	producer, err := getKafkaProducer(brokers)
	if err != nil {
		log.Printf("[outbox-relay] kafka unavailable: %v — events remain unpublished for retry", err)
		return
	}

	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil {
		return
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil {
			continue
		}
		_, _, err := producer.SendMessage(&sarama.ProducerMessage{
			Topic: topic,
			Key:   sarama.StringEncoder(aggID),
			Value: sarama.ByteEncoder(payload),
		})
		if err != nil {
			log.Printf("[outbox-relay] publish failed for event %s: %v — leaving unpublished for retry", id, err)
			continue
		}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return
	}
	for _, id := range ids {
		if _, err := db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id); err != nil {
			log.Printf("[outbox-relay] failed to mark event %s published: %v", id, err)
		}
	}
	if len(ids) > 0 {
		log.Printf("[outbox-relay] published %d events to kafka topic=%s", len(ids), topic)
	}
}

// getKafkaProducer lazily creates a shared sarama SyncProducer.
var kafkaProducer sarama.SyncProducer
var kafkaProducerMu sync.Mutex

func getKafkaProducer(brokers string) (sarama.SyncProducer, error) {
	kafkaProducerMu.Lock()
	defer kafkaProducerMu.Unlock()
	if kafkaProducer != nil {
		return kafkaProducer, nil
	}
	cfg := sarama.NewConfig()
	cfg.Producer.Return.Successes = true
	cfg.Producer.RequiredAcks = sarama.WaitForAll
	cfg.Producer.Retry.Max = 3
	p, err := sarama.NewSyncProducer(strings.Split(brokers, ","), cfg)
	if err != nil {
		return nil, err
	}
	kafkaProducer = p
	return kafkaProducer, nil
}

func initSchema() {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_number_hash VARCHAR(64) NOT NULL,
    masked_pan VARCHAR(19) NOT NULL,
    customer_id UUID NOT NULL,
    account_id UUID NOT NULL,
    card_type VARCHAR(20) NOT NULL,
    scheme VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    expiry_month INT NOT NULL,
    expiry_year INT NOT NULL,
    daily_limit_kobo BIGINT NOT NULL DEFAULT 50000000,
    monthly_limit_kobo BIGINT NOT NULL DEFAULT 500000000,
    pin_retries INT DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    blocked_reason VARCHAR(100),
    tenant_id UUID NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		log.Fatalf("schema init failed: %v", err)
	}

	// Outbox for event sourcing
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS outbox (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		event_type VARCHAR(64) NOT NULL,
		aggregate_id VARCHAR(128) NOT NULL,
		payload JSONB NOT NULL,
		published BOOLEAN DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		log.Printf("outbox table creation (may already exist): %v", err)
	}

	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_cards_tenant ON cards(tenant_id)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_cards_created ON cards(created_at DESC)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published, created_at) WHERE NOT published`)

	// ── Safe-deposit domain store (c3-0301, C3-P2-B5-go-2) ─────────────────
	// deposit_boxes: durable box inventory keyed by (tenant, branch, box
	// number); payload jsonb carries future extension attributes. Box numbers
	// come from deposit_box_number_seq (starts past the seed range).
	if _, err := db.Exec(`CREATE SEQUENCE IF NOT EXISTS deposit_box_number_seq START 7`); err != nil {
		log.Fatalf("schema init (deposit_box_number_seq) failed: %v", err)
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS deposit_boxes (
		tenant_id TEXT NOT NULL,
		branch TEXT NOT NULL,
		box_number TEXT NOT NULL,
		box_size TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'available',
		assigned_customer TEXT NOT NULL DEFAULT '',
		customer_name TEXT NOT NULL DEFAULT '',
		annual_rent DOUBLE PRECISION NOT NULL DEFAULT 0,
		currency TEXT NOT NULL DEFAULT 'NGN',
		renewal_date TEXT NOT NULL DEFAULT '',
		payload JSONB NOT NULL DEFAULT '{}'::jsonb,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (tenant_id, branch, box_number)
	)`); err != nil {
		log.Fatalf("schema init (deposit_boxes) failed: %v", err)
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS deposit_box_audit (
		id TEXT PRIMARY KEY,
		tenant_id TEXT NOT NULL,
		action TEXT NOT NULL,
		record_id TEXT NOT NULL,
		actor TEXT NOT NULL DEFAULT '',
		details TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Fatalf("schema init (deposit_box_audit) failed: %v", err)
	}
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_deposit_boxes_tenant_status ON deposit_boxes(tenant_id, status)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_deposit_box_audit_tenant ON deposit_box_audit(tenant_id, created_at DESC)`)

	// Idempotent seed of the original demonstration inventory under the
	// 'default' tenant (matches the pre-PG in-memory seed set).
	seeds := []struct {
		boxNumber, boxSize, customerName, customerID, branch, renewalDate, status, createdAt string
		annualRent                                                                           float64
	}{
		{"BOX-0001", "small", "Adebayo Okafor", "CUST-1001", "Lagos Island", "2027-01-15", "occupied", "2025-01-15T09:00:00Z", 45000},
		{"BOX-0002", "medium", "Ngozi Eze", "CUST-1002", "Abuja Central", "2027-03-20", "occupied", "2025-03-20T10:30:00Z", 80000},
		{"BOX-0003", "large", "", "", "Port Harcourt", "", "available", "2025-02-01T08:00:00Z", 120000},
		{"BOX-0004", "small", "", "", "Lagos Island", "", "maintenance", "2025-04-10T11:00:00Z", 45000},
		{"BOX-0005", "medium", "Emeka Chukwu", "CUST-1003", "Enugu", "2026-11-30", "occupied", "2025-11-30T14:00:00Z", 80000},
		{"BOX-0006", "large", "", "", "Abuja Central", "", "available", "2025-06-15T10:00:00Z", 120000},
	}
	for _, s := range seeds {
		if _, err := db.Exec(`INSERT INTO deposit_boxes
			(tenant_id, branch, box_number, box_size, status, assigned_customer, customer_name, annual_rent, currency, renewal_date, created_at, updated_at)
			VALUES ('default', $1, $2, $3, $4, $5, $6, $7, 'NGN', $8, $9, $9)
			ON CONFLICT (tenant_id, branch, box_number) DO NOTHING`,
			s.branch, s.boxNumber, s.boxSize, s.status, s.customerID, s.customerName, s.annualRent, s.renewalDate, s.createdAt); err != nil {
			log.Printf("seed deposit_boxes %s (may already exist): %v", s.boxNumber, err)
		}
	}
}

func domainHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		listRecords(w, r)
	case "POST":
		createRecord(w, r)
	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func domainDetailHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/cards/"), "/")
	id := parts[0]
	if id == "" {
		http.Error(w, `{"error":"id required"}`, http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "GET":
		getRecord(w, r, id)
	case "PUT", "PATCH":
		updateRecord(w, r, id)
	case "DELETE":
		deleteRecord(w, r, id)
	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func listRecords(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if !enforceTenantClaim(w, r, tenantID) {
		return
	}
	limit := 50
	offset := 0

	query := `SELECT id, status, created_at FROM cards WHERE tenant_id::text = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := db.QueryContext(r.Context(), query, tenantID, limit, offset)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var id, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &status, &createdAt); err != nil {
			continue
		}
		records = append(records, map[string]interface{}{"id": id, "status": status, "created_at": createdAt})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": records, "count": len(records)})
}

func createRecord(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	tenantID := r.Header.Get("X-Tenant-ID")
	if !enforceTenantClaim(w, r, tenantID) {
		return
	}
	if tenantID == "" {
		http.Error(w, `{"error":"forbidden: tenant required"}`, http.StatusForbidden)
		return
	}
	body["tenant_id"] = tenantID

	payload, _ := json.Marshal(body)

	tx, err := db.BeginTx(r.Context(), nil)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var id string
	err = tx.QueryRowContext(r.Context(),
		`INSERT INTO cards (tenant_id, status) VALUES ($1, 'active') RETURNING id`,
		tenantID).Scan(&id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	// Write to outbox in the SAME transaction as the domain write; an
	// outbox error aborts the transaction (fail closed), so the domain
	// row and its event can never diverge.
	if _, err = tx.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"cards.created", id, string(payload)); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": "created"})
}

func getRecord(w http.ResponseWriter, r *http.Request, id string) {
	var status string
	var createdAt time.Time
	err := db.QueryRowContext(r.Context(),
		`SELECT status, created_at FROM cards WHERE id = $1`, id).Scan(&status, &createdAt)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": status, "created_at": createdAt})
}

func updateRecord(w http.ResponseWriter, r *http.Request, id string) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	status, _ := body["status"].(string)
	if status == "" {
		status = "updated"
	}

	tx, err := db.BeginTx(r.Context(), nil)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(r.Context(),
		`UPDATE cards SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	payload, _ := json.Marshal(body)
	// Write to outbox in the SAME transaction as the domain write; an
	// outbox error aborts the transaction (fail closed), so the domain
	// row and its event can never diverge.
	if _, err = tx.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"cards.updated", id, string(payload)); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": status})
}

func deleteRecord(w http.ResponseWriter, r *http.Request, id string) {
	tx, err := db.BeginTx(r.Context(), nil)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(r.Context(),
		`UPDATE cards SET status = 'deleted', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	// Write to outbox in the SAME transaction as the domain write; an
	// outbox error aborts the transaction (fail closed), so the domain
	// row and its event can never diverge.
	if _, err = tx.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"cards.deleted", id, `{"id":"`+id+`"}`); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": "safe-deposit-go",
		"version": "1.0.0",
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if r.URL.Path != "/healthz" && r.URL.Path != "/livez" {
			log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
		}
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
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-User-ID, X-Request-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

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

func validatePOSTransaction(amount float64, merchantID, terminalID string) (bool, string) {
	if amount <= 0 {
		return false, "Amount must be positive"
	}
	if amount > 5000000 {
		return false, "POS single transaction limit is ₦5M"
	}
	if merchantID == "" {
		return false, "Merchant ID required"
	}
	if terminalID == "" {
		return false, "Terminal ID required"
	}
	return true, "POS transaction approved"
}
func computePOSCharge(amount float64, isInterbank bool) float64 {
	mdr := amount * 0.005 // 0.5% MDR
	if mdr > 1000 {
		mdr = 1000
	} // ₦1000 cap
	if isInterbank {
		mdr += 35
	} // Interbank switching fee
	return mdr
}

// --- Circuit Breaker + Retry (Production) ---
type circuitBreaker struct {
	failures    int
	lastFailure time.Time
	threshold   int
	resetAfter  time.Duration
	mu          sync.Mutex
}

func (cb *circuitBreaker) allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.failures >= cb.threshold {
		if time.Since(cb.lastFailure) > cb.resetAfter {
			cb.failures = cb.threshold / 2
			return true
		}
		return false
	}
	return true
}

func (cb *circuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.failures > 0 {
		cb.failures--
	}
}

func (cb *circuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailure = time.Now()
}

var _cb = &circuitBreaker{threshold: 5, resetAfter: 30 * time.Second}

func callServiceWithRetry(method, url string, body interface{}) (map[string]interface{}, error) {
	if !_cb.allow() {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(_jitterW11(time.Duration(1<<uint(attempt)) * 200 * time.Millisecond))
		}
		var req *http.Request
		if body != nil {
			jsonData, _ := json.Marshal(body)
			req, _ = http.NewRequest(method, url, bytes.NewBuffer(jsonData))
		} else {
			req, _ = http.NewRequest(method, url, nil)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Source-Service", serviceName)
		resp, err := sharedHTTPClient.Do(req)
		if err != nil {
			lastErr = err
			_cb.recordFailure()
			log.Printf("[%s] %s %s attempt %d failed: %v", serviceName, method, url, attempt+1, err)
			continue
		}
		if resp.StatusCode >= 500 {
			resp.Body.Close()
			lastErr = fmt.Errorf("upstream %s returned %d", url, resp.StatusCode)
			_cb.recordFailure()
			continue
		}
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		resp.Body.Close()
		_cb.recordSuccess()
		return result, nil
	}
	return nil, fmt.Errorf("all retries exhausted for %s: %w", url, lastErr)
}

// --- Alerting ---
type alertManager struct {
	rules []alertRule
	mu    sync.RWMutex
}

type alertRule struct {
	Name      string
	Metric    string
	Threshold float64
	Severity  string
}

var _alertMgr = &alertManager{
	rules: []alertRule{
		{"high_error_rate", "error_rate", 0.05, "critical"},
		{"high_latency", "p99_latency_ms", 5000, "warning"},
		{"db_connection_failures", "db_failures", 3, "critical"},
	},
}

func (am *alertManager) check() []map[string]interface{} {
	var fired []map[string]interface{}
	errRate := float64(atomic.LoadUint64(&_errCount)) / float64(max64(atomic.LoadUint64(&_reqCount), 1))
	if errRate > 0.05 {
		fired = append(fired, map[string]interface{}{"rule": "high_error_rate", "value": errRate, "severity": "critical"})
	}
	return fired
}

func max64(a, b uint64) uint64 {
	if a > b {
		return a
	}
	return b
}

func alertsHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Graceful Degradation ---
type degradationState struct {
	dbAvailable    bool
	cacheAvailable bool
	upstreamOK     map[string]bool
	mu             sync.RWMutex
}

var _degrade = &degradationState{
	dbAvailable:    true,
	cacheAvailable: true,
	upstreamOK:     make(map[string]bool),
}

func (d *degradationState) setDB(ok bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.dbAvailable = ok
}

func (d *degradationState) isDBAvailable() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.dbAvailable
}

func (d *degradationState) setUpstream(name string, ok bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.upstreamOK[name] = ok
}

func degradationStatusHandler(w http.ResponseWriter, r *http.Request) {
	_degrade.mu.RLock()
	defer _degrade.mu.RUnlock()
	jsonResp(w, 200, map[string]interface{}{
		"service":         serviceName,
		"db_available":    _degrade.dbAvailable,
		"cache_available": _degrade.cacheAvailable,
		"upstreams":       _degrade.upstreamOK,
		"mode": func() string {
			if _degrade.dbAvailable {
				return "normal"
			}
			return "degraded"
		}(),
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "9423"
	}
	initDB()
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.Handle("/v1/alerts", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("safe_deposit", "manage", http.HandlerFunc(alertsHandler))))
	mux.Handle("/v1/degradation", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("safe_deposit", "view", http.HandlerFunc(degradationStatusHandler))))
	mux.HandleFunc("/healthz", handleHealthz)
	mux.Handle("/v1/safe-deposit/list", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("safe_deposit", "view", http.HandlerFunc(handleList))))
	mux.Handle("/v1/safe-deposit/create", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("safe_deposit", "create", http.HandlerFunc(handleCreate))))
	mux.Handle("/v1/safe-deposit/assign", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("safe_deposit", "assign", http.HandlerFunc(handleAssign))))
	mux.Handle("/v1/safe-deposit/update", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("safe_deposit", "update", http.HandlerFunc(handleUpdate))))
	mux.Handle("/v1/safe-deposit/vacate", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("safe_deposit", "vacate", http.HandlerFunc(handleVacate))))
	mux.Handle("/v1/safe-deposit/process", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("safe_deposit", "process", http.HandlerFunc(handleProcess))))
	mux.Handle("/v1/safe-deposit/audit", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("safe_deposit", "view", http.HandlerFunc(handleAudit))))
	mux.Handle("/v1/safe-deposit/stats", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("safe_deposit", "view", http.HandlerFunc(handleStats))))
	log.Printf("Safe Deposit v2.0 (Payments) on :%s", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(traceMiddleware(countingMiddleware(mux))))),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()
	<-quit
	log.Println("[safe-deposit-go] Shutdown signal received")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	log.Println("[safe-deposit-go] Server stopped gracefully")
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) { respondJSON(w, code, data) }

// listHandler is the historical handler name referenced by main_test.go; it
// maps to the Postgres-backed safe-deposit list handler (c3-0301).
func listHandler(w http.ResponseWriter, r *http.Request) { handleList(w, r) }

// jwtRealmURL resolves the Keycloak realm URL for jwtMiddleware (added by
// scripts/fix-go-wire-jwt.py).
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}
