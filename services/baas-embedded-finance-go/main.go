package main

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

// --- Banking-as-a-Service — white-label APIs for fintechs, virtual accounts ---

var PORT = "8105"
func init() { if p := os.Getenv("PORT"); p != "" { PORT = p } }

// --- State ---
type Record struct {
	ID        string                 `json:"id"`
	Data      map[string]interface{} `json:"data"`
	CreatedAt string                 `json:"created_at"`
	UpdatedAt string                 `json:"updated_at"`
	TenantID  string                 `json:"tenant_id"`
	Status    string                 `json:"status"`
}

var (
	records   []Record
	recordsMu sync.RWMutex
)

func secureRandID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%X", b)
}

// --- PII Masking (NDPR) ---
func maskPII(value, fieldType string) string {
	if len(value) == 0 { return "***" }
	switch fieldType {
	case "bvn", "nin":
		if len(value) >= 4 { return "***" + value[len(value)-4:] }
		return "***"
	case "phone":
		if len(value) >= 4 { return "+234***" + value[len(value)-4:] }
		return "+234***"
	case "email":
		parts := strings.SplitN(value, "@", 2)
		if len(parts) == 2 { return string(parts[0][0]) + "***@" + parts[1] }
		return "***@***"
	case "account":
		if len(value) >= 4 { return "****" + value[len(value)-4:] }
		return "****"
	default:
		return "***"
	}
}

func sanitizeLogEntry(msg string) string {
	re1 := regexp.MustCompile(`\b[0-9]{11}\b`)
	msg = re1.ReplaceAllStringFunc(msg, func(s string) string { return "***" + s[len(s)-4:] })
	return msg
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'self'")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	recordsMu.RLock()
	count := len(records)
	recordsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": "baas-embedded-finance-go", "version": "1.0.0", "records": count})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	recordsMu.RLock()
	defer recordsMu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"records": records, "count": len(records)})
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]interface{}{"error": "Invalid JSON", "details": err.Error()})
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	rec := Record{
		ID: fmt.Sprintf("BAA-%s", secureRandID()),
		Data: body, CreatedAt: now, UpdatedAt: now,
		TenantID: fmt.Sprintf("%v", body["tenant_id"]),
		Status: "active",
	}
	recordsMu.Lock()
	records = append(records, rec)
	recordsMu.Unlock()
	respondJSON(w, 201, map[string]interface{}{"status": "created", "record": rec})
}

func main() {
	_ = maskPII
	_ = sanitizeLogEntry
	_ = big.NewInt
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", handleHealthz)
	mux.HandleFunc("/livez", handleHealthz)
	mux.HandleFunc("/api/v1/baas_embedded_finance", handleList)
	mux.HandleFunc("/api/v1/baas_embedded_finance/create", handleCreate)
	log.Printf("Banking-as-a-Service — white-label APIs for fintechs, virtual accounts listening on :%s", PORT)
	log.Fatal(http.ListenAndServe(":"+PORT, mux))
}
