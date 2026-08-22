package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type PoolStructure struct {
	ID            string   `json:"id"`
	PoolName      string   `json:"poolName"`
	PoolType      string   `json:"poolType"` // zero_balance, target_balance, notional, hybrid
	HeaderAccount string   `json:"headerAccount"`
	HeaderName    string   `json:"headerName"`
	Currency      string   `json:"currency"`
	ChildAccounts []ChildAccount `json:"childAccounts"`
	SweepFrequency string  `json:"sweepFrequency"` // real_time, eod, intraday
	Status        string   `json:"status"`
	CreatedDate   string   `json:"createdDate"`
}

type ChildAccount struct {
	AccountID    string  `json:"accountId"`
	AccountName  string  `json:"accountName"`
	BranchCode   string  `json:"branchCode"`
	Balance      float64 `json:"balance"`
	TargetBalance float64 `json:"targetBalance,omitempty"`
	LastSweepDate string `json:"lastSweepDate"`
	LastSweepAmount float64 `json:"lastSweepAmount"`
}

type SweepTransaction struct {
	ID              string  `json:"id"`
	PoolID          string  `json:"poolId"`
	FromAccount     string  `json:"fromAccount"`
	ToAccount       string  `json:"toAccount"`
	Amount          float64 `json:"amount"`
	SweepType       string  `json:"sweepType"` // sweep_in, sweep_out, zero_balance, target_top_up
	ExecutedAt      string  `json:"executedAt"`
	Status          string  `json:"status"`
	ReferenceNumber string  `json:"referenceNumber"`
}

type SweepExecRequest struct {
	PoolID string `json:"poolId"`
}

var (
	pools  []PoolStructure
	sweeps []SweepTransaction
	mu     sync.Mutex
)

func init() {
	pools = []PoolStructure{
		{
			ID: "POOL-001", PoolName: "Dangote Group ZBA Pool", PoolType: "zero_balance",
			HeaderAccount: "0012345678", HeaderName: "Dangote Industries Master Account",
			Currency: "NGN", SweepFrequency: "eod", Status: "active", CreatedDate: "2025-06-15",
			ChildAccounts: []ChildAccount{
				{"0012345679", "Dangote Cement - Operations", "LAG-001", 250_000_000, 0, "2026-05-09", 250_000_000},
				{"0012345680", "Dangote Sugar - Collections", "LAG-002", 180_000_000, 0, "2026-05-09", 180_000_000},
				{"0012345681", "Dangote Flour - Payroll", "ABJ-001", 45_000_000, 0, "2026-05-09", 45_000_000},
				{"0012345682", "Dangote Petrochemicals", "PHC-001", 520_000_000, 0, "2026-05-09", 520_000_000},
			},
		},
		{
			ID: "POOL-002", PoolName: "MTN Nigeria Target Balance", PoolType: "target_balance",
			HeaderAccount: "0098765432", HeaderName: "MTN Nigeria Treasury Master",
			Currency: "NGN", SweepFrequency: "real_time", Status: "active", CreatedDate: "2025-09-01",
			ChildAccounts: []ChildAccount{
				{"0098765433", "MTN - Lagos Collections", "LAG-010", 1_200_000_000, 500_000_000, "2026-05-09", 700_000_000},
				{"0098765434", "MTN - Abuja Operations", "ABJ-005", 350_000_000, 500_000_000, "2026-05-09", -150_000_000},
				{"0098765435", "MTN - PH Regional", "PHC-003", 280_000_000, 200_000_000, "2026-05-09", 80_000_000},
			},
		},
		{
			ID: "POOL-003", PoolName: "Shell Nigeria Notional Pool", PoolType: "notional",
			HeaderAccount: "0055566677", HeaderName: "Shell Petroleum Dev Co Master",
			Currency: "USD", SweepFrequency: "intraday", Status: "active", CreatedDate: "2026-01-10",
			ChildAccounts: []ChildAccount{
				{"0055566678", "Shell - Exploration", "LAG-020", 45_000_000, 0, "2026-05-09", 0},
				{"0055566679", "Shell - Production", "PHC-010", 32_000_000, 0, "2026-05-09", 0},
				{"0055566680", "Shell - Marketing", "ABJ-020", 18_000_000, 0, "2026-05-09", 0},
			},
		},
		{
			ID: "POOL-004", PoolName: "Access Corp Hybrid Pool", PoolType: "hybrid",
			HeaderAccount: "0033344455", HeaderName: "Access Corporation Master",
			Currency: "NGN", SweepFrequency: "eod", Status: "active", CreatedDate: "2026-02-01",
			ChildAccounts: []ChildAccount{
				{"0033344456", "Access Bank Retail", "LAG-030", 800_000_000, 200_000_000, "2026-05-09", 600_000_000},
				{"0033344457", "Access Pension", "ABJ-030", 150_000_000, 100_000_000, "2026-05-09", 50_000_000},
			},
		},
	}

	sweeps = []SweepTransaction{
		{"SWP-001", "POOL-001", "0012345679", "0012345678", 250_000_000, "zero_balance", "2026-05-09T23:00:00Z", "completed", "SWP-ZBA-20260509-001"},
		{"SWP-002", "POOL-001", "0012345680", "0012345678", 180_000_000, "zero_balance", "2026-05-09T23:00:00Z", "completed", "SWP-ZBA-20260509-002"},
		{"SWP-003", "POOL-002", "0098765433", "0098765432", 700_000_000, "sweep_out", "2026-05-09T14:30:00Z", "completed", "SWP-TGT-20260509-001"},
		{"SWP-004", "POOL-002", "0098765432", "0098765434", 150_000_000, "target_top_up", "2026-05-09T14:30:00Z", "completed", "SWP-TGT-20260509-002"},
		{"SWP-005", "POOL-004", "0033344456", "0033344455", 600_000_000, "sweep_out", "2026-05-09T23:00:00Z", "completed", "SWP-HYB-20260509-001"},
	}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"status": "ok", "service": "cash-pooling",
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"cp.sweep.executed", "cp.pool.created", "cp.balance.update"}},
				"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"cp:pools", "cp:balances", "cp:sweep_schedules"}},
				"postgres":    map[string]interface{}{"url": os.Getenv("DATABASE_URL"), "tables": []string{"cp_pools", "cp_child_accounts", "cp_sweep_transactions"}},
				"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"cp-sweeps", "cp-audit"}},
				"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "cash-pooling-service"},
				"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"cash_pool", "sweep_transaction"}},
				"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "cash-pooling", "pubsub": "cp-events"},
				"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"cp-balance-stream", "cp-sweep-stream"}},
				"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"SweepExecutionWorkflow", "BalanceReconWorkflow", "NotionalPoolingWorkflow"}},
				"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "interbank-sweep-settlement"},
				"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"cp_header_accounts", "cp_child_accounts", "cp_sweep_entries"}},
				"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"cp_sweep_history", "cp_balance_snapshots"}},
				"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/api/cash-pooling/*"}},
				"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "cp-waf-rules"},
			},
		})
	})

	mux.HandleFunc("/v1/cash-pooling/pools", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		respondJSON(w, 200, map[string]interface{}{"items": pools, "total": len(pools)})
		mu.Unlock()
	})

	mux.HandleFunc("/v1/cash-pooling/sweeps", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			mu.Lock()
			respondJSON(w, 200, map[string]interface{}{"items": sweeps, "total": len(sweeps)})
			mu.Unlock()
			return
		}
		if r.Method == http.MethodPost {
			var req SweepExecRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, 400, map[string]string{"error": "invalid JSON"})
				return
			}
			if req.PoolID == "" {
				respondJSON(w, 400, map[string]string{"error": "poolId is required"})
				return
			}
			mu.Lock()
			defer mu.Unlock()
			var pool *PoolStructure
			for i := range pools {
				if pools[i].ID == req.PoolID {
					pool = &pools[i]
					break
				}
			}
			if pool == nil {
				respondJSON(w, 404, map[string]string{"error": "pool not found"})
				return
			}
			newSweeps := []SweepTransaction{}
			for _, child := range pool.ChildAccounts {
				var amount float64
				var sweepType string
				switch pool.PoolType {
				case "zero_balance":
					amount = child.Balance
					sweepType = "zero_balance"
				case "target_balance":
					amount = child.Balance - child.TargetBalance
					if amount > 0 {
						sweepType = "sweep_out"
					} else {
						sweepType = "target_top_up"
						amount = -amount
					}
				default:
					amount = child.Balance * 0.8
					sweepType = "sweep_out"
				}
				if amount <= 0 {
					continue
				}
				swp := SweepTransaction{
					ID: fmt.Sprintf("SWP-%03d", len(sweeps)+len(newSweeps)+1),
					PoolID: pool.ID,
					FromAccount: child.AccountID, ToAccount: pool.HeaderAccount,
					Amount: amount, SweepType: sweepType,
					ExecutedAt: "2026-05-10T00:00:00Z", Status: "completed",
					ReferenceNumber: fmt.Sprintf("SWP-%s-%03d", pool.PoolType, len(sweeps)+len(newSweeps)+1),
				}
				if sweepType == "target_top_up" {
					swp.FromAccount = pool.HeaderAccount
					swp.ToAccount = child.AccountID
				}
				newSweeps = append(newSweeps, swp)
			}
			sweeps = append(sweeps, newSweeps...)
			respondJSON(w, 201, map[string]interface{}{"executed": len(newSweeps), "sweeps": newSweeps})
			return
		}
		respondJSON(w, 405, map[string]string{"error": "method not allowed"})
	})

	mux.HandleFunc("/v1/cash-pooling/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		totalPoolBalance := 0.0
		totalChildAccounts := 0
		for _, p := range pools {
			for _, c := range p.ChildAccounts {
				totalPoolBalance += c.Balance
				totalChildAccounts++
			}
		}
		totalSwept := 0.0
		for _, s := range sweeps {
			totalSwept += s.Amount
		}
		respondJSON(w, 200, map[string]interface{}{
			"totalPools": len(pools), "totalChildAccounts": totalChildAccounts,
			"totalPoolBalance": totalPoolBalance, "totalSweepTransactions": len(sweeps),
			"totalSweptAmount": totalSwept,
			"byType": map[string]int{
				"zero_balance":   1,
				"target_balance": 1,
				"notional":       1,
				"hybrid":         1,
			},
		})
	})

	port := envOr("PORT", "8159")
	fmt.Printf("Cash Pooling service on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
