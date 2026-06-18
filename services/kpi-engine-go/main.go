// kpi-engine-go — KPI computation and business metrics engine for 54Bank
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

var startTime = time.Now()

func getEnv(k, v string) string {
	if val := os.Getenv(k); val != "" {
		return val
	}
	return v
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

type KPI struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	Value       float64 `json:"value"`
	Target      float64 `json:"target"`
	Unit        string  `json:"unit"`
	Period      string  `json:"period"`
	Trend       string  `json:"trend"`
	TrendValue  float64 `json:"trendValue"`
	ComputedAt  string  `json:"computedAt"`
}

type KPIAlert struct {
	KPIID      string  `json:"kpiId"`
	KPIName    string  `json:"kpiName"`
	Message    string  `json:"message"`
	Severity   string  `json:"severity"`
	ActualValue float64 `json:"actualValue"`
	TargetValue float64 `json:"targetValue"`
	CreatedAt  string  `json:"createdAt"`
}

var (
	mu      sync.RWMutex
	counter int
	kpis    = []KPI{
		{ID: "kpi-001", Name: "Transaction Success Rate", Category: "operations", Value: 98.7, Target: 99.0, Unit: "%", Period: "daily", Trend: "up", TrendValue: 0.3, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-002", Name: "Average Transaction Time", Category: "operations", Value: 1.2, Target: 2.0, Unit: "seconds", Period: "daily", Trend: "down", TrendValue: -0.1, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-003", Name: "Customer Acquisition Rate", Category: "growth", Value: 320, Target: 300, Unit: "customers/day", Period: "daily", Trend: "up", TrendValue: 12.5, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-004", Name: "Loan Approval Rate", Category: "credit", Value: 74.2, Target: 70.0, Unit: "%", Period: "weekly", Trend: "up", TrendValue: 2.1, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-005", Name: "Non-Performing Loan Ratio", Category: "credit", Value: 2.1, Target: 3.0, Unit: "%", Period: "monthly", Trend: "stable", TrendValue: 0.0, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-006", Name: "Revenue per Customer", Category: "finance", Value: 4250.0, Target: 4000.0, Unit: "NGN", Period: "monthly", Trend: "up", TrendValue: 6.25, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-007", Name: "Agent Network Coverage", Category: "agent_banking", Value: 87.3, Target: 90.0, Unit: "%", Period: "monthly", Trend: "up", TrendValue: 1.8, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
		{ID: "kpi-008", Name: "Fraud Detection Rate", Category: "risk", Value: 96.4, Target: 95.0, Unit: "%", Period: "daily", Trend: "stable", TrendValue: 0.1, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
	}
)

func main() {
	port := getEnv("PORT", "9173")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":      "kpi-engine-go",
			"status":       "healthy",
			"uptime_secs":  int(time.Since(startTime).Seconds()),
			"kpis_tracked": len(kpis),
			"categories":   []string{"operations", "growth", "credit", "finance", "agent_banking", "risk"},
		})
	})

	// GET all KPIs (optionally filtered by category)
	mux.HandleFunc("/v1/kpis", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		category := r.URL.Query().Get("category")
		mu.RLock()
		result := make([]KPI, 0, len(kpis))
		for _, k := range kpis {
			if category == "" || k.Category == category {
				result = append(result, k)
			}
		}
		mu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{"kpis": result, "total": len(result)})
	})

	// POST trigger recomputation of all KPIs
	mux.HandleFunc("/v1/kpis/recompute", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		mu.Lock()
		counter++
		// Update computedAt to simulate recompute
		for i := range kpis {
			kpis[i].ComputedAt = time.Now().UTC().Format(time.RFC3339)
		}
		mu.Unlock()
		respondJSON(w, 200, map[string]interface{}{
			"message":    "KPI recomputation triggered",
			"job_id":     fmt.Sprintf("job-%03d", counter),
			"kpis_count": len(kpis),
			"started_at": time.Now().UTC().Format(time.RFC3339),
		})
	})

	// GET KPI by ID
	mux.HandleFunc("/v1/kpis/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		id := r.URL.Path[len("/v1/kpis/"):]
		mu.RLock()
		for _, k := range kpis {
			if k.ID == id {
				mu.RUnlock()
				respondJSON(w, 200, k)
				return
			}
		}
		mu.RUnlock()
		respondJSON(w, 404, map[string]string{"error": "KPI not found"})
	})

	// GET KPI alerts (targets breached)
	mux.HandleFunc("/v1/kpis/alerts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		mu.RLock()
		alerts := []KPIAlert{}
		for _, k := range kpis {
			if k.Trend == "down" && k.Value < k.Target {
				alerts = append(alerts, KPIAlert{
					KPIID:       k.ID,
					KPIName:     k.Name,
					Message:     fmt.Sprintf("%s is below target: %.2f %s (target: %.2f)", k.Name, k.Value, k.Unit, k.Target),
					Severity:    "warning",
					ActualValue: k.Value,
					TargetValue: k.Target,
					CreatedAt:   time.Now().UTC().Format(time.RFC3339),
				})
			}
		}
		mu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{"alerts": alerts, "total": len(alerts)})
	})

	// GET summary stats
	mux.HandleFunc("/v1/kpis/stats", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		mu.RLock()
		onTarget, belowTarget := 0, 0
		for _, k := range kpis {
			if k.Value >= k.Target {
				onTarget++
			} else {
				belowTarget++
			}
		}
		mu.RUnlock()
		respondJSON(w, 200, map[string]interface{}{
			"total_kpis":    len(kpis),
			"on_target":     onTarget,
			"below_target":  belowTarget,
			"last_computed": time.Now().UTC().Format(time.RFC3339),
			"categories":    []string{"operations", "growth", "credit", "finance", "agent_banking", "risk"},
		})
	})

	log.Printf("[kpi-engine-go] KPI engine on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
