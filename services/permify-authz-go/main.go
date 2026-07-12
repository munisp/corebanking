package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Permify Authorization Service — fine-grained RBAC/ABAC/ReBAC policy engine
// Port: 8129
// Delegates permission checks to real Permify engine.
// Static policies (dual-control, high-value, etc.) are evaluated as a deny-first
// layer before the Permify round-trip.

const defaultTenantID = "bpmgd"

var (
	permifyURL string
	httpClient = &http.Client{Timeout: 5 * time.Second}
)

func init() {
	permifyURL = strings.TrimRight(os.Getenv("PERMIFY_URL"), "/")
	if permifyURL == "" {
		permifyURL = "http://permify.banking.svc.cluster.local:3476"
	}
}

// ---------------------------------------------------------------------------
// Static policies — evaluated locally as a deny-first layer
// ---------------------------------------------------------------------------

type PolicyRule struct {
	Entity    string            `json:"entity"`
	Action    string            `json:"action"`
	Condition map[string]string `json:"condition,omitempty"`
	Effect    string            `json:"effect"` // "allow" | "deny"
}

type Policy struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Type      string       `json:"type"` // rbac | abac | rebac
	Rules     []PolicyRule `json:"rules"`
	Status    string       `json:"status"` // active | inactive
	CreatedAt string       `json:"createdAt"`
}

var staticPolicies []Policy

func init() {
	now := time.Now().UTC().Format(time.RFC3339)
	staticPolicies = []Policy{
		{
			ID: "POL-0001", Name: "dual-control-approval", Type: "rbac", Status: "active", CreatedAt: now,
			Rules: []PolicyRule{
				// A user cannot approve a transaction they initiated themselves.
				{Entity: "transaction", Action: "approve", Effect: "deny",
					Condition: map[string]string{"initiator": "same_as_approver"}},
			},
		},
		{
			ID: "POL-0002", Name: "high-value-restriction", Type: "abac", Status: "active", CreatedAt: now,
			Rules: []PolicyRule{
				// Tellers cannot create transactions above ₦10M.
				{Entity: "transaction", Action: "create", Effect: "deny",
					Condition: map[string]string{"amount": ">10000000", "role": "teller"}},
			},
		},
		{
			ID: "POL-0003", Name: "branch-scope", Type: "rebac", Status: "active", CreatedAt: now,
			Rules: []PolicyRule{
				// Staff cannot update accounts belonging to a different branch.
				// Caller must pass context: {"branch_different": "true"} when applicable.
				{Entity: "account", Action: "update", Effect: "deny",
					Condition: map[string]string{"branch_different": "true"}},
			},
		},
		{
			ID: "POL-0004", Name: "after-hours-restriction", Type: "abac", Status: "active", CreatedAt: now,
			Rules: []PolicyRule{
				// Vault access is denied after 18:00 server time.
				{Entity: "vault", Action: "access", Effect: "deny",
					Condition: map[string]string{"time": "after_18:00"}},
			},
		},
		{
			ID: "POL-0005", Name: "kyc-level-restriction", Type: "abac", Status: "active", CreatedAt: now,
			Rules: []PolicyRule{
				// Transfers above ₦50K require KYC level ≥ 2.
				// Caller must pass context: {"amount": "...", "kyc_level": "..."}.
				{Entity: "transfer", Action: "create", Effect: "deny",
					Condition: map[string]string{"amount": ">50000", "kyc_level": "<2"}},
			},
		},
	}
}

// evalStaticDeny returns (true, policyName) if any active deny policy matches.
func evalStaticDeny(entity, action string, ctx map[string]string) (bool, string) {
	for _, pol := range staticPolicies {
		if pol.Status != "active" {
			continue
		}
		for _, rule := range pol.Rules {
			if rule.Entity != entity || rule.Action != action || rule.Effect != "deny" {
				continue
			}
			if conditionsMatch(rule.Condition, ctx) {
				return true, pol.Name
			}
		}
	}
	return false, ""
}

func conditionsMatch(conds map[string]string, ctx map[string]string) bool {
	for k, v := range conds {
		switch k {
		case "role":
			if ctx == nil || ctx["role"] != v {
				return false
			}
		case "initiator":
			if v == "same_as_approver" {
				if ctx == nil || ctx["initiator"] == "" || ctx["initiator"] != ctx["approver"] {
					return false
				}
			}
		case "amount":
			if ctx == nil || !numericMatch(v, ctx["amount"]) {
				return false
			}
		case "kyc_level":
			if ctx == nil || !numericMatch(v, ctx["kyc_level"]) {
				return false
			}
		case "branch_different":
			if ctx == nil || ctx["branch_different"] != v {
				return false
			}
		case "time":
			if v == "after_18:00" && time.Now().Hour() < 18 {
				return false
			}
		}
	}
	return true
}

// numericMatch checks whether actualStr satisfies a condition like ">10000000" or "<2".
func numericMatch(cond, actualStr string) bool {
	if actualStr == "" {
		return false
	}
	op, threshold := ">", cond
	if len(cond) > 0 && (cond[0] == '>' || cond[0] == '<') {
		op = string(cond[0])
		threshold = cond[1:]
	}
	var t, a float64
	if _, err := fmt.Sscanf(threshold, "%f", &t); err != nil {
		return false
	}
	if _, err := fmt.Sscanf(actualStr, "%f", &a); err != nil {
		return false
	}
	if op == ">" {
		return a > t
	}
	return a < t
}

// ---------------------------------------------------------------------------
// Permify client
// ---------------------------------------------------------------------------

type permifyCheckReq struct {
	Metadata permifyMeta   `json:"metadata"`
	Entity   permifyEntity `json:"entity"`
	Permission string      `json:"permission"`
	Subject  permifySubject `json:"subject"`
}

type permifyMeta struct {
	SchemaVersion string `json:"schema_version"`
	SnapToken     string `json:"snap_token"`
	Depth         int    `json:"depth"`
}

type permifyEntity struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type permifySubject struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type permifyCheckResp struct {
	Can string `json:"can"`
}

func callPermify(tenantID, userID, entityType, entityID, permission string) (bool, error) {
	payload := permifyCheckReq{
		Metadata:   permifyMeta{Depth: 20},
		Entity:     permifyEntity{Type: entityType, ID: entityID},
		Permission: permission,
		Subject:    permifySubject{Type: "user", ID: userID},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return false, err
	}

	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/check", permifyURL, tenantID)
	resp, err := httpClient.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return false, fmt.Errorf("permify unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("permify returned %d", resp.StatusCode)
	}

	var result permifyCheckResp
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}
	return result.Can == "CHECK_RESULT_ALLOWED", nil
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

type CheckRequest struct {
	Subject  string            `json:"subject"`   // "user:{id}" or bare user ID
	Entity   string            `json:"entity"`    // entity type per v2.perm: "platform", "tenants", etc.
	EntityID string            `json:"entity_id"` // entity instance ID; defaults to tenant ID
	Action   string            `json:"action"`    // permission name
	TenantID string            `json:"tenant_id,omitempty"`
	Context  map[string]string `json:"context,omitempty"`
}

type CheckResult struct {
	Allowed bool   `json:"allowed"`
	Policy  string `json:"matchedPolicy,omitempty"`
	Reason  string `json:"reason"`
	Latency string `json:"latencyMs"`
}

type BatchCheckRequest struct {
	UserID   string           `json:"user_id"`
	TenantID string           `json:"tenant_id,omitempty"`
	Checks   []BatchCheckItem `json:"checks"`
}

type BatchCheckItem struct {
	Entity   string            `json:"entity"`
	EntityID string            `json:"entity_id,omitempty"`
	Action   string            `json:"action"`
	Context  map[string]string `json:"context,omitempty"`
}

type BatchCheckResult struct {
	Entity   string `json:"entity"`
	EntityID string `json:"entity_id"`
	Action   string `json:"action"`
	Allowed  bool   `json:"allowed"`
	Reason   string `json:"reason,omitempty"`
}

var (
	mu         sync.Mutex
	checkCount int64
	denyCount  int64
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func resolveUserID(subject string) string {
	return strings.TrimPrefix(subject, "user:")
}

func resolveTenant(r *http.Request, bodyTenant string) string {
	if t := r.Header.Get("x-tenant-id"); t != "" {
		return t
	}
	if bodyTenant != "" {
		return bodyTenant
	}
	return defaultTenantID
}

// ---------------------------------------------------------------------------
// Role catalog — derived from v2.perm schema; used by the UI to list roles
// and their permissions without having to parse the Permify schema DSL.
// ---------------------------------------------------------------------------

type RoleEntry struct {
	Name        string   `json:"name"`
	Entity      string   `json:"entity"`      // "platform" | "tenants"
	Description string   `json:"description"`
	Permissions []string `json:"permissions"` // permission names this role grants
}

// roleCatalog is the authoritative list of roles and their permissions.
// It mirrors v2.perm exactly — update both together when adding new permissions.
var roleCatalog = []RoleEntry{
	// ── platform roles ──────────────────────────────────────────────────────
	{
		Name: "super_admin", Entity: "platform",
		Description: "Full platform access — bypasses all permission checks via god_mode",
		Permissions: []string{"god_mode", "view_all_data", "manage_employees", "manage_tenants", "provide_support", "enable_features", "system_lockdown"},
	},
	{
		Name: "tenant_manager", Entity: "platform",
		Description: "Manages tenant onboarding and lifecycle",
		Permissions: []string{"manage_tenants"},
	},
	{
		Name: "operations_manager", Entity: "platform",
		Description: "Day-to-day platform operations",
		Permissions: []string{"view_all_data"},
	},
	{
		Name: "risk_manager", Entity: "platform",
		Description: "Platform-level risk oversight",
		Permissions: []string{},
	},
	{
		Name: "internal_auditor", Entity: "platform",
		Description: "Read-only audit access across all platform data",
		Permissions: []string{"view_all_data"},
	},
	{
		Name: "it_admin", Entity: "platform",
		Description: "System configuration and staff management",
		Permissions: []string{"manage_employees", "manage_tenants", "enable_features"},
	},
	{
		Name: "relationship_manager", Entity: "platform",
		Description: "Manages tenant relationships",
		Permissions: []string{"manage_tenants"},
	},
	{
		Name: "compliance_officer", Entity: "platform",
		Description: "Regulatory compliance and system lockdown",
		Permissions: []string{"system_lockdown"},
	},
	{
		Name: "support_agent", Entity: "platform",
		Description: "Customer and tenant support",
		Permissions: []string{"provide_support"},
	},

	// ── tenant roles ────────────────────────────────────────────────────────
	{
		Name: "super_admin", Entity: "tenants",
		Description: "Full tenant access — bypasses all permission checks via god_mode",
		Permissions: []string{
			"god_mode", "view_all_data", "view_branch_data", "manage_employees",
			"manage_customers", "suspend_or_reactivate_customers", "verify_kyc",
			"teller_actions", "teller_management", "vault_management",
			"initiate_transactions", "approve_or_reject", "reverse_transactions",
			"manage_transaction_limits", "applications", "approve_loans", "manage_loan_limits",
			"manage_esusu", "islamic_banking", "agric_banking", "lpo_management",
			"card_issuance", "card_management", "control_cards", "dispute_management",
			"view_audit_logs", "export_audit_logs", "flag_suspicious_activity", "manage_fraud_cases",
			"view_analytics", "temporal_access_management",
			"billing_management", "coa_management", "erp_management",
			"communication_hub_management", "emergency_override",
		},
	},
	{
		Name: "branch_manager", Entity: "tenants",
		Description: "Manages a branch — approvals, tellers, and branch accounts",
		Permissions: []string{"view_branch_data", "teller_actions", "teller_management", "approve_or_reject"},
	},
	{
		Name: "operations_manager", Entity: "tenants",
		Description: "Day-to-day banking operations",
		Permissions: []string{
			"view_all_data", "manage_customers", "suspend_or_reactivate_customers",
			"teller_actions", "teller_management", "initiate_transactions", "reverse_transactions",
			"manage_esusu", "islamic_banking", "agric_banking",
			"card_issuance", "card_management", "control_cards", "dispute_management",
			"view_analytics", "communication_hub_management",
		},
	},
	{
		Name: "risk_manager", Entity: "tenants",
		Description: "Risk assessment and transaction limit control",
		Permissions: []string{
			"approve_or_reject", "manage_transaction_limits", "approve_loans", "manage_loan_limits",
			"control_cards", "flag_suspicious_activity", "manage_fraud_cases",
		},
	},
	{
		Name: "internal_auditor", Entity: "tenants",
		Description: "Read-only audit access",
		Permissions: []string{"view_all_data", "reverse_transactions", "view_audit_logs", "export_audit_logs"},
	},
	{
		Name: "it_admin", Entity: "tenants",
		Description: "System and staff administration within the tenant",
		Permissions: []string{"manage_employees", "temporal_access_management", "erp_management"},
	},
	{
		Name: "relationship_manager", Entity: "tenants",
		Description: "Customer acquisition and management",
		Permissions: []string{"manage_customers", "applications"},
	},
	{
		Name: "trade_finance_admin", Entity: "tenants",
		Description: "Trade finance and LPO operations",
		Permissions: []string{"lpo_management"},
	},
	{
		Name: "vault_manager", Entity: "tenants",
		Description: "Vault custody and cash management",
		Permissions: []string{"vault_management"},
	},
	{
		Name: "treasury_manager", Entity: "tenants",
		Description: "Treasury, FX, and billing management",
		Permissions: []string{"vault_management", "approve_or_reject", "billing_management", "coa_management"},
	},
	{
		Name: "loan_officer", Entity: "tenants",
		Description: "Loan origination and approval",
		Permissions: []string{"applications", "approve_loans", "islamic_banking", "agric_banking", "lpo_management"},
	},
	{
		Name: "compliance_officer", Entity: "tenants",
		Description: "Regulatory compliance, KYC, and audit",
		Permissions: []string{
			"suspend_or_reactivate_customers", "verify_kyc", "manage_transaction_limits",
			"approve_loans", "dispute_management", "view_audit_logs",
			"flag_suspicious_activity", "islamic_banking", "emergency_override",
		},
	},
	{
		Name: "support_agent", Entity: "tenants",
		Description: "Customer support and communication",
		Permissions: []string{"communication_hub_management"},
	},
	{
		Name: "teller", Entity: "tenants",
		Description: "Counter operations — deposits, withdrawals, and basic transactions",
		Permissions: []string{"teller_actions", "initiate_transactions"},
	},
	{
		Name: "fraud_analyst", Entity: "tenants",
		Description: "Fraud monitoring, case management, and suspicious activity reporting",
		Permissions: []string{"view_audit_logs", "flag_suspicious_activity", "manage_fraud_cases", "view_analytics"},
	},
}

func handleRoleCatalog(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Optional ?entity= filter: ?entity=tenants or ?entity=platform
	entity := r.URL.Query().Get("entity")
	// Optional ?role= filter: ?role=branch_manager
	role := r.URL.Query().Get("role")

	result := make([]RoleEntry, 0, len(roleCatalog))
	for _, r := range roleCatalog {
		if entity != "" && r.Entity != entity {
			continue
		}
		if role != "" && r.Name != role {
			continue
		}
		result = append(result, r)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"roles": result,
		"total": len(result),
	})
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8129"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/v1/authz/check", handleCheck)
	mux.HandleFunc("/v1/authz/check-batch", handleCheckBatch)
	mux.HandleFunc("/v1/authz/policies", handlePolicies)
	mux.HandleFunc("/v1/authz/roles", handleRoleCatalog)
	mux.HandleFunc("/v1/authz/stats", handleStats)

	log.Printf("permify-authz-go starting on :%s (permify upstream: %s)", port, permifyURL)
	if err := http.ListenAndServe(":"+port, withCORS(mux)); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	permifyOK := false
	if resp, err := httpClient.Get(permifyURL + "/healthz"); err == nil {
		permifyOK = resp.StatusCode == http.StatusOK
		resp.Body.Close()
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "permify-authz", "status": "healthy", "port": 8129,
		"permify": map[string]interface{}{"url": permifyURL, "reachable": permifyOK},
	})
}

func handleCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req CheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if req.Subject == "" || req.Entity == "" || req.Action == "" {
		http.Error(w, `{"error":"subject, entity, and action are required"}`, http.StatusBadRequest)
		return
	}

	start := time.Now()
	tenantID := resolveTenant(r, req.TenantID)
	userID := resolveUserID(req.Subject)
	entityID := req.EntityID
	if entityID == "" {
		entityID = tenantID
	}

	mu.Lock()
	checkCount++
	mu.Unlock()

	// Static deny layer
	if denied, policyName := evalStaticDeny(req.Entity, req.Action, req.Context); denied {
		mu.Lock()
		denyCount++
		mu.Unlock()
		json.NewEncoder(w).Encode(CheckResult{
			Allowed: false, Policy: policyName,
			Reason:  "denied by static policy: " + policyName,
			Latency: fmt.Sprintf("%d", time.Since(start).Milliseconds()),
		})
		return
	}

	// Real Permify check
	allowed, err := callPermify(tenantID, userID, req.Entity, entityID, req.Action)
	if err != nil {
		log.Printf("permify error: %v", err)
		http.Error(w, fmt.Sprintf(`{"error":"permify unavailable: %s"}`, err.Error()), http.StatusBadGateway)
		return
	}

	if !allowed {
		mu.Lock()
		denyCount++
		mu.Unlock()
	}

	reason := "allowed by permify"
	if !allowed {
		reason = "denied by permify"
	}
	json.NewEncoder(w).Encode(CheckResult{
		Allowed: allowed, Reason: reason,
		Latency: fmt.Sprintf("%d", time.Since(start).Milliseconds()),
	})
}

func handleCheckBatch(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req BatchCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}
	if req.UserID == "" {
		http.Error(w, `{"error":"user_id is required"}`, http.StatusBadRequest)
		return
	}

	tenantID := resolveTenant(r, req.TenantID)
	results := make([]BatchCheckResult, len(req.Checks))

	type indexed struct {
		i int
		r BatchCheckResult
	}
	ch := make(chan indexed, len(req.Checks))

	sem := make(chan struct{}, 10)
	var wg sync.WaitGroup

	for i, item := range req.Checks {
		wg.Add(1)
		go func(i int, item BatchCheckItem) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			entityID := item.EntityID
			if entityID == "" {
				entityID = tenantID
			}

			res := BatchCheckResult{Entity: item.Entity, EntityID: entityID, Action: item.Action}

			if denied, policyName := evalStaticDeny(item.Entity, item.Action, item.Context); denied {
				res.Allowed = false
				res.Reason = "denied by static policy: " + policyName
				ch <- indexed{i, res}
				return
			}

			allowed, err := callPermify(tenantID, req.UserID, item.Entity, entityID, item.Action)
			if err != nil {
				log.Printf("permify batch error [%s#%s]: %v", item.Entity, item.Action, err)
				res.Allowed = false
				res.Reason = "permify unavailable"
			} else {
				res.Allowed = allowed
				if allowed {
					res.Reason = "allowed by permify"
				} else {
					res.Reason = "denied by permify"
				}
			}
			ch <- indexed{i, res}
		}(i, item)
	}

	wg.Wait()
	close(ch)
	for r := range ch {
		results[r.i] = r.r
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"user_id":   req.UserID,
		"tenant_id": tenantID,
		"results":   results,
	})
}

func handlePolicies(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"items": staticPolicies, "total": len(staticPolicies)})
}

func handleStats(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.Lock()
	checks, denials := checkCount, denyCount
	mu.Unlock()
	denyRate := 0.0
	if checks > 0 {
		denyRate = float64(denials) / float64(checks) * 100
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"checksPerformed": checks,
		"denials":         denials,
		"denyRate":        fmt.Sprintf("%.1f%%", denyRate),
		"staticPolicies":  len(staticPolicies),
		"permifyURL":      permifyURL,
	})
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-tenant-id")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
