package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
)

var middlewareConfig = map[string]interface{}{
	"kafka": map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"kyb.cac-verified", "kyb.cac-status-changed", "kyb.director-changed", "kyb.annual-return-overdue"}},
	"dapr": map[string]interface{}{"app_id": "cac-realtime-api-go", "url": envOr("DAPR_URL", "http://localhost:3500")},
	"fluvio": map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"cac-verification-stream", "cac-monitoring-stream"}},
	"temporal": map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "namespace": "cac-verification", "workflows": []string{"CACSearchWorkflow", "DirectorVerificationWorkflow", "AnnualReturnMonitorWorkflow"}},
	"postgres": map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"cac_companies", "cac_directors", "cac_annual_returns", "cac_monitoring"}},
	"keycloak": map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client_id": "cac-realtime-api"},
	"permify": map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "schema": "cac_api"},
	"redis": map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "keys": []string{"cac:company:{rc}", "cac:director:{bvn}", "cac:annual-return:{rc}"}},
	"mojaloop": map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "purpose": "corporate-identity-oracle"},
	"opensearch": map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"cac-verifications", "cac-directors", "cac-monitoring"}},
	"openappsec": map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policies": []string{"cac-api-protection"}},
	"apisix": map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/cac/*"}},
	"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledger": "cac-verification-billing"},
	"lakehouse": map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"cac_verification_history", "cac_company_analytics"}},
}

func envOr(k, d string) string { if v := os.Getenv(k); v != "" { return v }; return d }

type CACCompany struct {
	ID string `json:"id"`; RCNumber string `json:"rcNumber"`; CompanyName string `json:"companyName"`
	CompanyType string `json:"companyType"`; RegistrationDate string `json:"registrationDate"`
	Status string `json:"status"`; Address string `json:"registeredAddress"`; State string `json:"state"`
	ShareCapital int64 `json:"shareCapital"`; Industry string `json:"industry"`
	AnnualReturnsUpToDate bool `json:"annualReturnsUpToDate"`; LastAnnualReturn string `json:"lastAnnualReturn"`
	PostNoDebit bool `json:"postNoDebit"`; Directors []CACDirector `json:"directors"`
	APIResponseTime int `json:"apiResponseTimeMs"`; VerifiedAt string `json:"verifiedAt"`
}

type CACDirector struct {
	Name string `json:"name"`; BVN string `json:"bvn"`; NIN string `json:"nin"`
	Role string `json:"role"`; SharePct float64 `json:"shareholdingPercent"`
	Nationality string `json:"nationality"`; AppointmentDate string `json:"appointmentDate"`
	Status string `json:"status"`
}

var companies = []CACCompany{
	{ID: "CAC-001", RCNumber: "RC-123456", CompanyName: "Pinnacle Trading Ltd", CompanyType: "private_limited",
		RegistrationDate: "2015-03-15", Status: "active", Address: "42 Marina Road, Lagos Island",
		State: "Lagos", ShareCapital: 100000000, Industry: "general_trading",
		AnnualReturnsUpToDate: true, LastAnnualReturn: "2025-12-31", PostNoDebit: false,
		Directors: []CACDirector{
			{Name: "Emeka Okonkwo", BVN: "11122233344", NIN: "22233344455", Role: "Managing Director", SharePct: 60.0, Nationality: "Nigerian", AppointmentDate: "2015-03-15", Status: "active"},
			{Name: "Folake Adeyemi", BVN: "55566677788", NIN: "66677788899", Role: "Director", SharePct: 25.0, Nationality: "Nigerian", AppointmentDate: "2015-03-15", Status: "active"},
			{Name: "James Obi", BVN: "99900011122", NIN: "00011122233", Role: "Company Secretary", SharePct: 15.0, Nationality: "Nigerian", AppointmentDate: "2018-06-01", Status: "active"},
		}, APIResponseTime: 450, VerifiedAt: "2026-05-12T10:00:00Z"},
	{ID: "CAC-002", RCNumber: "RC-789012", CompanyName: "ABC Import Export Ltd", CompanyType: "private_limited",
		RegistrationDate: "2010-08-20", Status: "active", Address: "15 Apapa Wharf Road, Lagos",
		State: "Lagos", ShareCapital: 500000000, Industry: "import_export",
		AnnualReturnsUpToDate: false, LastAnnualReturn: "2023-12-31", PostNoDebit: false,
		Directors: []CACDirector{
			{Name: "Aliyu Mohammed", BVN: "33344455566", NIN: "44455566677", Role: "Chairman", SharePct: 70.0, Nationality: "Nigerian", AppointmentDate: "2010-08-20", Status: "active"},
			{Name: "Grace Nwankwo", BVN: "77788899900", NIN: "88899900011", Role: "Director", SharePct: 30.0, Nationality: "Nigerian", AppointmentDate: "2010-08-20", Status: "active"},
		}, APIResponseTime: 380, VerifiedAt: "2026-05-12T11:00:00Z"},
	{ID: "CAC-003", RCNumber: "RC-345678", CompanyName: "Quantum Resources Nigeria Ltd", CompanyType: "private_limited",
		RegistrationDate: "2018-01-10", Status: "under_investigation", Address: "8 Wuse Zone 5, Abuja",
		State: "FCT", ShareCapital: 50000000, Industry: "resources",
		AnnualReturnsUpToDate: false, LastAnnualReturn: "2024-06-30", PostNoDebit: true,
		Directors: []CACDirector{
			{Name: "Unknown Nominee A", BVN: "", NIN: "", Role: "Director", SharePct: 100.0, Nationality: "Unknown", AppointmentDate: "2018-01-10", Status: "flagged"},
		}, APIResponseTime: 520, VerifiedAt: "2026-05-12T14:00:00Z"},
}

func main() {
	port := envOr("PORT", "8284")
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": "cac-realtime-api-go", "version": "1.0.0", "middleware": middlewareConfig})
	})
	http.HandleFunc("/api/companies", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"items": companies, "total": len(companies)})
	})
	http.HandleFunc("/api/companies/search", func(w http.ResponseWriter, r *http.Request) {
		rc := r.URL.Query().Get("rc")
		for _, c := range companies { if c.RCNumber == rc { json.NewEncoder(w).Encode(c); return } }
		w.WriteHeader(404); json.NewEncoder(w).Encode(map[string]string{"error": "RC number not found"})
	})
	http.HandleFunc("/api/companies/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/api/companies/")
		for _, c := range companies { if c.ID == id || c.RCNumber == id { json.NewEncoder(w).Encode(c); return } }
		w.WriteHeader(404)
	})
	http.HandleFunc("/api/directors/verify", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{"message": "Director verification initiated", "checks": []string{"BVN_match", "NIN_match", "PEP_screen", "sanctions_screen"}})
	})
	http.HandleFunc("/api/annual-returns/status", func(w http.ResponseWriter, r *http.Request) {
		overdue := []map[string]string{}
		for _, c := range companies { if !c.AnnualReturnsUpToDate { overdue = append(overdue, map[string]string{"rcNumber": c.RCNumber, "companyName": c.CompanyName, "lastFiled": c.LastAnnualReturn}) } }
		json.NewEncoder(w).Encode(map[string]interface{}{"overdue_companies": overdue, "total_overdue": len(overdue)})
	})
	fmt.Printf("cac-realtime-api-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, nil)
}
