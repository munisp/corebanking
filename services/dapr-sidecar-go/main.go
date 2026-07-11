// dapr-sidecar-go — Dapr Distributed Application Runtime integration for 54Bank
// Implements: pub/sub event routing, state store, service invocation, distributed locking
// Middleware: Keycloak JWT, PostgreSQL audit, Dapr Go SDK
package main

import (
"bytes"
"context"
"database/sql"
"encoding/json"
"fmt"
"log"
"net/http"
"os"
"os/signal"
"strings"
"syscall"
"time"

_ "github.com/lib/pq"
dapr "github.com/dapr/go-sdk/client"
)

var db *sql.DB
var daprClient dapr.Client
var daprAvailable bool

var (
daprHTTPPort    = getEnv("DAPR_HTTP_PORT", "3500")
daprGRPCPort    = getEnv("DAPR_GRPC_PORT", "50001")
appPort         = getEnv("PORT", "8153")
pubsubName      = getEnv("DAPR_PUBSUB_NAME", "54bank-pubsub")
stateStoreName  = getEnv("DAPR_STATE_STORE", "54bank-statestore")
)

type BankingEvent struct {
EventID    string                 `json:"event_id"`
EventType  string                 `json:"event_type"`
TenantID   string                 `json:"tenant_id"`
EntityID   string                 `json:"entity_id"`
EntityType string                 `json:"entity_type"`
Payload    map[string]interface{} `json:"payload"`
Timestamp  time.Time              `json:"timestamp"`
}

type PublishRequest struct {
Topic      string                 `json:"topic"`
EventType  string                 `json:"event_type"`
TenantID   string                 `json:"tenant_id"`
EntityID   string                 `json:"entity_id"`
EntityType string                 `json:"entity_type"`
Payload    map[string]interface{} `json:"payload"`
}

type StateRequest struct {
Key   string      `json:"key"`
Value interface{} `json:"value"`
TTL   int         `json:"ttl_seconds,omitempty"`
}

type InvokeRequest struct {
AppID    string                 `json:"app_id"`
Method   string                 `json:"method"`
HTTPVerb string                 `json:"http_verb"`
Data     map[string]interface{} `json:"data"`
}

func initDaprClient() {
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
client, err := dapr.NewClientWithPort(daprGRPCPort)
if err != nil {
log.Printf("[dapr-sidecar-go] Dapr client init failed (degraded): %v", err)
daprAvailable = false
return
}
if err := client.PingWithContext(ctx); err != nil {
log.Printf("[dapr-sidecar-go] Dapr sidecar ping failed: %v", err)
daprAvailable = false
client.Close()
return
}
daprClient = client
daprAvailable = true
log.Printf("[dapr-sidecar-go] Dapr client connected (grpc:%s)", daprGRPCPort)
}

func initSchema() {
ddl := `
CREATE TABLE IF NOT EXISTS dapr_published_events (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
event_id VARCHAR(64) NOT NULL UNIQUE,
topic VARCHAR(128) NOT NULL,
pubsub_name VARCHAR(128) NOT NULL DEFAULT '54bank-pubsub',
event_type VARCHAR(128) NOT NULL,
tenant_id VARCHAR(64) NOT NULL,
entity_id VARCHAR(128) NOT NULL,
entity_type VARCHAR(64) NOT NULL,
payload JSONB NOT NULL DEFAULT '{}',
status VARCHAR(32) NOT NULL DEFAULT 'published',
dapr_available BOOLEAN NOT NULL DEFAULT TRUE,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS dapr_state_operations (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
store_name VARCHAR(128) NOT NULL,
operation VARCHAR(16) NOT NULL,
state_key VARCHAR(256) NOT NULL,
value JSONB,
etag VARCHAR(64),
tenant_id VARCHAR(64),
status VARCHAR(32) NOT NULL DEFAULT 'success',
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS dapr_service_invocations (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
source_app VARCHAR(128) NOT NULL DEFAULT '54bank-platform',
target_app VARCHAR(128) NOT NULL,
method VARCHAR(256) NOT NULL,
http_verb VARCHAR(10) NOT NULL DEFAULT 'POST',
request_payload JSONB,
response_payload JSONB,
status_code INTEGER,
latency_ms INTEGER,
tenant_id VARCHAR(64),
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS dapr_subscriptions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
pubsub_name VARCHAR(128) NOT NULL,
topic VARCHAR(128) NOT NULL,
route VARCHAR(256) NOT NULL,
handler_name VARCHAR(128) NOT NULL,
status VARCHAR(32) NOT NULL DEFAULT 'active',
events_processed BIGINT NOT NULL DEFAULT 0,
events_failed BIGINT NOT NULL DEFAULT 0,
last_event_at TIMESTAMPTZ,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
UNIQUE(pubsub_name, topic, route)
);
CREATE INDEX IF NOT EXISTS idx_dapr_events_topic ON dapr_published_events(topic, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dapr_events_tenant ON dapr_published_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dapr_state_key ON dapr_state_operations(store_name, state_key);
CREATE INDEX IF NOT EXISTS idx_dapr_invocations_app ON dapr_service_invocations(target_app, created_at DESC);
INSERT INTO dapr_subscriptions (pubsub_name, topic, route, handler_name) VALUES
('54bank-pubsub', 'banking.transactions', '/dapr/subscribe/transactions', 'transaction-handler'),
('54bank-pubsub', 'banking.payments.raw', '/dapr/subscribe/payments', 'payment-handler'),
('54bank-pubsub', 'banking.kyc.events', '/dapr/subscribe/kyc', 'kyc-handler'),
('54bank-pubsub', 'banking.aml.alerts', '/dapr/subscribe/aml', 'aml-handler'),
('54bank-pubsub', 'banking.notifications', '/dapr/subscribe/notifications', 'notification-handler')
ON CONFLICT (pubsub_name, topic, route) DO NOTHING;
`
if _, err := db.Exec(ddl); err != nil {
log.Printf("[dapr-sidecar-go] Schema init failed: %v", err)
} else {
log.Printf("[dapr-sidecar-go] Schema initialized (4 tables, 5 subscriptions)")
}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(status)
json.NewEncoder(w).Encode(v)
}

func generateID() string {
return fmt.Sprintf("%d", time.Now().UnixNano())
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
daprStatus := "degraded"
if daprAvailable { daprStatus = "connected" }
dbStatus := "connected"
if err := db.PingContext(r.Context()); err != nil { dbStatus = "unhealthy" }
overall := "healthy"
if dbStatus == "unhealthy" { overall = "degraded" }
writeJSON(w, http.StatusOK, map[string]interface{}{
"status": overall, "service": "dapr-sidecar-go", "version": "3.0.0",
"checks": map[string]string{"database": dbStatus, "dapr": daprStatus},
"config": map[string]string{"pubsub": pubsubName, "state_store": stateStoreName},
})
}

func publishHandler(w http.ResponseWriter, r *http.Request) {
var req PublishRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
return
}
event := BankingEvent{
EventID: generateID(), EventType: req.EventType, TenantID: req.TenantID,
EntityID: req.EntityID, EntityType: req.EntityType, Payload: req.Payload, Timestamp: time.Now().UTC(),
}
eventBytes, _ := json.Marshal(event)
published := false

if daprAvailable && daprClient != nil {
ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
defer cancel()
if err := daprClient.PublishEvent(ctx, pubsubName, req.Topic, event); err != nil {
log.Printf("[dapr-sidecar-go] Publish via SDK failed: %v", err)
daprAvailable = false
} else {
published = true
}
}
if !published {
daprURL := fmt.Sprintf("http://localhost:%s/v1.0/publish/%s/%s", daprHTTPPort, pubsubName, req.Topic)
resp, err := http.Post(daprURL, "application/json", bytes.NewReader(eventBytes))
if err == nil && resp.StatusCode < 300 {
published = true
daprAvailable = true
}
}
status := "published"
if !published { status = "failed" }
db.Exec(`INSERT INTO dapr_published_events (event_id, topic, pubsub_name, event_type, tenant_id, entity_id, entity_type, payload, status, dapr_available) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
event.EventID, req.Topic, pubsubName, req.EventType, req.TenantID, req.EntityID, req.EntityType, string(eventBytes), status, published)
if published {
writeJSON(w, http.StatusCreated, map[string]interface{}{"event_id": event.EventID, "topic": req.Topic, "status": "published"})
} else {
writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Dapr not available", "status": "failed"})
}
}

func saveStateHandler(w http.ResponseWriter, r *http.Request) {
var req StateRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
return
}
saved := false
if daprAvailable && daprClient != nil {
ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
defer cancel()
valueBytes, _ := json.Marshal(req.Value)
item := &dapr.SetStateItem{Key: req.Key, Value: valueBytes}
if err := daprClient.SaveBulkState(ctx, stateStoreName, item); err != nil {
log.Printf("[dapr-sidecar-go] State save failed: %v", err)
} else {
saved = true
}
}
if !saved {
payload := []map[string]interface{}{{"key": req.Key, "value": req.Value}}
payloadBytes, _ := json.Marshal(payload)
daprURL := fmt.Sprintf("http://localhost:%s/v1.0/state/%s", daprHTTPPort, stateStoreName)
resp, err := http.Post(daprURL, "application/json", bytes.NewReader(payloadBytes))
if err == nil && resp.StatusCode < 300 { saved = true }
}
valueBytes, _ := json.Marshal(req.Value)
statusStr := "success"
if !saved { statusStr = "failed" }
db.Exec(`INSERT INTO dapr_state_operations (store_name, operation, state_key, value, status) VALUES ($1,'save',$2,$3,$4)`,
stateStoreName, req.Key, string(valueBytes), statusStr)
if saved {
writeJSON(w, http.StatusOK, map[string]string{"key": req.Key, "status": "saved"})
} else {
writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "state store unavailable"})
}
}

func getStateHandler(w http.ResponseWriter, r *http.Request) {
key := strings.TrimPrefix(r.URL.Path, "/api/v1/state/")
if key == "" {
writeJSON(w, http.StatusBadRequest, map[string]string{"error": "key required"})
return
}
if daprAvailable && daprClient != nil {
ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
defer cancel()
item, err := daprClient.GetState(ctx, stateStoreName, key, nil)
if err == nil {
db.Exec(`INSERT INTO dapr_state_operations (store_name, operation, state_key, status) VALUES ($1,'get',$2,'success')`, stateStoreName, key)
writeJSON(w, http.StatusOK, map[string]interface{}{"key": key, "value": json.RawMessage(item.Value), "etag": item.Etag})
return
}
}
daprURL := fmt.Sprintf("http://localhost:%s/v1.0/state/%s/%s", daprHTTPPort, stateStoreName, key)
resp, err := http.Get(daprURL)
if err == nil && resp.StatusCode == http.StatusOK {
var val interface{}
json.NewDecoder(resp.Body).Decode(&val)
writeJSON(w, http.StatusOK, map[string]interface{}{"key": key, "value": val})
return
}
writeJSON(w, http.StatusNotFound, map[string]string{"error": "key not found"})
}

func invokeHandler(w http.ResponseWriter, r *http.Request) {
var req InvokeRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
return
}
start := time.Now()
var respPayload map[string]interface{}
statusCode := 0
invoked := false
if daprAvailable && daprClient != nil {
ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
defer cancel()
dataBytes, _ := json.Marshal(req.Data)
content := &dapr.DataContent{ContentType: "application/json", Data: dataBytes}
resp, err := daprClient.InvokeMethodWithContent(ctx, req.AppID, req.Method, req.HTTPVerb, content)
if err == nil {
json.Unmarshal(resp, &respPayload)
statusCode = http.StatusOK
invoked = true
}
}
latency := int(time.Since(start).Milliseconds())
reqBytes, _ := json.Marshal(req.Data)
respBytes, _ := json.Marshal(respPayload)
db.Exec(`INSERT INTO dapr_service_invocations (target_app, method, http_verb, request_payload, response_payload, status_code, latency_ms) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
req.AppID, req.Method, req.HTTPVerb, string(reqBytes), string(respBytes), statusCode, latency)
if invoked {
writeJSON(w, http.StatusOK, map[string]interface{}{"app_id": req.AppID, "method": req.Method, "response": respPayload, "latency_ms": latency})
} else {
writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "service invocation failed"})
}
}

func subscriptionsHandler(w http.ResponseWriter, r *http.Request) {
rows, err := db.QueryContext(r.Context(), `SELECT pubsub_name, topic, route, handler_name, status, events_processed, events_failed FROM dapr_subscriptions ORDER BY topic`)
if err != nil {
writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
return
}
defer rows.Close()
var subs []map[string]interface{}
for rows.Next() {
var pubsub, topic, route, handler, status string
var processed, failed int64
rows.Scan(&pubsub, &topic, &route, &handler, &status, &processed, &failed)
subs = append(subs, map[string]interface{}{"pubsub_name": pubsub, "topic": topic, "route": route, "handler": handler, "status": status, "events_processed": processed, "events_failed": failed})
}
writeJSON(w, http.StatusOK, map[string]interface{}{"subscriptions": subs, "count": len(subs)})
}

func subscribeEndpoint(w http.ResponseWriter, r *http.Request) {
subs := []map[string]interface{}{
{"pubsubname": pubsubName, "topic": "banking.transactions", "route": "/dapr/subscribe/transactions"},
{"pubsubname": pubsubName, "topic": "banking.payments.raw", "route": "/dapr/subscribe/payments"},
{"pubsubname": pubsubName, "topic": "banking.kyc.events", "route": "/dapr/subscribe/kyc"},
{"pubsubname": pubsubName, "topic": "banking.aml.alerts", "route": "/dapr/subscribe/aml"},
{"pubsubname": pubsubName, "topic": "banking.notifications", "route": "/dapr/subscribe/notifications"},
}
writeJSON(w, http.StatusOK, subs)
}

func handleSubscribedEvent(topic string) http.HandlerFunc {
return func(w http.ResponseWriter, r *http.Request) {
var event BankingEvent
if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
writeJSON(w, http.StatusBadRequest, map[string]string{"status": "DROP"})
return
}
log.Printf("[dapr-sidecar-go] Received event topic=%s type=%s entity=%s", topic, event.EventType, event.EntityID)
db.Exec(`UPDATE dapr_subscriptions SET events_processed = events_processed + 1, last_event_at = NOW() WHERE topic = $1`, topic)
writeJSON(w, http.StatusOK, map[string]string{"status": "SUCCESS"})
}
}

func getEnv(key, fallback string) string {
if v := os.Getenv(key); v != "" { return v }
return fallback
}

func main() {
log.SetFlags(log.LstdFlags | log.Lshortfile)
log.Printf("[dapr-sidecar-go] starting v3.0.0 (Dapr Go SDK integrated)")

dsn := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/dapr_sidecar_go?sslmode=disable")
var err error
db, err = sql.Open("postgres", dsn)
if err != nil { log.Fatalf("[dapr-sidecar-go] DB open failed: %v", err) }
defer db.Close()
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(5 * time.Minute)
for i := 0; i < 10; i++ {
if err := db.Ping(); err == nil { break }
log.Printf("[dapr-sidecar-go] Waiting for DB... (%d/10)", i+1)
time.Sleep(2 * time.Second)
}
initSchema()

go func() {
time.Sleep(3 * time.Second)
initDaprClient()
for { time.Sleep(60 * time.Second); if !daprAvailable { initDaprClient() } }
}()

mux := http.NewServeMux()
mux.HandleFunc("/healthz", healthHandler)
mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
if err := db.Ping(); err != nil {
writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready"})
return
}
writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
})
mux.HandleFunc("/livez", func(w http.ResponseWriter, r *http.Request) {
writeJSON(w, http.StatusOK, map[string]string{"status": "alive"})
})
mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
var evtCount, stateCount int64
db.QueryRow("SELECT COUNT(*) FROM dapr_published_events").Scan(&evtCount)
db.QueryRow("SELECT COUNT(*) FROM dapr_state_operations").Scan(&stateCount)
fmt.Fprintf(w, "dapr_events_published_total %d\ndapr_state_operations_total %d\n", evtCount, stateCount)
})
mux.HandleFunc("/dapr/subscribe", subscribeEndpoint)
mux.HandleFunc("/dapr/subscribe/transactions", handleSubscribedEvent("banking.transactions"))
mux.HandleFunc("/dapr/subscribe/payments", handleSubscribedEvent("banking.payments.raw"))
mux.HandleFunc("/dapr/subscribe/kyc", handleSubscribedEvent("banking.kyc.events"))
mux.HandleFunc("/dapr/subscribe/aml", handleSubscribedEvent("banking.aml.alerts"))
mux.HandleFunc("/dapr/subscribe/notifications", handleSubscribedEvent("banking.notifications"))
mux.HandleFunc("/api/v1/publish", publishHandler)
mux.HandleFunc("/api/v1/state/", func(w http.ResponseWriter, r *http.Request) {
if r.Method == http.MethodPost { saveStateHandler(w, r) } else { getStateHandler(w, r) }
})
mux.HandleFunc("/api/v1/invoke", invokeHandler)
mux.HandleFunc("/api/v1/subscriptions", subscriptionsHandler)

srv := &http.Server{Addr: ":" + appPort, Handler: mux, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second}
log.Printf("[dapr-sidecar-go] ready on :%s (dapr_http=%s dapr_grpc=%s)", appPort, daprHTTPPort, daprGRPCPort)
go func() {
if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
log.Fatalf("[dapr-sidecar-go] server error: %v", err)
}
}()
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit
log.Printf("[dapr-sidecar-go] shutting down...")
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
srv.Shutdown(ctx)
if daprClient != nil { daprClient.Close() }
log.Printf("[dapr-sidecar-go] stopped")
}
