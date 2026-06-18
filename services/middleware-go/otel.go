package middleware

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"time"
)

// OpenTelemetry-compatible distributed tracing for Go microservices
// Uses MetricPoint from observability.go, adds Span and OTelCollector

type Span struct {
	TraceID    string            `json:"trace_id"`
	SpanID     string            `json:"span_id"`
	ParentID   string            `json:"parent_id,omitempty"`
	Operation  string            `json:"operation"`
	Service    string            `json:"service"`
	Status     string            `json:"status"`
	StartTime  string            `json:"start_time"`
	EndTime    string            `json:"end_time,omitempty"`
	DurationMs float64           `json:"duration_ms"`
	Attributes map[string]string `json:"attributes,omitempty"`
}

type OTelCollector struct {
	mu      sync.RWMutex
	spans   []Span
	metrics []MetricPoint
	service string
}

func NewOTelCollector(service string) *OTelCollector {
	return &OTelCollector{
		spans:   make([]Span, 0),
		metrics: make([]MetricPoint, 0),
		service: service,
	}
}

func genTraceHex(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = "0123456789abcdef"[rand.Intn(16)]
	}
	return string(b)
}

func (c *OTelCollector) StartSpan(operation string) Span {
	return Span{
		TraceID:    genTraceHex(32),
		SpanID:     genTraceHex(16),
		Operation:  operation,
		Service:    c.service,
		Status:     "ok",
		StartTime:  time.Now().UTC().Format(time.RFC3339Nano),
		Attributes: make(map[string]string),
	}
}

func (c *OTelCollector) EndSpan(span Span) {
	c.mu.Lock()
	defer c.mu.Unlock()
	span.EndTime = time.Now().UTC().Format(time.RFC3339Nano)
	c.spans = append(c.spans, span)
}

func (c *OTelCollector) RecordOTelMetric(name string, value float64, labels map[string]string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.metrics = append(c.metrics, MetricPoint{
		Name:      name,
		Value:     value,
		Labels:    labels,
		Timestamp: time.Now(),
	})
}

func (c *OTelCollector) GetSpans() []Span {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return append([]Span{}, c.spans...)
}

func (c *OTelCollector) GetOTelMetrics() []MetricPoint {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return append([]MetricPoint{}, c.metrics...)
}

// TracingMiddleware wraps HTTP handlers with distributed tracing
func (c *OTelCollector) TracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		span := c.StartSpan(fmt.Sprintf("%s %s", r.Method, r.URL.Path))
		span.Attributes["http.method"] = r.Method
		span.Attributes["http.url"] = r.URL.String()
		span.Attributes["http.user_agent"] = r.UserAgent()

		start := time.Now()
		next.ServeHTTP(w, r)
		duration := time.Since(start)

		span.DurationMs = float64(duration.Milliseconds())
		c.EndSpan(span)

		c.RecordOTelMetric("http_request_duration_ms", span.DurationMs,
			map[string]string{"method": r.Method, "path": r.URL.Path, "service": c.service})
		c.RecordOTelMetric("http_requests_total", 1,
			map[string]string{"method": r.Method, "path": r.URL.Path, "service": c.service})
	})
}

// PrometheusHandler returns summary metrics as JSON
func (c *OTelCollector) PrometheusHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		metrics := c.GetOTelMetrics()
		summary := map[string]interface{}{
			"service":       c.service,
			"total_spans":   len(c.GetSpans()),
			"total_metrics": len(metrics),
		}
		json.NewEncoder(w).Encode(summary)
	}
}
