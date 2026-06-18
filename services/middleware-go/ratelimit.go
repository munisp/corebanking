package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// A6: Per-tenant and per-service rate limiting with sliding window counters
// Provides: abuse prevention, fair usage, tenant isolation, burst protection

type RateLimitConfig struct {
	RequestsPerMinute int `json:"requestsPerMinute"`
	RequestsPerHour   int `json:"requestsPerHour"`
	BurstSize         int `json:"burstSize"`
}

type RateLimiter struct {
	mu       sync.Mutex
	counters map[string]*slidingWindow
	configs  map[string]RateLimitConfig
	defaults RateLimitConfig
}

type slidingWindow struct {
	timestamps []time.Time
}

var DefaultTierConfigs = map[string]RateLimitConfig{
	"free":       {RequestsPerMinute: 30, RequestsPerHour: 500, BurstSize: 10},
	"basic":      {RequestsPerMinute: 60, RequestsPerHour: 2000, BurstSize: 20},
	"premium":    {RequestsPerMinute: 120, RequestsPerHour: 5000, BurstSize: 50},
	"enterprise": {RequestsPerMinute: 300, RequestsPerHour: 20000, BurstSize: 100},
	"internal":   {RequestsPerMinute: 1000, RequestsPerHour: 100000, BurstSize: 500},
}

func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		counters: make(map[string]*slidingWindow),
		configs:  DefaultTierConfigs,
		defaults: DefaultTierConfigs["basic"],
	}
}

func (rl *RateLimiter) AllowRequest(tenantID, tier string) (bool, int, int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	config, ok := rl.configs[tier]
	if !ok {
		config = rl.defaults
	}

	key := fmt.Sprintf("%s:%s", tenantID, tier)
	window, ok := rl.counters[key]
	if !ok {
		window = &slidingWindow{}
		rl.counters[key] = window
	}

	now := time.Now()
	cutoff := now.Add(-time.Minute)

	// Prune old entries
	var active []time.Time
	for _, ts := range window.timestamps {
		if ts.After(cutoff) {
			active = append(active, ts)
		}
	}
	window.timestamps = active

	remaining := config.RequestsPerMinute - len(window.timestamps)
	if remaining <= 0 {
		return false, 0, config.RequestsPerMinute
	}

	window.timestamps = append(window.timestamps, now)
	return true, remaining - 1, config.RequestsPerMinute
}

// Per-service rate limiting
type ServiceRateLimiter struct {
	mu       sync.Mutex
	counters map[string]int
	limits   map[string]int
	resetAt  time.Time
}

func NewServiceRateLimiter() *ServiceRateLimiter {
	return &ServiceRateLimiter{
		counters: make(map[string]int),
		limits: map[string]int{
			"agriculture-banking":    500,
			"teller-operations":      300,
			"islamic-banking":        200,
			"trade-finance":          200,
			"mortgage-servicing":     200,
			"esusu-groups":           300,
			"virtual-accounts":       500,
			"agent-banking":          400,
			"group-lending":          300,
			"education-loans":        200,
			"ledger-reconciliation":  100,
			"identity-channels":      300,
			"dispute-management":     200,
			"erpnext-sync":           100,
			"regulatory-reporting":   100,
			"payments-hub":           1000,
			"savings-products":       500,
			"card-management":        800,
			"treasury-liquidity":     200,
			"customer-engagement":    500,
			"fraud-detection":        2000,
		},
		resetAt: time.Now().Add(time.Minute),
	}
}

func (srl *ServiceRateLimiter) AllowServiceRequest(serviceName string) (bool, int) {
	srl.mu.Lock()
	defer srl.mu.Unlock()

	if time.Now().After(srl.resetAt) {
		srl.counters = make(map[string]int)
		srl.resetAt = time.Now().Add(time.Minute)
	}

	limit, ok := srl.limits[serviceName]
	if !ok {
		limit = 200
	}

	current := srl.counters[serviceName]
	if current >= limit {
		return false, 0
	}

	srl.counters[serviceName] = current + 1
	return true, limit - current - 1
}

func RateLimitHandler(rl *RateLimiter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"tiers":    DefaultTierConfigs,
			"defaults": rl.defaults,
		})
	}
}
