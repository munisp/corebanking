package observability

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime"
	"sync/atomic"
	"time"
)

type Metrics struct {
	RequestCount  uint64  `json:"request_count"`
	ErrorCount    uint64  `json:"error_count"`
	AvgLatencyUs  int64   `json:"avg_latency_us"`
	P99LatencyUs  int64   `json:"p99_latency_us"`
	ActiveConns   int32   `json:"active_connections"`
	UptimeSeconds int64   `json:"uptime_seconds"`
	GoRoutines    int     `json:"goroutines"`
	HeapAllocMB   float64 `json:"heap_alloc_mb"`
	GCPauseMs     float64 `json:"gc_pause_ms"`
}

var (
	startTime    = time.Now()
	totalLatency int64
	maxLatency   int64
)

func CollectMetrics(requestCount, errorCount *uint64) Metrics {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	rc := atomic.LoadUint64(requestCount)
	avgLatency := int64(0)
	if rc > 0 {
		avgLatency = atomic.LoadInt64(&totalLatency) / int64(rc)
	}
	return Metrics{
		RequestCount:  rc,
		ErrorCount:    atomic.LoadUint64(errorCount),
		AvgLatencyUs:  avgLatency,
		P99LatencyUs:  atomic.LoadInt64(&maxLatency),
		UptimeSeconds: int64(time.Since(startTime).Seconds()),
		GoRoutines:    runtime.NumGoroutine(),
		HeapAllocMB:   float64(m.HeapAlloc) / 1024 / 1024,
		GCPauseMs:     float64(m.PauseNs[(m.NumGC+255)%256]) / 1e6,
	}
}

func RecordLatency(durationUs int64) {
	atomic.AddInt64(&totalLatency, durationUs)
	for {
		old := atomic.LoadInt64(&maxLatency)
		if durationUs <= old || atomic.CompareAndSwapInt64(&maxLatency, old, durationUs) {
			break
		}
	}
}

type StructuredLogger struct {
	service string
	fields  map[string]interface{}
}

func NewLogger(service string) *StructuredLogger {
	return &StructuredLogger{service: service, fields: make(map[string]interface{})}
}

func (l *StructuredLogger) With(key string, value interface{}) *StructuredLogger {
	copy := &StructuredLogger{service: l.service, fields: make(map[string]interface{})}
	for k, v := range l.fields {
		copy.fields[k] = v
	}
	copy.fields[key] = value
	return copy
}

func (l *StructuredLogger) log(level string, msg string) {
	entry := map[string]interface{}{
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		"level":     level,
		"service":   l.service,
		"message":   msg,
	}
	for k, v := range l.fields {
		entry[k] = v
	}
	data, _ := json.Marshal(entry)
	fmt.Fprintln(os.Stderr, string(data))
}

func (l *StructuredLogger) Info(msg string)  { l.log("info", msg) }
func (l *StructuredLogger) Warn(msg string)  { l.log("warn", msg) }
func (l *StructuredLogger) Error(msg string) { l.log("error", msg) }
func (l *StructuredLogger) Debug(msg string) { l.log("debug", msg) }

type TraceContext struct {
	TraceID  string `json:"trace_id"`
	SpanID   string `json:"span_id"`
	ParentID string `json:"parent_id,omitempty"`
}

func ExtractTrace(r *http.Request) TraceContext {
	return TraceContext{
		TraceID:  r.Header.Get("X-Trace-ID"),
		SpanID:   r.Header.Get("X-Span-ID"),
		ParentID: r.Header.Get("X-Parent-ID"),
	}
}

func InjectTrace(r *http.Request, tc TraceContext) {
	r.Header.Set("X-Trace-ID", tc.TraceID)
	r.Header.Set("X-Span-ID", tc.SpanID)
	if tc.ParentID != "" {
		r.Header.Set("X-Parent-ID", tc.ParentID)
	}
}

type HealthChecker struct {
	checks map[string]func() error
}

func NewHealthChecker() *HealthChecker {
	return &HealthChecker{checks: make(map[string]func() error)}
}

func (hc *HealthChecker) Register(name string, check func() error) {
	hc.checks[name] = check
}

func (hc *HealthChecker) Check() (bool, map[string]string) {
	results := make(map[string]string)
	allOK := true
	for name, check := range hc.checks {
		if err := check(); err != nil {
			results[name] = "unhealthy: " + err.Error()
			allOK = false
		} else {
			results[name] = "healthy"
		}
	}
	return allOK, results
}

func init() {
	log.SetFlags(0) // Disable default log flags for structured logging
}
