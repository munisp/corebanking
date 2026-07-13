// etherisc-service — parametric crop insurance via Etherisc DIP protocol for 54Bank
package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var (
	db        *sql.DB
	startTime = time.Now()
)

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

func respondErr(w http.ResponseWriter, code int, msg string) {
	respondJSON(w, code, map[string]string{"error": msg})
}

func initDB() {
	var err error
	db, err = sql.Open("postgres", getEnv("DATABASE_URL", ""))
	if err != nil {
		log.Fatalf("[etherisc-service] db open: %v", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS etherisc_policies (
			id              SERIAL PRIMARY KEY,
			policy_id       VARCHAR(50)  UNIQUE NOT NULL,
			tenant_id       VARCHAR(50)  NOT NULL,
			farmer_id       VARCHAR(100) NOT NULL,
			crop_type       VARCHAR(100) NOT NULL,
			coverage_usd    NUMERIC(14,2) NOT NULL DEFAULT 0,
			premium_usd     NUMERIC(14,2) NOT NULL DEFAULT 0,
			trigger_index   VARCHAR(100),
			status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
			season_start    DATE,
			season_end      DATE,
			created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		);
		CREATE TABLE IF NOT EXISTS etherisc_claims (
			id              SERIAL PRIMARY KEY,
			claim_id        VARCHAR(50)  UNIQUE NOT NULL,
			policy_id       VARCHAR(50)  NOT NULL REFERENCES etherisc_policies(policy_id),
			tenant_id       VARCHAR(50)  NOT NULL,
			trigger_value   NUMERIC(14,6),
			payout_usd      NUMERIC(14,2) NOT NULL DEFAULT 0,
			status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
			paid_at         TIMESTAMPTZ,
			created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		);
	`)
	if err != nil {
		log.Fatalf("[etherisc-service] migration: %v", err)
	}
	log.Println("[etherisc-service] DB ready")
}

func main() {
	initDB()
	port := getEnv("PORT", "9162")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", handleHealth)
	mux.HandleFunc("/api/v1/etherisc/policies/all", handlePoliciesAll)
	mux.HandleFunc("/api/v1/etherisc/policies", handlePolicies)
	mux.HandleFunc("/api/v1/etherisc/claims/all", handleClaimsAll)
	mux.HandleFunc("/api/v1/etherisc/claims", handleClaims)
	mux.HandleFunc("/api/v1/etherisc/stats", handleStats)

	log.Printf("[etherisc-service] Parametric crop insurance on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service":     "etherisc-service",
		"status":      "healthy",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"protocol":    "Etherisc DIP v2",
	})
}

func handlePoliciesAll(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("x-tenant-id")

	rows, err := db.QueryContext(r.Context(), `
		SELECT policy_id, farmer_id, crop_type, coverage_usd, premium_usd,
		       trigger_index, status, season_start, season_end, created_at
		FROM etherisc_policies
		WHERE ($1 = '' OR tenant_id = $1)
		ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		respondErr(w, 500, "failed to fetch policies")
		return
	}
	defer rows.Close()

	type Policy struct {
		PolicyID     string  `json:"policyId"`
		FarmerID     string  `json:"farmerId"`
		CropType     string  `json:"cropType"`
		CoverageUSD  float64 `json:"coverageUsd"`
		PremiumUSD   float64 `json:"premiumUsd"`
		TriggerIndex string  `json:"triggerIndex"`
		Status       string  `json:"status"`
		SeasonStart  string  `json:"seasonStart"`
		SeasonEnd    string  `json:"seasonEnd"`
		CreatedAt    string  `json:"createdAt"`
	}

	result := []Policy{}
	for rows.Next() {
		var p Policy
		var seasonStart, seasonEnd sql.NullString
		var createdAt time.Time
		if err := rows.Scan(&p.PolicyID, &p.FarmerID, &p.CropType, &p.CoverageUSD,
			&p.PremiumUSD, &p.TriggerIndex, &p.Status, &seasonStart, &seasonEnd, &createdAt); err != nil {
			respondErr(w, 500, "scan error")
			return
		}
		p.SeasonStart = seasonStart.String
		p.SeasonEnd = seasonEnd.String
		p.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, p)
	}
	respondJSON(w, 200, map[string]interface{}{"policies": result, "total": len(result)})
}

func handlePolicies(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondErr(w, 405, "method not allowed")
		return
	}
	tenantID := r.Header.Get("x-tenant-id")

	var req struct {
		FarmerID    string  `json:"farmerId"`
		CropType    string  `json:"cropType"`
		CoverageUSD float64 `json:"coverageUsd"`
		PremiumUSD  float64 `json:"premiumUsd"`
		TriggerIndex string `json:"triggerIndex"`
		SeasonStart string  `json:"seasonStart"`
		SeasonEnd   string  `json:"seasonEnd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondErr(w, 400, "invalid request body")
		return
	}

	var policyID string
	err := db.QueryRowContext(r.Context(), `
		INSERT INTO etherisc_policies
			(policy_id, tenant_id, farmer_id, crop_type, coverage_usd, premium_usd, trigger_index, status, season_start, season_end)
		VALUES
			(concat('POL-', to_char(NOW(), 'YYYYMMDDHH24MISS'), '-', floor(random()*9000+1000)::int),
			 $1, $2, $3, $4, $5, $6, 'pending',
			 NULLIF($7, '')::date, NULLIF($8, '')::date)
		RETURNING policy_id
	`, tenantID, req.FarmerID, req.CropType, req.CoverageUSD, req.PremiumUSD,
		req.TriggerIndex, req.SeasonStart, req.SeasonEnd).Scan(&policyID)
	if err != nil {
		log.Printf("[etherisc-service] create policy: %v", err)
		respondErr(w, 500, "failed to create policy")
		return
	}
	respondJSON(w, 201, map[string]string{"policyId": policyID, "status": "pending"})
}

func handleClaimsAll(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("x-tenant-id")

	rows, err := db.QueryContext(r.Context(), `
		SELECT c.claim_id, c.policy_id, c.trigger_value, c.payout_usd, c.status, c.paid_at, c.created_at
		FROM etherisc_claims c
		JOIN etherisc_policies p ON p.policy_id = c.policy_id
		WHERE ($1 = '' OR c.tenant_id = $1)
		ORDER BY c.created_at DESC
	`, tenantID)
	if err != nil {
		respondErr(w, 500, "failed to fetch claims")
		return
	}
	defer rows.Close()

	type Claim struct {
		ClaimID      string   `json:"claimId"`
		PolicyID     string   `json:"policyId"`
		TriggerValue *float64 `json:"triggerValue"`
		PayoutUSD    float64  `json:"payoutUsd"`
		Status       string   `json:"status"`
		PaidAt       *string  `json:"paidAt"`
		CreatedAt    string   `json:"createdAt"`
	}

	result := []Claim{}
	for rows.Next() {
		var c Claim
		var triggerValue sql.NullFloat64
		var paidAt sql.NullTime
		var createdAt time.Time
		if err := rows.Scan(&c.ClaimID, &c.PolicyID, &triggerValue, &c.PayoutUSD,
			&c.Status, &paidAt, &createdAt); err != nil {
			respondErr(w, 500, "scan error")
			return
		}
		if triggerValue.Valid {
			c.TriggerValue = &triggerValue.Float64
		}
		if paidAt.Valid {
			s := paidAt.Time.Format(time.RFC3339)
			c.PaidAt = &s
		}
		c.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, c)
	}
	respondJSON(w, 200, map[string]interface{}{"claims": result, "total": len(result)})
}

func handleClaims(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondErr(w, 405, "method not allowed")
		return
	}
	tenantID := r.Header.Get("x-tenant-id")

	var req struct {
		PolicyID     string  `json:"policyId"`
		TriggerValue float64 `json:"triggerValue"`
		PayoutUSD    float64 `json:"payoutUsd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondErr(w, 400, "invalid request body")
		return
	}

	var claimID string
	err := db.QueryRowContext(r.Context(), `
		INSERT INTO etherisc_claims
			(claim_id, policy_id, tenant_id, trigger_value, payout_usd, status)
		VALUES
			(concat('CLM-', to_char(NOW(), 'YYYYMMDDHH24MISS'), '-', floor(random()*9000+1000)::int),
			 $1, $2, $3, $4, 'pending')
		RETURNING claim_id
	`, req.PolicyID, tenantID, req.TriggerValue, req.PayoutUSD).Scan(&claimID)
	if err != nil {
		log.Printf("[etherisc-service] create claim: %v", err)
		respondErr(w, 500, "failed to create claim")
		return
	}
	respondJSON(w, 201, map[string]string{"claimId": claimID, "status": "pending"})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("x-tenant-id")

	var activePolicies int
	var totalCoverageUSD float64
	db.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(coverage_usd), 0)
		FROM etherisc_policies
		WHERE status = 'active' AND ($1 = '' OR tenant_id = $1)
	`, tenantID).Scan(&activePolicies, &totalCoverageUSD)

	var claimsPaid int
	var claimPayoutUSD float64
	db.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(payout_usd), 0)
		FROM etherisc_claims
		WHERE status = 'paid' AND ($1 = '' OR tenant_id = $1)
	`, tenantID).Scan(&claimsPaid, &claimPayoutUSD)

	respondJSON(w, 200, map[string]interface{}{
		"activePolicies":   activePolicies,
		"totalCoverageUsd": totalCoverageUSD,
		"claimsPaid":       claimsPaid,
		"claimPayoutUsd":   claimPayoutUSD,
	})
}
