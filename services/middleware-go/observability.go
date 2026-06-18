package middleware

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sync"
	"time"
)

// E1: Observability — Distributed tracing, structured logging, metrics collection
// E2: Database operations — Connection pooling, query monitoring
// E4: Disaster recovery — Health monitoring, circuit breakers

type MetricPoint struct {
	Name      string            `json:"name"`
	Value     float64           `json:"value"`
	Labels    map[string]string `json:"labels"`
	Timestamp time.Time         `json:"timestamp"`
}

type Histogram struct {
	mu      sync.Mutex
	name    string
	values  []float64
	buckets []float64
	counts  map[float64]int
	sum     float64
	count   int
}

func NewHistogram(name string, buckets []float64) *Histogram {
	h := &Histogram{
		name:    name,
		buckets: buckets,
		counts:  make(map[float64]int),
	}
	for _, b := range buckets {
		h.counts[b] = 0
	}
	return h
}

func (h *Histogram) Observe(value float64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.values = append(h.values, value)
	h.sum += value
	h.count++
	for _, b := range h.buckets {
		if value <= b {
			h.counts[b]++
		}
	}
}

func (h *Histogram) Percentile(p float64) float64 {
	h.mu.Lock()
	defer h.mu.Unlock()
	if len(h.values) == 0 {
		return 0
	}
	sorted := make([]float64, len(h.values))
	copy(sorted, h.values)
	for i := range sorted {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j] < sorted[i] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	idx := int(math.Ceil(p/100*float64(len(sorted)))) - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}

// Circuit Breaker for service resilience
type CircuitBreaker struct {
	mu            sync.Mutex
	name          string
	state         string // closed, open, half_open
	failures      int
	successes     int
	threshold     int
	resetTimeout  time.Duration
	lastFailureAt time.Time
}

func NewCircuitBreaker(name string, threshold int, resetTimeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		name:         name,
		state:        "closed",
		threshold:    threshold,
		resetTimeout: resetTimeout,
	}
}

func (cb *CircuitBreaker) AllowRequest() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case "closed":
		return true
	case "open":
		if time.Since(cb.lastFailureAt) > cb.resetTimeout {
			cb.state = "half_open"
			return true
		}
		return false
	case "half_open":
		return true
	}
	return true
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.successes++
	if cb.state == "half_open" && cb.successes >= 3 {
		cb.state = "closed"
		cb.failures = 0
		cb.successes = 0
	}
}

func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailureAt = time.Now()
	if cb.failures >= cb.threshold {
		cb.state = "open"
	}
}

func (cb *CircuitBreaker) Status() map[string]interface{} {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return map[string]interface{}{
		"name":      cb.name,
		"state":     cb.state,
		"failures":  cb.failures,
		"successes": cb.successes,
		"threshold": cb.threshold,
	}
}

// Health Monitor
type HealthMonitor struct {
	mu       sync.RWMutex
	services map[string]*ServiceHealth
}

type ServiceHealth struct {
	Name            string    `json:"name"`
	Status          string    `json:"status"` // healthy, degraded, unhealthy
	LastChecked     time.Time `json:"lastChecked"`
	ResponseTimeMs  float64   `json:"responseTimeMs"`
	ConsecutiveFail int       `json:"consecutiveFailures"`
	Uptime          float64   `json:"uptimePercent"`
	TotalChecks     int       `json:"totalChecks"`
	SuccessChecks   int       `json:"successChecks"`
}

func NewHealthMonitor() *HealthMonitor {
	services := []string{
		"agriculture-banking", "teller-operations", "islamic-banking", "trade-finance",
		"mortgage-servicing", "esusu-groups", "virtual-accounts", "agent-banking",
		"group-lending", "education-loans", "ledger-reconciliation", "identity-channels",
		"dispute-management", "erpnext-sync", "regulatory-reporting", "security-gateway",
		"resilience-service", "payments-hub", "savings-products", "card-management",
		"treasury-liquidity", "customer-engagement", "fraud-detection",
	}
	m := &HealthMonitor{services: make(map[string]*ServiceHealth)}
	for _, s := range services {
		m.services[s] = &ServiceHealth{Name: s, Status: "healthy"}
	}
	return m
}

func (hm *HealthMonitor) RecordCheck(name string, healthy bool, responseTimeMs float64) {
	hm.mu.Lock()
	defer hm.mu.Unlock()
	s, ok := hm.services[name]
	if !ok {
		s = &ServiceHealth{Name: name}
		hm.services[name] = s
	}
	s.LastChecked = time.Now()
	s.ResponseTimeMs = responseTimeMs
	s.TotalChecks++
	if healthy {
		s.SuccessChecks++
		s.ConsecutiveFail = 0
		s.Status = "healthy"
	} else {
		s.ConsecutiveFail++
		if s.ConsecutiveFail >= 3 {
			s.Status = "unhealthy"
		} else {
			s.Status = "degraded"
		}
	}
	if s.TotalChecks > 0 {
		s.Uptime = float64(s.SuccessChecks) / float64(s.TotalChecks) * 100
	}
}

func (hm *HealthMonitor) GetStatus() map[string]*ServiceHealth {
	hm.mu.RLock()
	defer hm.mu.RUnlock()
	result := make(map[string]*ServiceHealth)
	for k, v := range hm.services {
		result[k] = v
	}
	return result
}

func ObservabilityHandler(hm *HealthMonitor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		status := hm.GetStatus()
		overallHealthy := true
		for _, s := range status {
			if s.Status == "unhealthy" {
				overallHealthy = false
				break
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"overall": func() string {
				if overallHealthy {
					return "healthy"
				}
				return "degraded"
			}(),
			"services":  status,
			"timestamp": time.Now().UTC(),
			"version":   "1.0.0",
		})
	}
}

// Trace context for distributed tracing
type TraceContext struct {
	TraceID       string    `json:"traceId"`
	SpanID        string    `json:"spanId"`
	ParentSpanID  string    `json:"parentSpanId,omitempty"`
	ServiceName   string    `json:"serviceName"`
	OperationName string    `json:"operationName"`
	StartTime     time.Time `json:"startTime"`
	Duration      int64     `json:"durationMs"`
	Status        string    `json:"status"`
	Tags          map[string]string `json:"tags,omitempty"`
}

type TraceCollector struct {
	mu     sync.Mutex
	traces []TraceContext
}

func NewTraceCollector() *TraceCollector {
	return &TraceCollector{}
}

func (tc *TraceCollector) StartSpan(traceID, serviceName, operation string) *TraceContext {
	return &TraceContext{
		TraceID:       traceID,
		SpanID:        fmt.Sprintf("span-%d", time.Now().UnixNano()),
		ServiceName:   serviceName,
		OperationName: operation,
		StartTime:     time.Now(),
		Status:        "in_progress",
		Tags:          make(map[string]string),
	}
}

func (tc *TraceCollector) EndSpan(span *TraceContext, status string) {
	span.Duration = time.Since(span.StartTime).Milliseconds()
	span.Status = status
	tc.mu.Lock()
	tc.traces = append(tc.traces, *span)
	tc.mu.Unlock()
}

func (tc *TraceCollector) GetTraces() []TraceContext {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	result := make([]TraceContext, len(tc.traces))
	copy(result, tc.traces)
	return result
}
