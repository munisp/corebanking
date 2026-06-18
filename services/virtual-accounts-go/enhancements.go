package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// B6: Virtual Account Enhancements
// Sub-accounts, sweeping, auto-settlement, VAN lifecycle management

type SubAccount struct {
	ID             string  `json:"id"`
	ParentVAID     string  `json:"parentVirtualAccountId"`
	Label          string  `json:"label"`
	Purpose        string  `json:"purpose"` // collections, payroll, escrow, settlement
	Balance        float64 `json:"balance"`
	AutoSweep      bool    `json:"autoSweep"`
	SweepThreshold float64 `json:"sweepThreshold"`
	SweepTarget    string  `json:"sweepTargetAccount"`
	Status         string  `json:"status"`
}

type SweepInstruction struct {
	ID          string    `json:"id"`
	SubAccountID string  `json:"subAccountId"`
	Amount      float64   `json:"amount"`
	TargetAccount string  `json:"targetAccount"`
	ExecutedAt  time.Time `json:"executedAt"`
	Status      string    `json:"status"`
}

type AutoSettlement struct {
	ID          string  `json:"id"`
	VAID        string  `json:"virtualAccountId"`
	Frequency   string  `json:"frequency"` // daily, weekly, monthly
	SettlementAccount string `json:"settlementAccount"`
	MinAmount   float64 `json:"minAmount"`
	Enabled     bool    `json:"enabled"`
}

var (
	vaEnhMu     sync.RWMutex
	subAccounts []SubAccount
	sweeps      []SweepInstruction
	settlements []AutoSettlement
)

func RegisterVAEnhancements(mux *http.ServeMux) {
	mux.HandleFunc("/v1/virtual-accounts/sub-accounts", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var sa SubAccount
			json.NewDecoder(r.Body).Decode(&sa)
			sa.ID = fmt.Sprintf("SUB-%d", time.Now().UnixNano())
			sa.Status = "active"
			vaEnhMu.Lock()
			subAccounts = append(subAccounts, sa)
			vaEnhMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(sa)
			return
		}
		vaEnhMu.RLock()
		defer vaEnhMu.RUnlock()
		json.NewEncoder(w).Encode(subAccounts)
	})

	mux.HandleFunc("/v1/virtual-accounts/sweep", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var sw SweepInstruction
			json.NewDecoder(r.Body).Decode(&sw)
			sw.ID = fmt.Sprintf("SWP-%d", time.Now().UnixNano())
			sw.ExecutedAt = time.Now()
			sw.Status = "completed"
			vaEnhMu.Lock()
			sweeps = append(sweeps, sw)
			vaEnhMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(sw)
			return
		}
		vaEnhMu.RLock()
		defer vaEnhMu.RUnlock()
		json.NewEncoder(w).Encode(sweeps)
	})

	mux.HandleFunc("/v1/virtual-accounts/auto-settlement", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "POST" {
			var as AutoSettlement
			json.NewDecoder(r.Body).Decode(&as)
			as.ID = fmt.Sprintf("AST-%d", time.Now().UnixNano())
			as.Enabled = true
			vaEnhMu.Lock()
			settlements = append(settlements, as)
			vaEnhMu.Unlock()
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(as)
			return
		}
		vaEnhMu.RLock()
		defer vaEnhMu.RUnlock()
		json.NewEncoder(w).Encode(settlements)
	})
}
