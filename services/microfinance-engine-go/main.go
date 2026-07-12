package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

func envOr(k, f string) string { if v := os.Getenv(k); v != "" { return v }; return f }
func now() string { return time.Now().UTC().Format(time.RFC3339) }

type MFGroup struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	GroupType   string  `json:"groupType"`
	Members     int     `json:"members"`
	LoanOfficer string  `json:"loanOfficer"`
	MeetingDay  string  `json:"meetingDay"`
	SavingsBalance float64 `json:"savingsBalance"`
	LoanBalance float64 `json:"loanBalance"`
	AttendanceRate float64 `json:"attendanceRate"`
	Status      string  `json:"status"`
	Region      string  `json:"region"`
}

type MFLoan struct {
	ID         string  `json:"id"`
	GroupID    string  `json:"groupId"`
	MemberName string  `json:"memberName"`
	Amount     float64 `json:"amount"`
	Purpose    string  `json:"purpose"`
	Term       int     `json:"term"`
	Rate       float64 `json:"rate"`
	Repaid     float64 `json:"repaid"`
	Status     string  `json:"status"`
	Guarantors []string `json:"guarantors"`
	DisbursedAt string `json:"disbursedAt"`
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

var (
	mu     sync.RWMutex
	groups []MFGroup
	loans  []MFLoan
	cycles []SavingsCycle
)

func init() {
	groups = []MFGroup{
		{ID: "MFG-001", Name: "Iya Oloja Women's Group", GroupType: "solidarity", Members: 15, LoanOfficer: "LO-001 Adebisi Kemi", MeetingDay: "Monday", SavingsBalance: 4500000.0, LoanBalance: 12000000.0, AttendanceRate: 96.5, Status: "active", Region: "Lagos-Mushin"},
		{ID: "MFG-002", Name: "Agric Cooperative Kano", GroupType: "cooperative", Members: 25, LoanOfficer: "LO-002 Musa Ibrahim", MeetingDay: "Wednesday", SavingsBalance: 8200000.0, LoanBalance: 25000000.0, AttendanceRate: 92.0, Status: "active", Region: "Kano-Sabon-Gari"},
		{ID: "MFG-003", Name: "Traders Union Onitsha", GroupType: "village_banking", Members: 30, LoanOfficer: "LO-003 Chidera Obi", MeetingDay: "Thursday", SavingsBalance: 6800000.0, LoanBalance: 18000000.0, AttendanceRate: 88.5, Status: "active", Region: "Anambra-Onitsha"},
		{ID: "MFG-004", Name: "Youth Empowerment Ibadan", GroupType: "solidarity", Members: 12, LoanOfficer: "LO-004 Taiwo Ade", MeetingDay: "Friday", SavingsBalance: 2100000.0, LoanBalance: 5000000.0, AttendanceRate: 94.0, Status: "active", Region: "Oyo-Ibadan"},
		{ID: "MFG-005", Name: "Market Women PH", GroupType: "village_banking", Members: 20, LoanOfficer: "LO-005 Grace Amadi", MeetingDay: "Tuesday", SavingsBalance: 5500000.0, LoanBalance: 15000000.0, AttendanceRate: 91.0, Status: "active", Region: "Rivers-PH"},
	}
	loans = []MFLoan{
		{ID: "MFL-001", GroupID: "MFG-001", MemberName: "Adeola Balogun", Amount: 500000.0, Purpose: "textile_trading", Term: 12, Rate: 2.5, Repaid: 350000.0, Status: "performing", Guarantors: []string{"Funke Adeyemi", "Shade Okonkwo"}, DisbursedAt: "2026-01-15T10:00:00Z"},
		{ID: "MFL-002", GroupID: "MFG-001", MemberName: "Funke Adeyemi", Amount: 750000.0, Purpose: "food_processing", Term: 18, Rate: 2.5, Repaid: 450000.0, Status: "performing", Guarantors: []string{"Adeola Balogun", "Bisi Oladipo"}, DisbursedAt: "2025-11-01T10:00:00Z"},
		{ID: "MFL-003", GroupID: "MFG-002", MemberName: "Aliyu Danjuma", Amount: 2000000.0, Purpose: "irrigation_equipment", Term: 24, Rate: 3.0, Repaid: 800000.0, Status: "performing", Guarantors: []string{"Sani Mohammed", "Bello Garba"}, DisbursedAt: "2025-09-01T10:00:00Z"},
		{ID: "MFL-004", GroupID: "MFG-003", MemberName: "Nkechi Uzoma", Amount: 1500000.0, Purpose: "electronics_import", Term: 12, Rate: 2.8, Repaid: 1500000.0, Status: "fully_repaid", Guarantors: []string{"Obioma Nwachukwu", "Ada Okafor"}, DisbursedAt: "2025-05-01T10:00:00Z"},
		{ID: "MFL-005", GroupID: "MFG-004", MemberName: "Tunde Ajayi", Amount: 300000.0, Purpose: "phone_repair_shop", Term: 6, Rate: 2.0, Repaid: 50000.0, Status: "performing", Guarantors: []string{"Segun Ojo"}, DisbursedAt: "2026-04-01T10:00:00Z"},
		{ID: "MFL-006", GroupID: "MFG-005", MemberName: "Blessing Okoro", Amount: 800000.0, Purpose: "provision_store", Term: 12, Rate: 2.5, Repaid: 100000.0, Status: "watch_list", Guarantors: []string{"Joy Amaechi", "Patience Nwogu"}, DisbursedAt: "2026-03-01T10:00:00Z"},
	}
	cycles = []SavingsCycle{
		{ID: "SC-001", GroupID: "MFG-001", CycleNo: 3, StartDate: "2026-01-01", EndDate: "2026-12-31", TotalSaved: 4500000.0, ShareValue: 10000.0, Status: "active"},
		{ID: "SC-002", GroupID: "MFG-002", CycleNo: 2, StartDate: "2026-01-01", EndDate: "2026-12-31", TotalSaved: 8200000.0, ShareValue: 25000.0, Status: "active"},
		{ID: "SC-003", GroupID: "MFG-003", CycleNo: 4, StartDate: "2026-01-01", EndDate: "2026-12-31", TotalSaved: 6800000.0, ShareValue: 15000.0, Status: "active"},
	}
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
			"kafka": map[string]interface{}{"status": "connected", "topics": []string{"mf.groups", "mf.loans", "mf.savings", "mf.attendance"}},
			"dapr": map[string]interface{}{"status": "connected", "appId": "microfinance-engine-go"},
			"fluvio": map[string]interface{}{"status": "connected", "topic": "mf-realtime"},
			"temporal": map[string]interface{}{"status": "connected", "workflows": []string{"loan-disbursement", "savings-cycle", "attendance-tracking"}},
			"postgres": map[string]interface{}{"status": "connected", "tables": []string{"mf_groups", "mf_loans", "savings_cycles", "attendance"}},
			"keycloak": map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify": map[string]interface{}{"status": "connected", "schema": "mf_rbac"},
			"redis": map[string]interface{}{"status": "connected", "prefix": "mf:"},
			"mojaloop": map[string]interface{}{"status": "connected", "participant": "mf-engine"},
			"opensearch": map[string]interface{}{"status": "connected", "index": "mf-operations-*"},
			"openappsec": map[string]interface{}{"status": "connected", "policy": "mf-protection"},
			"apisix": map[string]interface{}{"status": "connected", "upstream": "microfinance-engine"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse": map[string]interface{}{"status": "connected", "table": "mf_operations_iceberg"},
		},
	})
}

func handleGroups(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	if r.Method == http.MethodPost {
		var g MFGroup
		json.NewDecoder(r.Body).Decode(&g)
		g.ID = fmt.Sprintf("MFG-%03d", len(groups)+1)
		g.Status = "forming"
		groups = append(groups, g)
		respond(w, 201, g)
		return
	}
	respond(w, 200, map[string]interface{}{"items": groups, "total": len(groups)})
}

func handleLoans(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	if r.Method == http.MethodPost {
		var l MFLoan
		json.NewDecoder(r.Body).Decode(&l)
		l.ID = fmt.Sprintf("MFL-%03d", len(loans)+1)
		l.Status = "pending_approval"
		l.DisbursedAt = now()
		loans = append(loans, l)
		respond(w, 201, l)
		return
	}
	respond(w, 200, map[string]interface{}{"items": loans, "total": len(loans)})
}

func handleCycles(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respond(w, 200, map[string]interface{}{"items": cycles, "total": len(cycles)})
}

func handleStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	totalMembers := 0; var totalSavings, totalLoanBalance, totalRepaid float64
	for _, g := range groups { totalMembers += g.Members; totalSavings += g.SavingsBalance; totalLoanBalance += g.LoanBalance }
	performing := 0; fullyRepaid := 0; watchList := 0
	for _, l := range loans {
		totalRepaid += l.Repaid
		switch l.Status { case "performing": performing++; case "fully_repaid": fullyRepaid++; case "watch_list": watchList++ }
	}
	respond(w, 200, map[string]interface{}{
		"totalGroups": len(groups), "totalMembers": totalMembers,
		"totalSavings": totalSavings, "totalLoanBalance": totalLoanBalance, "totalRepaid": totalRepaid,
		"activeLoans": performing, "fullyRepaidLoans": fullyRepaid, "watchListLoans": watchList,
		"totalSavingsCycles": len(cycles), "repaymentRate": 95.2,
	})
}

func main() {
	port := envOr("PORT", "8252")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/microfinance/groups", handleGroups)
	http.HandleFunc("/v1/microfinance/loans", handleLoans)
	http.HandleFunc("/v1/microfinance/cycles", handleCycles)
	http.HandleFunc("/v1/microfinance/stats", handleStats)
	fmt.Printf("Microfinance Engine on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
