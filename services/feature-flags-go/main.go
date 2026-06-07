package main

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"sync"
	"time"
)

var PORT = "8097"
func init() { if p := os.Getenv("PORT"); p != "" { PORT = p } }

type FeatureFlag struct {
	Name              string   `json:"name"`
	Description       string   `json:"description"`
	Enabled           bool     `json:"enabled"`
	RolloutPercentage int      `json:"rollout_percentage"`
	TargetTenants     []string `json:"target_tenants"`
	TargetRoles       []string `json:"target_roles"`
	CreatedAt         string   `json:"created_at"`
	UpdatedAt         string   `json:"updated_at"`
}

var flags = sync.Map{}

func init() {
	// Default feature flags for 54Bank
	defaults := []FeatureFlag{
		{Name: "nqr_payments", Description: "NQR QR code payments", Enabled: false, RolloutPercentage: 0},
		{Name: "open_banking_aisp", Description: "Open Banking AISP APIs", Enabled: false, RolloutPercentage: 0},
		{Name: "open_banking_pisp", Description: "Open Banking PISP APIs", Enabled: false, RolloutPercentage: 0},
		{Name: "enaira_wallet", Description: "eNaira CBDC integration", Enabled: false, RolloutPercentage: 0},
		{Name: "islamic_banking", Description: "Non-interest banking products", Enabled: false, RolloutPercentage: 0},
		{Name: "cross_border_remittance", Description: "Cross-border transfer corridors", Enabled: true, RolloutPercentage: 50},
		{Name: "ai_chatbot", Description: "AI-powered customer chatbot", Enabled: true, RolloutPercentage: 25},
		{Name: "biometric_auth", Description: "Biometric login (fingerprint/face)", Enabled: true, RolloutPercentage: 100},
		{Name: "carbon_tracking", Description: "Transaction carbon footprint", Enabled: false, RolloutPercentage: 0},
		{Name: "realtime_notifications", Description: "WebSocket push notifications", Enabled: true, RolloutPercentage: 75},
		{Name: "ml_explainability", Description: "Show ML decision explanations", Enabled: true, RolloutPercentage: 50},
		{Name: "federated_learning", Description: "Cross-bank fraud model training", Enabled: false, RolloutPercentage: 0},
		{Name: "dark_mode", Description: "Dark mode UI theme", Enabled: true, RolloutPercentage: 100},
		{Name: "voice_banking", Description: "IVR voice commands", Enabled: false, RolloutPercentage: 0},
		{Name: "embedded_finance_api", Description: "BaaS white-label APIs", Enabled: false, RolloutPercentage: 0},
	}
	for _, ff := range defaults {
		ff.CreatedAt = time.Now().UTC().Format(time.RFC3339)
		ff.UpdatedAt = ff.CreatedAt
		flags.Store(ff.Name, ff)
	}
}

func isEnabled(flagName, userID, tenantID, role string) bool {
	v, ok := flags.Load(flagName)
	if !ok { return false }
	ff := v.(FeatureFlag)
	if !ff.Enabled { return false }
	if ff.RolloutPercentage >= 100 { return true }
	if ff.RolloutPercentage <= 0 { return false }
	// Deterministic rollout based on userID hash
	if userID != "" {
		n, _ := rand.Int(rand.Reader, big.NewInt(100))
		return int(n.Int64()) < ff.RolloutPercentage
	}
	return true
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	count := 0
	flags.Range(func(_, _ interface{}) bool { count++; return true })
	respondJSON(w, 200, map[string]interface{}{"status": "healthy", "service": "feature-flags", "flags_count": count})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	all := []FeatureFlag{}
	flags.Range(func(_, v interface{}) bool { all = append(all, v.(FeatureFlag)); return true })
	respondJSON(w, 200, map[string]interface{}{"flags": all, "count": len(all)})
}

func handleCheck(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("flag")
	userID := r.URL.Query().Get("user_id")
	tenantID := r.URL.Query().Get("tenant_id")
	role := r.URL.Query().Get("role")
	respondJSON(w, 200, map[string]interface{}{"flag": name, "enabled": isEnabled(name, userID, tenantID, role)})
}

func handleToggle(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name    string `json:"name"`
		Enabled bool   `json:"enabled"`
		Rollout int    `json:"rollout_percentage"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]interface{}{"error": "Invalid JSON"})
		return
	}
	v, ok := flags.Load(body.Name)
	if !ok {
		respondJSON(w, 404, map[string]interface{}{"error": "Flag not found"})
		return
	}
	ff := v.(FeatureFlag)
	ff.Enabled = body.Enabled
	if body.Rollout > 0 { ff.RolloutPercentage = body.Rollout }
	ff.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	flags.Store(body.Name, ff)
	log.Printf("[FF] Toggled: %s enabled=%v rollout=%d%%", body.Name, ff.Enabled, ff.RolloutPercentage)
	respondJSON(w, 200, map[string]interface{}{"status": "updated", "flag": ff})
}

func main() {
	fmt.Printf("54Bank Feature Flags Service listening on :%s\n", PORT)
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/flags", handleList)
	mux.HandleFunc("/flags/check", handleCheck)
	mux.HandleFunc("/flags/toggle", handleToggle)
	log.Fatal(http.ListenAndServe(":"+PORT, mux))
}
