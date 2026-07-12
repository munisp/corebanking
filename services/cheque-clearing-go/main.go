package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Cheque struct {
	ID             string     `json:"id"`
	TenantID       string     `json:"tenant_id"`
	ChequeNumber   string     `json:"cheque_number"`
	Amount         float64    `json:"amount"`
	Currency       string     `json:"currency"`
	DrawerAccount  string     `json:"drawer_account"`
	PayeeAccount   string     `json:"payee_account"`
	BankCode       string     `json:"bank_code"`
	BranchCode     string     `json:"branch_code"`
	Status         string     `json:"status"` // pending | clearing | cleared | dishonored | returned
	PresentedAt    time.Time  `json:"presented_at"`
	ClearedAt      *time.Time `json:"cleared_at,omitempty"`
	DishonorReason string     `json:"dishonor_reason,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

var (
	mu      sync.RWMutex
	cheques = map[string]*Cheque{}
)

func newID() string { return fmt.Sprintf("chq_%d", time.Now().UnixNano()) }

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func listCheques(tenantID, status string, page, limit int) ([]*Cheque, int) {
	mu.RLock()
	defer mu.RUnlock()
	var out []*Cheque
	for _, c := range cheques {
		if tenantID != "" && c.TenantID != tenantID {
			continue
		}
		if status != "" && c.Status != status {
			continue
		}
		out = append(out, c)
	}
	total := len(out)
	offset := (page - 1) * limit
	if offset >= total {
		return []*Cheque{}, total
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return out[offset:end], total
}

func getCheque(id string) (*Cheque, bool) {
	mu.RLock()
	defer mu.RUnlock()
	c, ok := cheques[id]
	return c, ok
}

func insertCheque(c *Cheque) {
	mu.Lock()
	defer mu.Unlock()
	cheques[c.ID] = c
}

func setStatus(id, status, dishonorReason string) bool {
	mu.Lock()
	defer mu.Unlock()
	c, ok := cheques[id]
	if !ok {
		return false
	}
	c.Status = status
	c.UpdatedAt = time.Now()
	if status == "cleared" {
		now := time.Now()
		c.ClearedAt = &now
	}
	if dishonorReason != "" {
		c.DishonorReason = dishonorReason
	}
	return true
}

func chequeStats(tenantID string) map[string]any {
	mu.RLock()
	defer mu.RUnlock()
	counts := map[string]int{"pending": 0, "clearing": 0, "cleared": 0, "dishonored": 0, "returned": 0}
	var totalAmount float64
	for _, c := range cheques {
		if tenantID != "" && c.TenantID != tenantID {
			continue
		}
		counts[c.Status]++
		totalAmount += c.Amount
	}
	total := 0
	for _, v := range counts {
		total += v
	}
	return map[string]any{"total": total, "total_amount": totalAmount, "by_status": counts}
}

// ── Handlers ─────────────────────────────────────────────────────────────────

func handleList(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	if tenantID == "" {
		tenantID = r.URL.Query().Get("tenant_id")
	}
	status := r.URL.Query().Get("status")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	items, total := listCheques(tenantID, status, page, limit)
	if items == nil {
		items = []*Cheque{}
	}
	jsonOK(w, map[string]any{"items": items, "total": total, "page": page, "limit": limit})
}

func handleSubmit(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("x-tenant-id")
	if tenantID == "" {
		tenantID = r.URL.Query().Get("tenantId")
	}
	if tenantID == "" {
		jsonErr(w, "x-tenant-id header required", http.StatusBadRequest)
		return
	}
	var req struct {
		ChequeNumber  string  `json:"cheque_number"`
		Amount        float64 `json:"amount"`
		Currency      string  `json:"currency"`
		DrawerAccount string  `json:"drawer_account"`
		PayeeAccount  string  `json:"payee_account"`
		BankCode      string  `json:"bank_code"`
		BranchCode    string  `json:"branch_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.ChequeNumber == "" || req.Amount <= 0 || req.DrawerAccount == "" || req.PayeeAccount == "" {
		jsonErr(w, "cheque_number, amount, drawer_account and payee_account are required", http.StatusBadRequest)
		return
	}
	if req.Currency == "" {
		req.Currency = "NGN"
	}
	now := time.Now()
	c := &Cheque{
		ID: newID(), TenantID: tenantID, ChequeNumber: req.ChequeNumber,
		Amount: req.Amount, Currency: req.Currency,
		DrawerAccount: req.DrawerAccount, PayeeAccount: req.PayeeAccount,
		BankCode: req.BankCode, BranchCode: req.BranchCode,
		Status: "pending", PresentedAt: now, CreatedAt: now, UpdatedAt: now,
	}
	insertCheque(c)
	w.WriteHeader(http.StatusCreated)
	jsonOK(w, c)
}

// ── Router ───────────────────────────────────────────────────────────────────

func route(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Path
	m := r.Method

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")
	if m == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	switch {
	case p == "/healthz" || p == "/health" || p == "/livez" || p == "/readyz":
		jsonOK(w, map[string]string{"status": "ok", "service": "cheque-clearing-go"})

	case p == "/api/v1/cheques" && m == http.MethodGet:
		handleList(w, r)

	case p == "/api/v1/cheques" && m == http.MethodPost:
		handleSubmit(w, r)

	case p == "/api/v1/cheques/stats" && m == http.MethodGet:
		tenantID := r.URL.Query().Get("tenantId")
		jsonOK(w, chequeStats(tenantID))

	case strings.HasPrefix(p, "/api/v1/cheques/") && strings.HasSuffix(p, "/approve"):
		id := strings.TrimSuffix(strings.TrimPrefix(p, "/api/v1/cheques/"), "/approve")
		if !setStatus(id, "cleared", "") {
			jsonErr(w, "cheque not found", http.StatusNotFound)
			return
		}
		c, _ := getCheque(id)
		jsonOK(w, c)

	case strings.HasPrefix(p, "/api/v1/cheques/") && strings.HasSuffix(p, "/dishonor"):
		id := strings.TrimSuffix(strings.TrimPrefix(p, "/api/v1/cheques/"), "/dishonor")
		var body struct{ Reason string `json:"reason"` }
		json.NewDecoder(r.Body).Decode(&body)
		reason := body.Reason
		if reason == "" {
			reason = "insufficient funds"
		}
		if !setStatus(id, "dishonored", reason) {
			jsonErr(w, "cheque not found", http.StatusNotFound)
			return
		}
		c, _ := getCheque(id)
		jsonOK(w, c)

	case strings.HasPrefix(p, "/api/v1/cheques/") && m == http.MethodGet:
		id := strings.TrimPrefix(p, "/api/v1/cheques/")
		c, ok := getCheque(id)
		if !ok {
			jsonErr(w, "cheque not found", http.StatusNotFound)
			return
		}
		jsonOK(w, c)

	default:
		jsonErr(w, fmt.Sprintf("not found: %s %s", m, p), http.StatusNotFound)
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	http.HandleFunc("/", route)
	log.Printf("cheque-clearing-go listening on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
