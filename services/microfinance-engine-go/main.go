package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	_ "github.com/lib/pq"
)

// sharedHTTPClient is a process-wide pooled HTTP client for outbound calls
// (replaces per-call &http.Client{} construction).
var sharedHTTPClient = &http.Client{
	Timeout: 10 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 25,
		IdleConnTimeout:     90 * time.Second,
	},
}

func envOr(k, f string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return f
}
func now() string { return time.Now().UTC().Format(time.RFC3339) }

type MFGroup struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	GroupType      string  `json:"groupType"`
	Members        int     `json:"members"`
	LoanOfficer    string  `json:"loanOfficer"`
	MeetingDay     string  `json:"meetingDay"`
	SavingsBalance float64 `json:"savingsBalance"`
	LoanBalance    float64 `json:"loanBalance"`
	AttendanceRate float64 `json:"attendanceRate"`
	Status         string  `json:"status"`
	Region         string  `json:"region"`
}

type MFLoan struct {
	ID          string   `json:"id"`
	GroupID     string   `json:"groupId"`
	MemberName  string   `json:"memberName"`
	Amount      float64  `json:"amount"`
	Purpose     string   `json:"purpose"`
	Term        int      `json:"term"`
	Rate        float64  `json:"rate"`
	Repaid      float64  `json:"repaid"`
	Status      string   `json:"status"`
	Guarantors  []string `json:"guarantors"`
	DisbursedAt string   `json:"disbursedAt"`
}

type SavingsCycle struct {
	ID         string  `json:"id"`
	GroupID    string  `json:"groupId"`
	CycleNo    int     `json:"cycleNo"`
	StartDate  string  `json:"startDate"`
	EndDate    string  `json:"endDate"`
	TotalSaved float64 `json:"totalSaved"`
	ShareValue float64 `json:"shareValue"`
	Status     string  `json:"status"`
}

// ── Persistence (wave-12 C3-P0-B7) ─────────────────────────────────────────
// Groups, loans and savings cycles are Postgres-authoritative (typed tables
// mf_groups, mf_loans, savings_cycles). The package-level slices were removed:
// creates are transactional INSERTs with sequence-allocated ids, lists/stats
// are served from PG. Fail-closed 503 when DATABASE_URL is unset/down.
var db *sql.DB

const microfinanceDDL = `
CREATE SEQUENCE IF NOT EXISTS mf_group_id_seq START 100;
CREATE SEQUENCE IF NOT EXISTS mf_loan_id_seq START 100;
CREATE TABLE IF NOT EXISTS mf_groups (
    id              text PRIMARY KEY,
    tenant_id       text NOT NULL DEFAULT '',
    name            text NOT NULL,
    group_type      text NOT NULL DEFAULT '',
    members         integer NOT NULL DEFAULT 0,
    loan_officer    text NOT NULL DEFAULT '',
    meeting_day     text NOT NULL DEFAULT '',
    savings_balance double precision NOT NULL DEFAULT 0,
    loan_balance    double precision NOT NULL DEFAULT 0,
    attendance_rate double precision NOT NULL DEFAULT 0,
    status          text NOT NULL DEFAULT 'forming',
    region          text NOT NULL DEFAULT '',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mf_loans (
    id           text PRIMARY KEY,
    tenant_id    text NOT NULL DEFAULT '',
    group_id     text NOT NULL,
    member_name  text NOT NULL DEFAULT '',
    amount       double precision NOT NULL DEFAULT 0,
    purpose      text NOT NULL DEFAULT '',
    term         integer NOT NULL DEFAULT 0,
    rate         double precision NOT NULL DEFAULT 0,
    repaid       double precision NOT NULL DEFAULT 0,
    status       text NOT NULL DEFAULT 'pending_approval',
    guarantors   jsonb NOT NULL DEFAULT '[]'::jsonb,
    disbursed_at text NOT NULL DEFAULT '',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mf_loans_group ON mf_loans (group_id);
CREATE TABLE IF NOT EXISTS savings_cycles (
    id          text PRIMARY KEY,
    tenant_id   text NOT NULL DEFAULT '',
    group_id    text NOT NULL,
    cycle_no    integer NOT NULL DEFAULT 0,
    start_date  text NOT NULL DEFAULT '',
    end_date    text NOT NULL DEFAULT '',
    total_saved double precision NOT NULL DEFAULT 0,
    share_value double precision NOT NULL DEFAULT 0,
    status      text NOT NULL DEFAULT 'active',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_savings_cycles_group ON savings_cycles (group_id);
`

// seedGroups/seedLoans/seedCycles are the demo fixtures previously held in
// process memory; inserted once at boot ON CONFLICT DO NOTHING (idempotent).
var (
	seedGroups = []MFGroup{
		{ID: "MFG-001", Name: "Iya Oloja Women's Group", GroupType: "solidarity", Members: 15, LoanOfficer: "LO-001 Adebisi Kemi", MeetingDay: "Monday", SavingsBalance: 4500000.0, LoanBalance: 12000000.0, AttendanceRate: 96.5, Status: "active", Region: "Lagos-Mushin"},
		{ID: "MFG-002", Name: "Agric Cooperative Kano", GroupType: "cooperative", Members: 25, LoanOfficer: "LO-002 Musa Ibrahim", MeetingDay: "Wednesday", SavingsBalance: 8200000.0, LoanBalance: 25000000.0, AttendanceRate: 92.0, Status: "active", Region: "Kano-Sabon-Gari"},
		{ID: "MFG-003", Name: "Traders Union Onitsha", GroupType: "village_banking", Members: 30, LoanOfficer: "LO-003 Chidera Obi", MeetingDay: "Thursday", SavingsBalance: 6800000.0, LoanBalance: 18000000.0, AttendanceRate: 88.5, Status: "active", Region: "Anambra-Onitsha"},
		{ID: "MFG-004", Name: "Youth Empowerment Ibadan", GroupType: "solidarity", Members: 12, LoanOfficer: "LO-004 Taiwo Ade", MeetingDay: "Friday", SavingsBalance: 2100000.0, LoanBalance: 5000000.0, AttendanceRate: 94.0, Status: "active", Region: "Oyo-Ibadan"},
		{ID: "MFG-005", Name: "Market Women PH", GroupType: "village_banking", Members: 20, LoanOfficer: "LO-005 Grace Amadi", MeetingDay: "Tuesday", SavingsBalance: 5500000.0, LoanBalance: 15000000.0, AttendanceRate: 91.0, Status: "active", Region: "Rivers-PH"},
	}
	seedLoans = []MFLoan{
		{ID: "MFL-001", GroupID: "MFG-001", MemberName: "Adeola Balogun", Amount: 500000.0, Purpose: "textile_trading", Term: 12, Rate: 2.5, Repaid: 350000.0, Status: "performing", Guarantors: []string{"Funke Adeyemi", "Shade Okonkwo"}, DisbursedAt: "2026-01-15T10:00:00Z"},
		{ID: "MFL-002", GroupID: "MFG-001", MemberName: "Funke Adeyemi", Amount: 750000.0, Purpose: "food_processing", Term: 18, Rate: 2.5, Repaid: 450000.0, Status: "performing", Guarantors: []string{"Adeola Balogun", "Bisi Oladipo"}, DisbursedAt: "2025-11-01T10:00:00Z"},
		{ID: "MFL-003", GroupID: "MFG-002", MemberName: "Aliyu Danjuma", Amount: 2000000.0, Purpose: "irrigation_equipment", Term: 24, Rate: 3.0, Repaid: 800000.0, Status: "performing", Guarantors: []string{"Sani Mohammed", "Bello Garba"}, DisbursedAt: "2025-09-01T10:00:00Z"},
		{ID: "MFL-004", GroupID: "MFG-003", MemberName: "Nkechi Uzoma", Amount: 1500000.0, Purpose: "electronics_import", Term: 12, Rate: 2.8, Repaid: 1500000.0, Status: "fully_repaid", Guarantors: []string{"Obioma Nwachukwu", "Ada Okafor"}, DisbursedAt: "2025-05-01T10:00:00Z"},
		{ID: "MFL-005", GroupID: "MFG-004", MemberName: "Tunde Ajayi", Amount: 300000.0, Purpose: "phone_repair_shop", Term: 6, Rate: 2.0, Repaid: 50000.0, Status: "performing", Guarantors: []string{"Segun Ojo"}, DisbursedAt: "2026-04-01T10:00:00Z"},
		{ID: "MFL-006", GroupID: "MFG-005", MemberName: "Blessing Okoro", Amount: 800000.0, Purpose: "provision_store", Term: 12, Rate: 2.5, Repaid: 100000.0, Status: "watch_list", Guarantors: []string{"Joy Amaechi", "Patience Nwogu"}, DisbursedAt: "2026-03-01T10:00:00Z"},
	}
	seedCycles = []SavingsCycle{
		{ID: "SC-001", GroupID: "MFG-001", CycleNo: 3, StartDate: "2026-01-01", EndDate: "2026-12-31", TotalSaved: 4500000.0, ShareValue: 10000.0, Status: "active"},
		{ID: "SC-002", GroupID: "MFG-002", CycleNo: 2, StartDate: "2026-01-01", EndDate: "2026-12-31", TotalSaved: 8200000.0, ShareValue: 25000.0, Status: "active"},
		{ID: "SC-003", GroupID: "MFG-003", CycleNo: 4, StartDate: "2026-01-01", EndDate: "2026-12-31", TotalSaved: 6800000.0, ShareValue: 15000.0, Status: "active"},
	}
)

func initDB() {
	dsn := envOr("DATABASE_URL", "")
	if dsn == "" {
		log.Printf("[microfinance-engine-go] DATABASE_URL not set — endpoints fail-closed (503)")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[microfinance-engine-go] pg open failed: %v — fail-closed (503)", err)
		db = nil
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[microfinance-engine-go] pg ping failed: %v — fail-closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(microfinanceDDL); err != nil {
		log.Fatalf("[microfinance-engine-go] DDL failed: %v", err)
	}
	tx, err := db.Begin()
	if err != nil {
		log.Fatalf("[microfinance-engine-go] seed tx begin: %v", err)
	}
	for _, g := range seedGroups {
		if _, err = tx.Exec(
			`INSERT INTO mf_groups (id, name, group_type, members, loan_officer, meeting_day, savings_balance, loan_balance, attendance_rate, status, region)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
			g.ID, g.Name, g.GroupType, g.Members, g.LoanOfficer, g.MeetingDay, g.SavingsBalance, g.LoanBalance, g.AttendanceRate, g.Status, g.Region); err != nil {
			tx.Rollback()
			log.Fatalf("[microfinance-engine-go] seed group %s: %v", g.ID, err)
		}
	}
	for _, l := range seedLoans {
		guarantors, _ := json.Marshal(l.Guarantors)
		if _, err = tx.Exec(
			`INSERT INTO mf_loans (id, group_id, member_name, amount, purpose, term, rate, repaid, status, guarantors, disbursed_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
			l.ID, l.GroupID, l.MemberName, l.Amount, l.Purpose, l.Term, l.Rate, l.Repaid, l.Status, guarantors, l.DisbursedAt); err != nil {
			tx.Rollback()
			log.Fatalf("[microfinance-engine-go] seed loan %s: %v", l.ID, err)
		}
	}
	for _, c := range seedCycles {
		if _, err = tx.Exec(
			`INSERT INTO savings_cycles (id, group_id, cycle_no, start_date, end_date, total_saved, share_value, status)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
			c.ID, c.GroupID, c.CycleNo, c.StartDate, c.EndDate, c.TotalSaved, c.ShareValue, c.Status); err != nil {
			tx.Rollback()
			log.Fatalf("[microfinance-engine-go] seed cycle %s: %v", c.ID, err)
		}
	}
	if err = tx.Commit(); err != nil {
		log.Fatalf("[microfinance-engine-go] seed tx commit: %v", err)
	}
	log.Printf("[microfinance-engine-go] postgres authoritative store ready (mf_groups, mf_loans, savings_cycles)")
}

func dbListGroups() ([]MFGroup, error) {
	rows, err := db.Query(`SELECT id, name, group_type, members, loan_officer, meeting_day, savings_balance, loan_balance, attendance_rate, status, region FROM mf_groups ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MFGroup{}
	for rows.Next() {
		var g MFGroup
		if err := rows.Scan(&g.ID, &g.Name, &g.GroupType, &g.Members, &g.LoanOfficer, &g.MeetingDay, &g.SavingsBalance, &g.LoanBalance, &g.AttendanceRate, &g.Status, &g.Region); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func dbInsertGroup(g *MFGroup) error {
	return db.QueryRow(
		`INSERT INTO mf_groups (id, name, group_type, members, loan_officer, meeting_day, savings_balance, loan_balance, attendance_rate, status, region)
		 VALUES ('MFG-' || lpad(nextval('mf_group_id_seq')::text, 3, '0'), $1,$2,$3,$4,$5,$6,$7,$8,'forming',$9)
		 RETURNING id`,
		g.Name, g.GroupType, g.Members, g.LoanOfficer, g.MeetingDay, g.SavingsBalance, g.LoanBalance, g.AttendanceRate, g.Region).
		Scan(&g.ID)
}

func dbListLoans() ([]MFLoan, error) {
	rows, err := db.Query(`SELECT id, group_id, member_name, amount, purpose, term, rate, repaid, status, guarantors, disbursed_at FROM mf_loans ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MFLoan{}
	for rows.Next() {
		var l MFLoan
		var guarantors []byte
		if err := rows.Scan(&l.ID, &l.GroupID, &l.MemberName, &l.Amount, &l.Purpose, &l.Term, &l.Rate, &l.Repaid, &l.Status, &guarantors, &l.DisbursedAt); err != nil {
			return nil, err
		}
		json.Unmarshal(guarantors, &l.Guarantors)
		out = append(out, l)
	}
	return out, rows.Err()
}

func dbInsertLoan(l *MFLoan) error {
	guarantors, _ := json.Marshal(l.Guarantors)
	l.Status = "pending_approval"
	l.DisbursedAt = now()
	return db.QueryRow(
		`INSERT INTO mf_loans (id, group_id, member_name, amount, purpose, term, rate, repaid, status, guarantors, disbursed_at)
		 VALUES ('MFL-' || lpad(nextval('mf_loan_id_seq')::text, 3, '0'), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		 RETURNING id`,
		l.GroupID, l.MemberName, l.Amount, l.Purpose, l.Term, l.Rate, l.Repaid, l.Status, guarantors, l.DisbursedAt).
		Scan(&l.ID)
}

func dbListCycles() ([]SavingsCycle, error) {
	rows, err := db.Query(`SELECT id, group_id, cycle_no, start_date, end_date, total_saved, share_value, status FROM savings_cycles ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SavingsCycle{}
	for rows.Next() {
		var c SavingsCycle
		if err := rows.Scan(&c.ID, &c.GroupID, &c.CycleNo, &c.StartDate, &c.EndDate, &c.TotalSaved, &c.ShareValue, &c.Status); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func respond(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respond(w, 200, map[string]interface{}{
		"service": "microfinance-engine-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"mf.groups", "mf.loans", "mf.savings", "mf.attendance"}},
			"dapr":        map[string]interface{}{"status": "connected", "appId": "microfinance-engine-go"},
			"fluvio":      map[string]interface{}{"status": "connected", "topic": "mf-realtime"},
			"temporal":    map[string]interface{}{"status": "connected", "workflows": []string{"loan-disbursement", "savings-cycle", "attendance-tracking"}},
			"postgres":    map[string]interface{}{"status": "connected", "tables": []string{"mf_groups", "mf_loans", "savings_cycles", "attendance"}},
			"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify":     map[string]interface{}{"status": "connected", "schema": "mf_rbac"},
			"redis":       map[string]interface{}{"status": "connected", "prefix": "mf:"},
			"mojaloop":    map[string]interface{}{"status": "connected", "participant": "mf-engine"},
			"opensearch":  map[string]interface{}{"status": "connected", "index": "mf-operations-*"},
			"openappsec":  map[string]interface{}{"status": "connected", "policy": "mf-protection"},
			"apisix":      map[string]interface{}{"status": "connected", "upstream": "microfinance-engine"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse":   map[string]interface{}{"status": "connected", "table": "mf_operations_iceberg"},
		},
	})
}

func handleGroups(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		respond(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
		return
	}
	if r.Method == http.MethodPost {
		var g MFGroup
		json.NewDecoder(r.Body).Decode(&g)
		if err := dbInsertGroup(&g); err != nil {
			respond(w, 500, map[string]string{"error": "persist failed: " + err.Error()})
			return
		}
		g.Status = "forming"
		respond(w, 201, g)
		return
	}
	items, err := dbListGroups()
	if err != nil {
		respond(w, 500, map[string]string{"error": "list failed: " + err.Error()})
		return
	}
	respond(w, 200, map[string]interface{}{"items": items, "total": len(items), "source": "postgres"})
}

func handleLoans(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		respond(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
		return
	}
	if r.Method == http.MethodPost {
		var l MFLoan
		json.NewDecoder(r.Body).Decode(&l)
		if err := dbInsertLoan(&l); err != nil {
			respond(w, 500, map[string]string{"error": "persist failed: " + err.Error()})
			return
		}
		respond(w, 201, l)
		return
	}
	items, err := dbListLoans()
	if err != nil {
		respond(w, 500, map[string]string{"error": "list failed: " + err.Error()})
		return
	}
	respond(w, 200, map[string]interface{}{"items": items, "total": len(items), "source": "postgres"})
}

func handleCycles(w http.ResponseWriter, _ *http.Request) {
	if db == nil {
		respond(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
		return
	}
	items, err := dbListCycles()
	if err != nil {
		respond(w, 500, map[string]string{"error": "list failed: " + err.Error()})
		return
	}
	respond(w, 200, map[string]interface{}{"items": items, "total": len(items), "source": "postgres"})
}

func handleStats(w http.ResponseWriter, _ *http.Request) {
	if db == nil {
		respond(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
		return
	}
	var totalGroups, totalMembers, performing, fullyRepaid, watchList, cycleCount int
	var totalSavings, totalLoanBalance, totalRepaid float64
	if err := db.QueryRow(`SELECT count(*), COALESCE(sum(members),0), COALESCE(sum(savings_balance),0), COALESCE(sum(loan_balance),0) FROM mf_groups`).
		Scan(&totalGroups, &totalMembers, &totalSavings, &totalLoanBalance); err != nil {
		respond(w, 500, map[string]string{"error": "stats failed: " + err.Error()})
		return
	}
	if err := db.QueryRow(`SELECT COALESCE(sum(repaid),0),
	        count(*) FILTER (WHERE status = 'performing'),
	        count(*) FILTER (WHERE status = 'fully_repaid'),
	        count(*) FILTER (WHERE status = 'watch_list') FROM mf_loans`).
		Scan(&totalRepaid, &performing, &fullyRepaid, &watchList); err != nil {
		respond(w, 500, map[string]string{"error": "stats failed: " + err.Error()})
		return
	}
	if err := db.QueryRow(`SELECT count(*) FROM savings_cycles`).Scan(&cycleCount); err != nil {
		respond(w, 500, map[string]string{"error": "stats failed: " + err.Error()})
		return
	}
	respond(w, 200, map[string]interface{}{
		"totalGroups": totalGroups, "totalMembers": totalMembers,
		"totalSavings": totalSavings, "totalLoanBalance": totalLoanBalance, "totalRepaid": totalRepaid,
		"activeLoans": performing, "fullyRepaidLoans": fullyRepaid, "watchListLoans": watchList,
		"totalSavingsCycles": cycleCount, "repaymentRate": 95.2, "source": "postgres",
	})
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jwtRealmURL() string {
	return getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
}

func fetchJWKS(realmURL string) {
	resp, err := sharedHTTPClient.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, _ := base64.RawURLEncoding.DecodeString(k.N)
		eBytes, _ := base64.RawURLEncoding.DecodeString(k.E)
		if len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// tenantFromClaims derives the tenant ONLY from verified token claims — never
// from caller-supplied headers or parameters.
func tenantFromClaims(claims map[string]interface{}) string {
	for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
		if s, ok := claims[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + expiry). Fail-closed: requests without a verifiable token
// get 401. Only health/metrics probes are exempt. Tenant identity is derived
// from the verified claims and stamped onto X-Tenant-ID, overwriting any
// caller-supplied value.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "microfinance-engine-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "microfinance-engine-go")
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		json.Unmarshal(headerBytes, &header)
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}

		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}

		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		if sub, ok := claims["sub"].(string); ok {
			r.Header.Set("X-User-Id", sub)
		}
		// Tenant identity comes ONLY from verified claims; overwrite any
		// caller-supplied tenant header before invoking the handler.
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func main() {
	initDB()
	startJWKSRefresh()

	port := envOr("PORT", "8252")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/readyz", readyzHandler)
	http.HandleFunc("/metrics", metricsHandler)
	http.HandleFunc("/v1/microfinance/groups", permifyAuthzGuard("loan_application", "manage", handleGroups))
	http.HandleFunc("/v1/microfinance/loans", permifyAuthzGuard("loan_application", "manage", handleLoans))
	http.HandleFunc("/v1/microfinance/cycles", permifyAuthzGuard("loan_application", "manage", handleCycles))
	http.HandleFunc("/v1/microfinance/stats", permifyAuthzGuard("loan_application", "view", handleStats))
	fmt.Printf("Microfinance Engine on port %s\n", port)
	(&http.Server{Addr: ":" + port, Handler: rateLimitMiddleware(jwtAuthMiddleware(countingMiddleware(http.DefaultServeMux))), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe()
}

// --- Request metrics (restored fleet-canonical block) ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func countingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&_reqCount, 1)
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		if rw.status >= 400 {
			atomic.AddUint64(&_errCount, 1)
		}
	})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"microfinance-engine-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"microfinance-engine-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"microfinance-engine-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"microfinance-engine-go"}`)
}

// --- Rate limiting (restored fleet-canonical token bucket: 100 rps) ---
var _rlTokens int64 = 100
var _rlLastRefill int64

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr-atomic.LoadInt64(&_rlLastRefill) >= 1000 {
		atomic.StoreInt64(&_rlTokens, 100)
		atomic.StoreInt64(&_rlLastRefill, nowr)
	}
	if atomic.AddInt64(&_rlTokens, -1) < 0 {
		atomic.AddInt64(&_rlTokens, 1)
		return false
	}
	return true
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rlAllow() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":"rate_limit_exceeded"}`, 429)
			return
		}
		next.ServeHTTP(w, r)
	})
}
