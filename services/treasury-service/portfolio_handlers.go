package main

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// PortfolioItem is a customer investment portfolio entry (stocks, bonds, mutual funds, real estate).
// Distinct from the institutional Investment type used in treasury operations.
type PortfolioItem struct {
	ID             string    `json:"id"`
	CustomerID     string    `json:"customer_id"`
	TenantID       string    `json:"tenant_id"`
	InvestmentType string    `json:"investment_type"`
	Name           string    `json:"name"`
	Symbol         string    `json:"symbol"`
	Units          float64   `json:"units"`
	PurchasePrice  float64   `json:"purchase_price"`
	CurrentPrice   float64   `json:"current_price"`
	TotalValue     float64   `json:"total_value"`
	ProfitLoss     float64   `json:"profit_loss"`
	Status         string    `json:"status"`
	PurchaseDate   string    `json:"purchase_date"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type portfolioStore struct {
	mu    sync.RWMutex
	items map[string]*PortfolioItem
}

var portfolios = &portfolioStore{items: make(map[string]*PortfolioItem)}

func (s *TreasuryServer) listPortfoliosHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	portfolios.mu.RLock()
	defer portfolios.mu.RUnlock()

	items := make([]*PortfolioItem, 0)
	for _, p := range portfolios.items {
		if p.TenantID == tenantID {
			items = append(items, p)
		}
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

func (s *TreasuryServer) createPortfolioHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	var item PortfolioItem
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	item.ID = uuid.New().String()
	item.TenantID = tenantID
	item.TotalValue = item.Units * item.CurrentPrice
	item.ProfitLoss = (item.CurrentPrice - item.PurchasePrice) * item.Units
	item.Status = coalesce(item.Status, "active")
	item.CreatedAt = time.Now()
	item.UpdatedAt = time.Now()

	portfolios.mu.Lock()
	portfolios.items[item.ID] = &item
	portfolios.mu.Unlock()

	respondJSON(w, http.StatusCreated, item)
}

func (s *TreasuryServer) getPortfolioHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	id := mux.Vars(r)["id"]
	portfolios.mu.RLock()
	item, ok := portfolios.items[id]
	portfolios.mu.RUnlock()
	if !ok || item.TenantID != tenantID {
		respondError(w, http.StatusNotFound, "portfolio item not found")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (s *TreasuryServer) updatePortfolioHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	id := mux.Vars(r)["id"]

	portfolios.mu.Lock()
	defer portfolios.mu.Unlock()

	existing, ok := portfolios.items[id]
	if !ok || existing.TenantID != tenantID {
		respondError(w, http.StatusNotFound, "portfolio item not found")
		return
	}
	var updated PortfolioItem
	if err := json.NewDecoder(r.Body).Decode(&updated); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	updated.ID = id
	updated.TenantID = tenantID
	updated.TotalValue = updated.Units * updated.CurrentPrice
	updated.ProfitLoss = (updated.CurrentPrice - updated.PurchasePrice) * updated.Units
	updated.CreatedAt = existing.CreatedAt
	updated.UpdatedAt = time.Now()
	portfolios.items[id] = &updated
	respondJSON(w, http.StatusOK, updated)
}

func (s *TreasuryServer) deletePortfolioHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := getTenantID(r)
	id := mux.Vars(r)["id"]

	portfolios.mu.Lock()
	defer portfolios.mu.Unlock()

	item, ok := portfolios.items[id]
	if !ok || item.TenantID != tenantID {
		respondError(w, http.StatusNotFound, "portfolio item not found")
		return
	}
	delete(portfolios.items, id)
	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted", "id": id})
}

func coalesce(s, fallback string) string {
	if s != "" {
		return s
	}
	return fallback
}
