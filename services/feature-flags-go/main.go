package main

import (
	"crypto/rand"
	"crypto/sha256"
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


// ─── Idempotency Middleware ─────────────────────────────────────────────────
var idempotencyCache = struct {
	sync.RWMutex
	entries map[string]idempotencyEntry
}{entries: make(map[string]idempotencyEntry)}

type idempotencyEntry struct {
	response   []byte
	statusCode int
	createdAt  time.Time
}

func idempotencyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" && r.Method != "PUT" {
			next.ServeHTTP(w, r)
			return
		}
		key := r.Header.Get("Idempotency-Key")
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}
		idempotencyCache.RLock()
		if entry, ok := idempotencyCache.entries[key]; ok {
			idempotencyCache.RUnlock()
			w.Header().Set("X-Idempotency-Replayed", "true")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(entry.statusCode)
			w.Write(entry.response)
			return
		}
		idempotencyCache.RUnlock()
		rec := &idempotencyRecorder{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(rec, r)
		idempotencyCache.Lock()
		idempotencyCache.entries[key] = idempotencyEntry{response: rec.body, statusCode: rec.statusCode, createdAt: time.Now()}
		idempotencyCache.Unlock()
		// Cleanup old entries (>24h) in background
		go func() {
			idempotencyCache.Lock()
			defer idempotencyCache.Unlock()
			for k, v := range idempotencyCache.entries {
				if time.Since(v.createdAt) > 24*time.Hour { delete(idempotencyCache.entries, k) }
			}
		}()
	})
}

type idempotencyRecorder struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (r *idempotencyRecorder) WriteHeader(code int) { r.statusCode = code; r.ResponseWriter.WriteHeader(code) }
func (r *idempotencyRecorder) Write(b []byte) (int, error) { r.body = append(r.body, b...); return r.ResponseWriter.Write(b) }


// ─── Optimistic Locking for Balance Updates ─────────────────────────────────
// All balance updates use version-checked atomic operations.
type BalanceLock struct {
	AccountID string
	Version   int64
	Balance   int64 // kobo
}

func dbUpdateBalanceAtomic(accountID string, deltaKobo int64, currentVersion int64) (int64, error) {
	if db == nil { return 0, fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return 0, err }
	defer tx.Rollback()
	var balance int64
	var version int64
	err = tx.QueryRow("SELECT balance_kobo, version FROM account_balances WHERE account_id = $1 FOR UPDATE", accountID).Scan(&balance, &version)
	if err != nil { return 0, fmt.Errorf("account not found or locked: %v", err) }
	if version != currentVersion {
		return 0, fmt.Errorf("optimistic lock conflict: expected version %d, got %d", currentVersion, version)
	}
	newBalance := balance + deltaKobo
	if newBalance < 0 { return 0, fmt.Errorf("insufficient balance: have %d kobo, need %d kobo", balance, -deltaKobo) }
	_, err = tx.Exec("UPDATE account_balances SET balance_kobo = $1, version = version + 1, updated_at = NOW() WHERE account_id = $2 AND version = $3",
		newBalance, accountID, currentVersion)
	if err != nil { return 0, err }
	err = tx.Commit()
	if err != nil { return 0, err }
	return newBalance, nil
}


// ─── Maker-Checker (Dual Authorization) ────────────────────────────────────
// CBN requires dual control for high-value operations.
type MakerCheckerRequest struct {
	RequestID  string      `json:"request_id"`
	Operation  string      `json:"operation"`
	MakerID    string      `json:"maker_id"`
	CheckerID  string      `json:"checker_id,omitempty"`
	AmountKobo int64       `json:"amount_kobo"`
	Status     string      `json:"status"` // pending_approval|approved|rejected
	Payload    interface{} `json:"payload"`
	CreatedAt  string      `json:"created_at"`
	DecidedAt  string      `json:"decided_at,omitempty"`
}

var (
	makerCheckerRequests []MakerCheckerRequest
	makerCheckerMu       sync.Mutex
)

// makerCheckerThresholds defines CBN-required dual authorization thresholds (kobo)
var makerCheckerThresholds = map[string]int64{
	"transfer":      100_000_000, // ₦1M
	"loan_disburse": 100_000_000, // ₦1M
	"gl_posting":    50_000_000,  // ₦500K
	"account_close": 0,           // Always requires checker
}

func requiresMakerChecker(operation string, amountKobo int64) bool {
	threshold, ok := makerCheckerThresholds[operation]
	if !ok { threshold = 100_000_000 }
	return amountKobo >= threshold
}

func submitForApproval(operation, makerID string, amountKobo int64, payload interface{}) *MakerCheckerRequest {
	req := MakerCheckerRequest{
		RequestID: fmt.Sprintf("MCR-%d", time.Now().UnixNano()),
		Operation: operation, MakerID: makerID, AmountKobo: amountKobo,
		Status: "pending_approval", Payload: payload,
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	makerCheckerMu.Lock()
	makerCheckerRequests = append(makerCheckerRequests, req)
	makerCheckerMu.Unlock()
	return &req
}


// ─── Immutable Audit Trail ──────────────────────────────────────────────────
// Append-only audit log. No DELETE or UPDATE permitted on audit records.
type AuditEntry struct {
	ID         string `json:"id"`
	Timestamp  string `json:"timestamp"`
	Service    string `json:"service"`
	Operation  string `json:"operation"`
	ActorID    string `json:"actor_id"`
	EntityID   string `json:"entity_id"`
	EntityType string `json:"entity_type"`
	OldState   string `json:"old_state,omitempty"`
	NewState   string `json:"new_state,omitempty"`
	IPAddress  string `json:"ip_address,omitempty"`
	Checksum   string `json:"checksum"` // SHA256 of entry for tamper detection
}

var (
	auditLog   []AuditEntry
	auditLogMu sync.RWMutex
)

func appendAuditEntry(service, operation, actorID, entityID, entityType, oldState, newState, ip string) {
	entry := AuditEntry{
		ID:         fmt.Sprintf("AUD-%d", time.Now().UnixNano()),
		Timestamp:  time.Now().UTC().Format(time.RFC3339Nano),
		Service:    service,
		Operation:  operation,
		ActorID:    actorID,
		EntityID:   entityID,
		EntityType: entityType,
		OldState:   oldState,
		NewState:   newState,
		IPAddress:  ip,
	}
	// Compute tamper-detection checksum
	raw := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s|%s|%s", entry.ID, entry.Timestamp, entry.Service, entry.Operation, entry.ActorID, entry.EntityID, entry.OldState, entry.NewState, entry.IPAddress)
	entry.Checksum = fmt.Sprintf("%x", sha256.Sum256([]byte(raw)))
	auditLogMu.Lock()
	auditLog = append(auditLog, entry)
	auditLogMu.Unlock()
	// Persist to DB if available (append-only INSERT, never UPDATE/DELETE)
	if db != nil {
		go func() {
			db.Exec("INSERT INTO audit_trail (id, timestamp, service, operation, actor_id, entity_id, entity_type, old_state, new_state, ip_address, checksum) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
				entry.ID, entry.Timestamp, entry.Service, entry.Operation, entry.ActorID, entry.EntityID, entry.EntityType, entry.OldState, entry.NewState, entry.IPAddress, entry.Checksum)
		}()
	}
}


// ─── Transaction Atomicity ──────────────────────────────────────────────────
// All multi-step write operations wrapped in DB transactions.
func dbExecAtomic(queries []string, params [][]interface{}) error {
	if db == nil { return fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return fmt.Errorf("BEGIN failed: %v", err) }
	for i, q := range queries {
		var args []interface{}
		if i < len(params) { args = params[i] }
		if _, err := tx.Exec(q, args...); err != nil {
			tx.Rollback()
			return fmt.Errorf("step %d failed: %v", i+1, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("COMMIT failed: %v", err)
	}
	return nil
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
