package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

type AgentTransaction struct {
	TransactionID   string    `json:"transaction_id"`
	AgentID         string    `json:"agent_id"`
	CustomerID      string    `json:"customer_id"`
	TenantID        string    `json:"tenant_id"`
	Amount          float64   `json:"amount"`
	TransactionType string    `json:"transaction_type"`
	Status          string    `json:"status"`
	Description     string    `json:"description"`
	Reference       string    `json:"reference"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (s *AgriculturalService) RegisterAgentBankingRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/agent-banking/stats", s.agentBankingStats).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/agent-banking/list", s.agentBankingList).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/v1/agent-banking", s.createAgentTransaction).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/v1/agent-banking/{id}", s.getAgentTransaction).Methods("GET", "OPTIONS")
}

func (s *AgriculturalService) ensureAgentBankingTable(r *http.Request) error {
	_, err := s.db.ExecContext(r.Context(), `
		CREATE TABLE IF NOT EXISTS agent_transactions (
			transaction_id VARCHAR(64) PRIMARY KEY,
			agent_id       VARCHAR(64) NOT NULL,
			customer_id    VARCHAR(64) NOT NULL,
			tenant_id      VARCHAR(64) NOT NULL,
			amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
			transaction_type VARCHAR(64) NOT NULL DEFAULT 'transfer',
			status         VARCHAR(32) NOT NULL DEFAULT 'pending',
			description    TEXT,
			reference      VARCHAR(128),
			created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	return err
}

func (s *AgriculturalService) agentBankingStats(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	tenantID := r.Header.Get("X-Tenant-ID")
	if err := s.ensureAgentBankingTable(r); err != nil {
		http.Error(w, "table init failed", http.StatusInternalServerError)
		return
	}

	var total int
	s.db.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM agent_transactions WHERE tenant_id = $1`, tenantID).Scan(&total)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total":  total,
		"table":  "agent_transactions",
		"source": "agricultural-service",
	})
}

func (s *AgriculturalService) agentBankingList(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	tenantID := r.Header.Get("X-Tenant-ID")
	if err := s.ensureAgentBankingTable(r); err != nil {
		http.Error(w, "table init failed", http.StatusInternalServerError)
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 25
	}
	offset := (page - 1) * limit

	var total int
	s.db.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM agent_transactions WHERE tenant_id = $1`, tenantID).Scan(&total)

	rows, err := s.db.QueryContext(r.Context(), `
		SELECT transaction_id, agent_id, customer_id, tenant_id, amount, transaction_type,
		       status, description, reference, created_at, updated_at
		FROM agent_transactions
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := make([]AgentTransaction, 0)
	for rows.Next() {
		var t AgentTransaction
		rows.Scan(&t.TransactionID, &t.AgentID, &t.CustomerID, &t.TenantID, &t.Amount,
			&t.TransactionType, &t.Status, &t.Description, &t.Reference, &t.CreatedAt, &t.UpdatedAt)
		items = append(items, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"items":  items,
		"total":  total,
		"page":   page,
		"limit":  limit,
		"source": "agricultural-service",
	})
}

func (s *AgriculturalService) createAgentTransaction(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	tenantID := r.Header.Get("X-Tenant-ID")
	if err := s.ensureAgentBankingTable(r); err != nil {
		http.Error(w, "table init failed", http.StatusInternalServerError)
		return
	}

	var t AgentTransaction
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	t.TransactionID = fmt.Sprintf("TXN%d", time.Now().UnixNano())
	t.TenantID = tenantID
	if t.Status == "" {
		t.Status = "pending"
	}
	t.CreatedAt = time.Now()
	t.UpdatedAt = time.Now()

	_, err := s.db.ExecContext(r.Context(), `
		INSERT INTO agent_transactions (transaction_id, agent_id, customer_id, tenant_id, amount,
			transaction_type, status, description, reference, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		t.TransactionID, t.AgentID, t.CustomerID, t.TenantID, t.Amount,
		t.TransactionType, t.Status, t.Description, t.Reference, t.CreatedAt, t.UpdatedAt)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to create transaction: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

func (s *AgriculturalService) getAgentTransaction(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	tenantID := r.Header.Get("X-Tenant-ID")
	id := mux.Vars(r)["id"]

	var t AgentTransaction
	err := s.db.QueryRowContext(r.Context(), `
		SELECT transaction_id, agent_id, customer_id, tenant_id, amount, transaction_type,
		       status, description, reference, created_at, updated_at
		FROM agent_transactions WHERE transaction_id = $1 AND tenant_id = $2`, id, tenantID).Scan(
		&t.TransactionID, &t.AgentID, &t.CustomerID, &t.TenantID, &t.Amount,
		&t.TransactionType, &t.Status, &t.Description, &t.Reference, &t.CreatedAt, &t.UpdatedAt)

	if err != nil {
		http.Error(w, "transaction not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}
