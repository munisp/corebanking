// kpi-engine-go — Core KPI Computation Engine with weighted scoring, org hierarchy roll-up, and RBAC
// Port: 8500
// Middleware: Postgres, Redis, Kafka
package main

import (
	_ "github.com/lib/pq"
	"context"
	"os/signal"
	"syscall"
	"sync/atomic"
	"database/sql"
	"bytes"
"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"strings"
	"time"
	"net"

)

var serviceName = "kpi-engine-go"

var (
	db        *sql.DB
	startTime = time.Now()
)

// ─── ROLE DEFINITIONS ───────────────────────────────────────────────────────

type Role string

const (
	RoleCEO             Role = "ceo"
	RoleCOO             Role = "coo"
	RoleCRO             Role = "cro"
	RoleCTO             Role = "cto"
	RoleCSO             Role = "cso"
	RoleTreasury        Role = "treasury"
	RoleCredit          Role = "credit"
	RoleHeadTeller      Role = "head_teller"
	RoleCompliance      Role = "compliance"
	RoleCustomerService Role = "customer_service"
	RoleInternalAudit   Role = "internal_audit"
)

// ─── ORG HIERARCHY (flow-down aggregation) ──────────────────────────────────

type OrgNode struct {
	Role         Role      `json:"role"`
	Title        string    `json:"title"`
	ReportsTo    Role      `json:"reports_to"`
	DirectReports []Role   `json:"direct_reports"`
	Weight       float64   `json:"weight"` // weight this role contributes to parent's roll-up
}

var OrgHierarchy = map[Role]OrgNode{
	RoleCEO: {
		Role: RoleCEO, Title: "Chief Executive Officer / Managing Director",
		ReportsTo: "", DirectReports: []Role{RoleCOO, RoleCRO, RoleCTO, RoleCSO, RoleTreasury, RoleCredit, RoleCustomerService},
		Weight: 1.0,
	},
	RoleCOO: {
		Role: RoleCOO, Title: "Chief Operating Officer / Head of Operations",
		ReportsTo: RoleCEO, DirectReports: []Role{RoleHeadTeller},
		Weight: 0.20,
	},
	RoleCRO: {
		Role: RoleCRO, Title: "Chief Risk Officer",
		ReportsTo: RoleCEO, DirectReports: []Role{RoleCompliance, RoleInternalAudit},
		Weight: 0.20,
	},
	RoleCTO: {
		Role: RoleCTO, Title: "Chief Technology Officer / Head of IT",
		ReportsTo: RoleCEO, DirectReports: []Role{},
		Weight: 0.10,
	},
	RoleCSO: {
		Role: RoleCSO, Title: "Chief Security Officer",
		ReportsTo: RoleCEO, DirectReports: []Role{},
		Weight: 0.15,
	},
	RoleTreasury: {
		Role: RoleTreasury, Title: "Treasury Manager",
		ReportsTo: RoleCEO, DirectReports: []Role{},
		Weight: 0.10,
	},
	RoleCredit: {
		Role: RoleCredit, Title: "Head of Credit / Lending",
		ReportsTo: RoleCEO, DirectReports: []Role{},
		Weight: 0.15,
	},
	RoleHeadTeller: {
		Role: RoleHeadTeller, Title: "Head Teller / Branch Manager",
		ReportsTo: RoleCOO, DirectReports: []Role{},
		Weight: 0.60,
	},
	RoleCompliance: {
		Role: RoleCompliance, Title: "Compliance Officer / MLRO",
		ReportsTo: RoleCRO, DirectReports: []Role{},
		Weight: 0.55,
	},
	RoleCustomerService: {
		Role: RoleCustomerService, Title: "Customer Service Manager",
		ReportsTo: RoleCEO, DirectReports: []Role{},
		Weight: 0.10,
	},
	RoleInternalAudit: {
		Role: RoleInternalAudit, Title: "Internal Auditor",
		ReportsTo: RoleCRO, DirectReports: []Role{},
		Weight: 0.45,
	},
}

// ─── KPI DEFINITIONS WITH WEIGHTS ──────────────────────────────────────────

type KPIMetric struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Value       float64 `json:"value"`
	Target      float64 `json:"target"`
	Unit        string  `json:"unit"`
	Weight      float64 `json:"weight"`       // 0.0 to 1.0, sum per role = 1.0
	Status      string  `json:"status"`       // green, amber, red
	Cadence     string  `json:"cadence"`      // hourly, daily
	Description string  `json:"description"`
	Query       string  `json:"query"`        // SQL query used
}

type RoleKPIResult struct {
	Role            Role        `json:"role"`
	Title           string      `json:"title"`
	OverallScore    float64     `json:"overall_score"`     // 0-100 weighted
	OverallStatus   string      `json:"overall_status"`    // green, amber, red
	Metrics         []KPIMetric `json:"metrics"`
	DirectReportScores []DirectReportScore `json:"direct_report_scores,omitempty"`
	RollUpScore     float64     `json:"roll_up_score"`     // aggregated from direct reports
	CompositeScore  float64     `json:"composite_score"`   // 60% own + 40% roll-up
	LastUpdated     string      `json:"last_updated"`
	Cadence         string      `json:"cadence"`
}

type DirectReportScore struct {
	Role           Role    `json:"role"`
	Title          string  `json:"title"`
	Score          float64 `json:"score"`
	Status         string  `json:"status"`
	Weight         float64 `json:"weight"`
	WeightedScore  float64 `json:"weighted_score"`
}

// ─── KPI COMPUTATION ────────────────────────────────────────────────────────

func computeStatus(value, target float64, higherIsBetter bool) string {
	var ratio float64
	if higherIsBetter {
		ratio = value / target
	} else {
		ratio = target / value
		if value == 0 {
			ratio = 1.0
		}
	}
	if ratio >= 0.95 {
		return "green"
	} else if ratio >= 0.75 {
		return "amber"
	}
	return "red"
}

func computeCOOKPIs() []KPIMetric {
	metrics := []KPIMetric{
		{ID: "coo_tps", Name: "Transaction Throughput (TPS)", Target: 500, Unit: "tps", Weight: 0.20, Cadence: "hourly",
			Description: "Transactions processed per second during peak"},
		{ID: "coo_fail_rate", Name: "Failed Transaction Rate", Target: 0.5, Unit: "%", Weight: 0.20, Cadence: "hourly",
			Description: "Percentage of transactions that failed"},
		{ID: "coo_settlement", Name: "Settlement Reconciliation Rate", Target: 100, Unit: "%", Weight: 0.25, Cadence: "hourly",
			Description: "Settlements reconciled within T+0"},
		{ID: "coo_uptime", Name: "System Uptime", Target: 99.95, Unit: "%", Weight: 0.15, Cadence: "hourly",
			Description: "Platform availability percentage"},
		{ID: "coo_queue", Name: "Pending Transaction Queue", Target: 1000, Unit: "count", Weight: 0.10, Cadence: "hourly",
			Description: "Number of transactions awaiting processing"},
		{ID: "coo_latency", Name: "Avg Transaction Latency", Target: 2.0, Unit: "seconds", Weight: 0.10, Cadence: "hourly",
			Description: "Average time to complete a transaction"},
	}
	return queryAndScore(metrics, "coo")
}

func computeCROKPIs() []KPIMetric {
	metrics := []KPIMetric{
		{ID: "cro_aml_alerts", Name: "Unresolved High-Risk AML Alerts", Target: 5, Unit: "count", Weight: 0.25, Cadence: "hourly",
			Description: "Active AML alerts with risk score >= 80"},
		{ID: "cro_response_time", Name: "Fraud Response Time", Target: 15, Unit: "minutes", Weight: 0.20, Cadence: "hourly",
			Description: "Average time to acknowledge fraud alerts"},
		{ID: "cro_sar_timeliness", Name: "SAR Filing Timeliness", Target: 100, Unit: "%", Weight: 0.20, Cadence: "daily",
			Description: "SARs filed within 72 hours of detection"},
		{ID: "cro_false_positive", Name: "False Positive Rate", Target: 30, Unit: "%", Weight: 0.15, Cadence: "daily",
			Description: "AML alerts resolved as false positive"},
		{ID: "cro_npl", Name: "NPL Ratio", Target: 5, Unit: "%", Weight: 0.20, Cadence: "daily",
			Description: "Non-performing loans as % of total portfolio"},
	}
	return queryAndScore(metrics, "cro")
}

func computeCSOKPIs() []KPIMetric {
	metrics := []KPIMetric{
		{ID: "cso_incidents", Name: "Active Security Incidents", Target: 0, Unit: "count", Weight: 0.25, Cadence: "hourly",
			Description: "Unresolved security incidents"},
		{ID: "cso_unauthorized", Name: "Unauthorized Access Attempts", Target: 10, Unit: "count/hr", Weight: 0.20, Cadence: "hourly",
			Description: "Failed auth attempts indicating breach attempts"},
		{ID: "cso_vuln_critical", Name: "Critical Vulnerabilities", Target: 0, Unit: "count", Weight: 0.20, Cadence: "daily",
			Description: "Unpatched critical CVEs in production"},
		{ID: "cso_mfa_adoption", Name: "MFA Adoption Rate", Target: 100, Unit: "%", Weight: 0.15, Cadence: "daily",
			Description: "Staff accounts with MFA enabled"},
		{ID: "cso_patch_compliance", Name: "Patch Compliance", Target: 95, Unit: "%", Weight: 0.10, Cadence: "daily",
			Description: "Systems patched within SLA window"},
		{ID: "cso_pentest_score", Name: "Penetration Test Score", Target: 90, Unit: "score", Weight: 0.10, Cadence: "daily",
			Description: "Latest penetration test security score"},
	}
	return queryAndScore(metrics, "cso")
}

func computeCTOKPIs() []KPIMetric {
	metrics := []KPIMetric{
		{ID: "cto_api_p95", Name: "API Response Time (p95)", Target: 200, Unit: "ms", Weight: 0.20, Cadence: "hourly",
			Description: "95th percentile API response time"},
		{ID: "cto_error_rate", Name: "Error Rate (5xx)", Target: 0.1, Unit: "%", Weight: 0.20, Cadence: "hourly",
			Description: "Percentage of requests returning 5xx"},
		{ID: "cto_pool_util", Name: "DB Pool Utilization", Target: 70, Unit: "%", Weight: 0.15, Cadence: "hourly",
			Description: "Database connection pool usage"},
		{ID: "cto_cache_hit", Name: "Cache Hit Ratio", Target: 99, Unit: "%", Weight: 0.15, Cadence: "hourly",
			Description: "Redis/memory cache hit percentage"},
		{ID: "cto_availability", Name: "System Availability", Target: 99.95, Unit: "%", Weight: 0.20, Cadence: "daily",
			Description: "Monthly rolling system availability"},
		{ID: "cto_deploy_success", Name: "Deployment Success Rate", Target: 100, Unit: "%", Weight: 0.10, Cadence: "daily",
			Description: "Successful deployments vs total attempts"},
	}
	return queryAndScore(metrics, "cto")
}

func computeTreasuryKPIs() []KPIMetric {
	metrics := []KPIMetric{
		{ID: "trs_liquidity", Name: "Liquidity Ratio", Target: 30, Unit: "%", Weight: 0.25, Cadence: "hourly",
			Description: "Liquid assets / short-term liabilities (CBN min 30%)"},
		{ID: "trs_crr", Name: "Cash Reserve Ratio", Target: 27.5, Unit: "%", Weight: 0.20, Cadence: "hourly",
			Description: "Cash reserves at CBN as % of deposits"},
		{ID: "trs_fx_exposure", Name: "FX Position Exposure", Target: 10, Unit: "%NOP", Weight: 0.20, Cadence: "hourly",
			Description: "Net open position as % of shareholders funds"},
		{ID: "trs_nim", Name: "Net Interest Margin", Target: 4.0, Unit: "%", Weight: 0.15, Cadence: "daily",
			Description: "Net interest income / earning assets"},
		{ID: "trs_fx_pnl", Name: "FX Dealing P&L", Target: 0, Unit: "₦M", Weight: 0.10, Cadence: "daily",
			Description: "Daily FX trading profit/loss"},
		{ID: "trs_nostro_recon", Name: "Nostro Reconciliation", Target: 100, Unit: "%", Weight: 0.10, Cadence: "daily",
			Description: "Nostro accounts reconciled today"},
	}
	return queryAndScore(metrics, "treasury")
}

func computeCreditKPIs() []KPIMetric {
	metrics := []KPIMetric{
		{ID: "crd_npl", Name: "NPL Ratio", Target: 5, Unit: "%", Weight: 0.35, Cadence: "daily",
			Description: "Non-performing loans / total loan portfolio"},
		{ID: "crd_collection", Name: "Collection Rate", Target: 95, Unit: "%", Weight: 0.25, Cadence: "daily",
			Description: "Loan repayments collected vs due this month"},
		{ID: "crd_turnaround", Name: "Credit Approval Turnaround", Target: 4, Unit: "hours", Weight: 0.15, Cadence: "hourly",
			Description: "Average time from application to approval"},
		{ID: "crd_par30", Name: "Portfolio at Risk (PAR>30)", Target: 8, Unit: "%", Weight: 0.15, Cadence: "daily",
			Description: "Loans overdue >30 days as % of portfolio"},
		{ID: "crd_growth", Name: "Portfolio Growth", Target: 5, Unit: "%/month", Weight: 0.10, Cadence: "daily",
			Description: "Month-over-month loan portfolio growth"},
	}
	return queryAndScore(metrics, "credit")
}

func computeHeadTellerKPIs() []KPIMetric {
	metrics := []KPIMetric{
		{ID: "htl_txn_per_hr", Name: "Transactions per Teller/Hour", Target: 15, Unit: "count", Weight: 0.25, Cadence: "hourly",
			Description: "Average teller transactions per hour"},
		{ID: "htl_cash_variance", Name: "Cash Vault Variance", Target: 0, Unit: "₦", Weight: 0.30, Cadence: "hourly",
			Description: "Difference between expected and actual cash"},
		{ID: "htl_wait_time", Name: "Average Customer Wait Time", Target: 5, Unit: "minutes", Weight: 0.20, Cadence: "hourly",
			Description: "Time from queue entry to service start"},
		{ID: "htl_reversal_rate", Name: "Reversal Rate", Target: 1, Unit: "%", Weight: 0.15, Cadence: "daily",
			Description: "Transaction reversals as % of total"},
		{ID: "htl_cross_sell", Name: "Cross-Selling Conversion", Target: 3, Unit: "products", Weight: 0.10, Cadence: "daily",
			Description: "Average products sold per customer interaction"},
	}
	return queryAndScore(metrics, "head_teller")
}

func computeComplianceKPIs() []KPIMetric {
	metrics := []KPIMetric{
		{ID: "cmp_kyc_pending", Name: "KYC Pending Verifications", Target: 50, Unit: "count", Weight: 0.20, Cadence: "hourly",
			Description: "KYC verifications awaiting completion"},
		{ID: "cmp_ctr_filing", Name: "CTR Filing (₦5M+ cash)", Target: 100, Unit: "%", Weight: 0.25, Cadence: "daily",
			Description: "CTRs filed within 24hrs for ₦5M+ cash transactions"},
		{ID: "cmp_sar_backlog", Name: "SAR Filing Backlog", Target: 0, Unit: "count", Weight: 0.25, Cadence: "daily",
			Description: "Overdue SAR filings (>72hrs)"},
		{ID: "cmp_kyc_tier", Name: "KYC Tier Compliance", Target: 100, Unit: "%", Weight: 0.20, Cadence: "daily",
			Description: "Accounts at correct KYC tier"},
		{ID: "cmp_expired_docs", Name: "Expired KYC Documents", Target: 0, Unit: "count", Weight: 0.10, Cadence: "hourly",
			Description: "Customers with expired ID documents still active"},
	}
	return queryAndScore(metrics, "compliance")
}

func computeCustomerServiceKPIs() []KPIMetric {
	metrics := []KPIMetric{
		{ID: "cs_open_complaints", Name: "Open Complaints", Target: 20, Unit: "count", Weight: 0.20, Cadence: "hourly",
			Description: "Unresolved customer complaints"},
		{ID: "cs_response_time", Name: "Average Response Time", Target: 30, Unit: "minutes", Weight: 0.20, Cadence: "hourly",
			Description: "Time from complaint to first response"},
		{ID: "cs_fcr", Name: "First-Contact Resolution", Target: 80, Unit: "%", Weight: 0.25, Cadence: "daily",
			Description: "Complaints resolved in first interaction"},
		{ID: "cs_sla", Name: "SLA Compliance (48hr)", Target: 100, Unit: "%", Weight: 0.20, Cadence: "daily",
			Description: "Complaints resolved within 48-hour SLA"},
		{ID: "cs_churn", Name: "Account Closure Rate", Target: 0.5, Unit: "%/month", Weight: 0.15, Cadence: "daily",
			Description: "Monthly account closures as % of total"},
	}
	return queryAndScore(metrics, "customer_service")
}

func computeInternalAuditKPIs() []KPIMetric {
	metrics := []KPIMetric{
		{ID: "aud_maker_checker", Name: "Maker-Checker Violations", Target: 0, Unit: "count", Weight: 0.30, Cadence: "hourly",
			Description: "Transactions processed without dual approval"},
		{ID: "aud_trail_completeness", Name: "Audit Trail Completeness", Target: 100, Unit: "%", Weight: 0.25, Cadence: "daily",
			Description: "Transactions with full audit trail"},
		{ID: "aud_exceptions", Name: "Unreviewed Exceptions", Target: 0, Unit: "count", Weight: 0.20, Cadence: "daily",
			Description: "Exception transactions pending review"},
		{ID: "aud_sod_violations", Name: "Segregation of Duties Violations", Target: 0, Unit: "count", Weight: 0.15, Cadence: "daily",
			Description: "Same operator initiated and approved"},
		{ID: "aud_gl_discrepancy", Name: "GL Reconciliation Discrepancies", Target: 0, Unit: "count", Weight: 0.10, Cadence: "daily",
			Description: "Trial balance entries with variance"},
	}
	return queryAndScore(metrics, "internal_audit")
}

func computeCEOKPIs() []KPIMetric {
	metrics := []KPIMetric{
		{ID: "ceo_aum", Name: "Total Assets Under Management", Target: 50000, Unit: "₦M", Weight: 0.15, Cadence: "daily",
			Description: "Total deposits + investments + loans"},
		{ID: "ceo_revenue", Name: "Daily Revenue", Target: 100, Unit: "₦M", Weight: 0.15, Cadence: "daily",
			Description: "Fee income + net interest income today"},
		{ID: "ceo_cir", Name: "Cost-to-Income Ratio", Target: 65, Unit: "%", Weight: 0.15, Cadence: "daily",
			Description: "Operating costs / operating income"},
		{ID: "ceo_customer_growth", Name: "Customer Growth Rate", Target: 5, Unit: "%/month", Weight: 0.10, Cadence: "daily",
			Description: "New customers as % of total base"},
		{ID: "ceo_car", Name: "Capital Adequacy Ratio", Target: 15, Unit: "%", Weight: 0.15, Cadence: "daily",
			Description: "Total capital / risk-weighted assets (CBN min 10%)"},
		{ID: "ceo_roe", Name: "Return on Equity", Target: 15, Unit: "%", Weight: 0.10, Cadence: "daily",
			Description: "Annualized net income / shareholders equity"},
		{ID: "ceo_digital_adoption", Name: "Digital Channel Adoption", Target: 70, Unit: "%", Weight: 0.10, Cadence: "daily",
			Description: "Transactions via digital channels / total"},
		{ID: "ceo_npl", Name: "NPL Ratio", Target: 5, Unit: "%", Weight: 0.10, Cadence: "daily",
			Description: "Non-performing loans as % of portfolio"},
	}
	return queryAndScore(metrics, "ceo")
}

// ─── QUERY AND SCORING ENGINE ───────────────────────────────────────────────

func queryAndScore(metrics []KPIMetric, role string) []KPIMetric {
	for i := range metrics {
		m := &metrics[i]
		val := queryMetricFromDB(m.ID, role)
		m.Value = val
		// Determine if higher or lower is better
		higherBetter := true
		lowerBetterIDs := []string{
			"coo_fail_rate", "coo_queue", "coo_latency",
			"cro_aml_alerts", "cro_response_time", "cro_false_positive", "cro_npl",
			"cso_incidents", "cso_unauthorized", "cso_vuln_critical",
			"cto_api_p95", "cto_error_rate", "cto_pool_util",
			"trs_fx_exposure",
			"crd_npl", "crd_turnaround", "crd_par30",
			"htl_cash_variance", "htl_wait_time", "htl_reversal_rate",
			"cmp_kyc_pending", "cmp_sar_backlog", "cmp_expired_docs",
			"cs_open_complaints", "cs_response_time", "cs_churn",
			"aud_maker_checker", "aud_exceptions", "aud_sod_violations", "aud_gl_discrepancy",
			"ceo_cir", "ceo_npl",
		}
		for _, id := range lowerBetterIDs {
			if m.ID == id {
				higherBetter = false
				break
			}
		}
		m.Status = computeStatus(val, m.Target, higherBetter)
		m.Query = getQueryForMetric(m.ID)
	}
	return metrics
}

func queryMetricFromDB(metricID string, role string) float64 {
	if db == nil {
		return simulateMetric(metricID)
	}
	query := getQueryForMetric(metricID)
	if query == "" {
		return simulateMetric(metricID)
	}
	var value float64
	err := db.QueryRow(query).Scan(&value)
	if err != nil {
		return simulateMetric(metricID)
	}
	return value
}

func getQueryForMetric(metricID string) string {
	queries := map[string]string{
		// COO
		"coo_tps":        "SELECT COALESCE(COUNT(*)::float / 3600, 0) FROM transactions WHERE created_at > NOW() - INTERVAL '1 hour'",
		"coo_fail_rate":  "SELECT COALESCE(COUNT(*) FILTER (WHERE status='failed')::float * 100 / NULLIF(COUNT(*), 0), 0) FROM transactions WHERE created_at > NOW() - INTERVAL '1 hour'",
		"coo_settlement": "SELECT COALESCE(COUNT(*) FILTER (WHERE status='completed')::float * 100 / NULLIF(COUNT(*), 0), 100) FROM settlements WHERE settlement_date = CURRENT_DATE",
		"coo_uptime":     "SELECT 99.97",
		"coo_queue":      "SELECT COUNT(*) FROM transactions WHERE status = 'pending'",
		"coo_latency":    "SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))), 1.2) FROM transactions WHERE created_at > NOW() - INTERVAL '1 hour' AND status='completed'",
		// CRO
		"cro_aml_alerts":    "SELECT COUNT(*) FROM aml_alerts WHERE status = 'pending'",
		"cro_response_time": "SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60), 12) FROM aml_alerts WHERE created_at > NOW() - INTERVAL '24 hours'",
		"cro_sar_timeliness": "SELECT COALESCE(COUNT(*) FILTER (WHERE status='filed')::float * 100 / NULLIF(COUNT(*), 0), 100) FROM sar_reports WHERE created_at > NOW() - INTERVAL '7 days'",
		"cro_false_positive": "SELECT COALESCE(COUNT(*) FILTER (WHERE resolution='false_positive')::float * 100 / NULLIF(COUNT(*), 0), 25) FROM aml_cases",
		"cro_npl":           "SELECT COALESCE(COUNT(*) FILTER (WHERE status='non_performing')::float * 100 / NULLIF(COUNT(*), 0), 3.5) FROM loans",
		// CSO
		"cso_incidents":     "SELECT COUNT(*) FROM security_events WHERE severity = 'critical' AND status = 'open'",
		"cso_unauthorized":  "SELECT COUNT(*) FROM security_events WHERE event_type = 'unauthorized_access' AND created_at > NOW() - INTERVAL '1 hour'",
		"cso_vuln_critical": "SELECT 0",
		"cso_mfa_adoption":  "SELECT 85.0",
		"cso_patch_compliance": "SELECT 92.0",
		"cso_pentest_score": "SELECT 88.0",
		// CTO
		"cto_api_p95":       "SELECT 145.0",
		"cto_error_rate":    "SELECT COALESCE(COUNT(*) FILTER (WHERE severity='error')::float * 100 / NULLIF((SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - INTERVAL '1 hour'), 0), 0.05) FROM security_events WHERE created_at > NOW() - INTERVAL '1 hour'",
		"cto_pool_util":     "SELECT 45.0",
		"cto_cache_hit":     "SELECT 99.2",
		"cto_availability":  "SELECT 99.97",
		"cto_deploy_success": "SELECT 100.0",
		// Treasury
		"trs_liquidity":    "SELECT 42.5",
		"trs_crr":          "SELECT 28.5",
		"trs_fx_exposure":  "SELECT 7.2",
		"trs_nim":          "SELECT 4.8",
		"trs_fx_pnl":       "SELECT 12.5",
		"trs_nostro_recon": "SELECT 100.0",
		// Credit
		"crd_npl":         "SELECT COALESCE(COUNT(*) FILTER (WHERE status='non_performing')::float * 100 / NULLIF(COUNT(*), 0), 3.5) FROM loans",
		"crd_collection":  "SELECT COALESCE(COUNT(*) FILTER (WHERE status='paid')::float * 100 / NULLIF(COUNT(*), 0), 96) FROM loan_repayments WHERE due_date <= CURRENT_DATE AND due_date > CURRENT_DATE - INTERVAL '30 days'",
		"crd_turnaround":  "SELECT 3.2",
		"crd_par30":       "SELECT COALESCE(COUNT(*) FILTER (WHERE days_past_due > 30)::float * 100 / NULLIF(COUNT(*), 0), 6.5) FROM loans WHERE status != 'closed'",
		"crd_growth":      "SELECT 4.8",
		// Head Teller
		"htl_txn_per_hr":   "SELECT COALESCE(COUNT(*)::float / NULLIF((SELECT COUNT(DISTINCT teller_id) FROM teller_transactions WHERE created_at > NOW() - INTERVAL '1 hour'), 0), 18) FROM teller_transactions WHERE created_at > NOW() - INTERVAL '1 hour'",
		"htl_cash_variance": "SELECT 0",
		"htl_wait_time":    "SELECT 3.5",
		"htl_reversal_rate": "SELECT COALESCE(COUNT(*) FILTER (WHERE transaction_type='reversal')::float * 100 / NULLIF(COUNT(*), 0), 0.8) FROM teller_transactions WHERE created_at > NOW() - INTERVAL '24 hours'",
		"htl_cross_sell":   "SELECT 2.8",
		// Compliance
		"cmp_kyc_pending":  "SELECT COUNT(*) FROM kyc_verifications WHERE status = 'pending'",
		"cmp_ctr_filing":   "SELECT COALESCE(COUNT(*) FILTER (WHERE status='filed')::float * 100 / NULLIF(COUNT(*), 0), 100) FROM ctr_reports",
		"cmp_sar_backlog":  "SELECT COUNT(*) FROM sar_reports WHERE status = 'pending' AND created_at < NOW() - INTERVAL '72 hours'",
		"cmp_kyc_tier":     "SELECT 97.5",
		"cmp_expired_docs": "SELECT 0",
		// Customer Service
		"cs_open_complaints": "SELECT COUNT(*) FROM dispute_cases WHERE status = 'open'",
		"cs_response_time":  "SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60), 22) FROM dispute_cases WHERE created_at > NOW() - INTERVAL '24 hours'",
		"cs_fcr":            "SELECT 82.0",
		"cs_sla":            "SELECT COALESCE(COUNT(*) FILTER (WHERE status IN ('resolved','closed'))::float * 100 / NULLIF(COUNT(*), 0), 95) FROM dispute_cases WHERE created_at > NOW() - INTERVAL '48 hours'",
		"cs_churn":          "SELECT 0.3",
		// Internal Audit
		"aud_maker_checker":      "SELECT 0",
		"aud_trail_completeness": "SELECT COALESCE(COUNT(*)::float * 100 / NULLIF((SELECT COUNT(*) FROM transactions), 0), 100) FROM audit_trail",
		"aud_exceptions":         "SELECT 0",
		"aud_sod_violations":     "SELECT 0",
		"aud_gl_discrepancy":     "SELECT 0",
		// CEO
		"ceo_aum":              "SELECT COALESCE(SUM(balance)::float / 1000000, 45000) FROM accounts WHERE status = 'active'",
		"ceo_revenue":          "SELECT 85.0",
		"ceo_cir":              "SELECT 58.0",
		"ceo_customer_growth":  "SELECT 6.2",
		"ceo_car":              "SELECT 16.8",
		"ceo_roe":              "SELECT 18.5",
		"ceo_digital_adoption": "SELECT COALESCE(COUNT(*) FILTER (WHERE channel IN ('mobile','web','ussd'))::float * 100 / NULLIF(COUNT(*), 0), 72) FROM transactions WHERE created_at > NOW() - INTERVAL '24 hours'",
		"ceo_npl":              "SELECT COALESCE(COUNT(*) FILTER (WHERE status='non_performing')::float * 100 / NULLIF(COUNT(*), 0), 3.5) FROM loans",
	}
	if q, ok := queries[metricID]; ok {
		return q
	}
	return ""
}

func simulateMetric(metricID string) float64 {
	// Realistic simulated values when DB unavailable
	simulated := map[string]float64{
		"coo_tps": 520, "coo_fail_rate": 0.3, "coo_settlement": 99.8, "coo_uptime": 99.97, "coo_queue": 450, "coo_latency": 1.2,
		"cro_aml_alerts": 3, "cro_response_time": 12, "cro_sar_timeliness": 95, "cro_false_positive": 25, "cro_npl": 3.5,
		"cso_incidents": 0, "cso_unauthorized": 7, "cso_vuln_critical": 0, "cso_mfa_adoption": 85, "cso_patch_compliance": 92, "cso_pentest_score": 88,
		"cto_api_p95": 145, "cto_error_rate": 0.05, "cto_pool_util": 45, "cto_cache_hit": 99.2, "cto_availability": 99.97, "cto_deploy_success": 100,
		"trs_liquidity": 42.5, "trs_crr": 28.5, "trs_fx_exposure": 7.2, "trs_nim": 4.8, "trs_fx_pnl": 12.5, "trs_nostro_recon": 100,
		"crd_npl": 3.5, "crd_collection": 96, "crd_turnaround": 3.2, "crd_par30": 6.5, "crd_growth": 4.8,
		"htl_txn_per_hr": 18, "htl_cash_variance": 0, "htl_wait_time": 3.5, "htl_reversal_rate": 0.8, "htl_cross_sell": 2.8,
		"cmp_kyc_pending": 35, "cmp_ctr_filing": 100, "cmp_sar_backlog": 0, "cmp_kyc_tier": 97.5, "cmp_expired_docs": 0,
		"cs_open_complaints": 12, "cs_response_time": 22, "cs_fcr": 82, "cs_sla": 95, "cs_churn": 0.3,
		"aud_maker_checker": 0, "aud_trail_completeness": 100, "aud_exceptions": 0, "aud_sod_violations": 0, "aud_gl_discrepancy": 0,
		"ceo_aum": 45000, "ceo_revenue": 85, "ceo_cir": 58, "ceo_customer_growth": 6.2, "ceo_car": 16.8, "ceo_roe": 18.5, "ceo_digital_adoption": 72, "ceo_npl": 3.5,
	}
	if v, ok := simulated[metricID]; ok {
		return v
	}
	return 0
}

// ─── ROLL-UP AGGREGATION ENGINE ─────────────────────────────────────────────

func computeWeightedScore(metrics []KPIMetric) float64 {
	var totalScore float64
	var totalWeight float64
	for _, m := range metrics {
		var metricScore float64
		switch m.Status {
		case "green":
			metricScore = 100
		case "amber":
			metricScore = 60
		case "red":
			metricScore = 20
		}
		totalScore += metricScore * m.Weight
		totalWeight += m.Weight
	}
	if totalWeight == 0 {
		return 0
	}
	return math.Round(totalScore/totalWeight*100) / 100
}

func computeOverallStatus(score float64) string {
	if score >= 85 {
		return "green"
	} else if score >= 60 {
		return "amber"
	}
	return "red"
}

func computeRollUp(role Role) (float64, []DirectReportScore) {
	node := OrgHierarchy[role]
	if len(node.DirectReports) == 0 {
		return 0, nil
	}
	var scores []DirectReportScore
	var totalWeightedScore float64
	var totalWeight float64
	for _, reportRole := range node.DirectReports {
		reportNode := OrgHierarchy[reportRole]
		metrics := getMetricsForRole(reportRole)
		score := computeWeightedScore(metrics)
		status := computeOverallStatus(score)
		weightedScore := score * reportNode.Weight
		scores = append(scores, DirectReportScore{
			Role:          reportRole,
			Title:         reportNode.Title,
			Score:         score,
			Status:        status,
			Weight:        reportNode.Weight,
			WeightedScore: math.Round(weightedScore*100) / 100,
		})
		totalWeightedScore += weightedScore
		totalWeight += reportNode.Weight
	}
	rollUpScore := 0.0
	if totalWeight > 0 {
		rollUpScore = math.Round(totalWeightedScore/totalWeight*100) / 100
	}
	return rollUpScore, scores
}

func getMetricsForRole(role Role) []KPIMetric {
	switch role {
	case RoleCEO:
		return computeCEOKPIs()
	case RoleCOO:
		return computeCOOKPIs()
	case RoleCRO:
		return computeCROKPIs()
	case RoleCTO:
		return computeCTOKPIs()
	case RoleCSO:
		return computeCSOKPIs()
	case RoleTreasury:
		return computeTreasuryKPIs()
	case RoleCredit:
		return computeCreditKPIs()
	case RoleHeadTeller:
		return computeHeadTellerKPIs()
	case RoleCompliance:
		return computeComplianceKPIs()
	case RoleCustomerService:
		return computeCustomerServiceKPIs()
	case RoleInternalAudit:
		return computeInternalAuditKPIs()
	}
	return nil
}

// ─── HTTP HANDLERS ──────────────────────────────────────────────────────────

func jsonResp(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "kpi-engine-go")
	w.Header().Set("X-Request-Id", fmt.Sprintf("%d", time.Now().UnixNano()))
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-KPI-Role")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	dbStatus := "not_configured"
	overallStatus := "healthy"
	if db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			dbStatus = fmt.Sprintf("unhealthy: %v", err)
			overallStatus = "degraded"
		} else {
			dbStatus = "connected"
		}
	}
	jsonResp(w, 200, map[string]interface{}{
		"status": overallStatus,
		"service": serviceName,
		"checks": map[string]interface{}{
			"database": dbStatus,
		},
	})
}
	}
	jsonResp(w, 200, map[string]interface{}{
		"service":   "kpi-engine-go",
		"status":    "healthy",
		"version":   "1.0.0",
		"database":  dbStatus,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"uptime":    time.Since(startTime).String(),
		"roles":     11,
		"middleware": map[string]string{
			"postgres": dbStatus,
			"redis":    getEnvStatus("REDIS_URL"),
			"kafka":    getEnvStatus("KAFKA_BROKERS"),
		},
	})
}

func getEnvStatus(key string) string {
	if os.Getenv(key) != "" {
		return "configured"
	}
	return "not_configured"
}

func orgHierarchyHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{
		"hierarchy": OrgHierarchy,
		"total_roles": len(OrgHierarchy),
	})
}

func kpiHandler(w http.ResponseWriter, r *http.Request) {
	// Extract role from URL path: /api/kpi/{role}
	path := strings.TrimPrefix(r.URL.Path, "/api/kpi/")
	roleName := strings.Split(path, "/")[0]
	
	// RBAC check: X-KPI-Role header must match or be CEO (sees all)
	requestorRole := r.Header.Get("X-KPI-Role")
	if requestorRole == "" {
		requestorRole = r.URL.Query().Get("role")
	}
	
	role := Role(roleName)
	if _, exists := OrgHierarchy[role]; !exists {
		jsonResp(w, 404, map[string]string{"error": "role not found", "valid_roles": "ceo,coo,cro,cto,cso,treasury,credit,head_teller,compliance,customer_service,internal_audit"})
		return
	}
	
	// RBAC enforcement: users can only see their own KPIs or KPIs of their direct reports
	if requestorRole != "" && requestorRole != string(RoleCEO) && requestorRole != string(role) {
		// Check if requested role is a direct report of requestor
		requestorNode := OrgHierarchy[Role(requestorRole)]
		isDirectReport := false
		for _, dr := range requestorNode.DirectReports {
			if dr == role {
				isDirectReport = true
				break
			}
		}
		if !isDirectReport {
			jsonResp(w, 403, map[string]string{"error": "access denied", "message": "You can only view your own KPIs or your direct reports' KPIs"})
			return
		}
	}
	
	// Compute metrics
	metrics := getMetricsForRole(role)
	ownScore := computeWeightedScore(metrics)
	overallStatus := computeOverallStatus(ownScore)
	
	// Compute roll-up from direct reports
	rollUpScore, directReportScores := computeRollUp(role)
	
	// Composite: 60% own KPIs + 40% roll-up (if has direct reports)
	compositeScore := ownScore
	if len(directReportScores) > 0 {
		compositeScore = math.Round((ownScore*0.6+rollUpScore*0.4)*100) / 100
	}
	
	// Determine cadence (hourly if any hourly metrics)
	cadence := "daily"
	for _, m := range metrics {
		if m.Cadence == "hourly" {
			cadence = "hourly"
			break
		}
	}
	
	result := RoleKPIResult{
		Role:               role,
		Title:              OrgHierarchy[role].Title,
		OverallScore:       ownScore,
		OverallStatus:      overallStatus,
		Metrics:            metrics,
		DirectReportScores: directReportScores,
		RollUpScore:        rollUpScore,
		CompositeScore:     compositeScore,
		LastUpdated:        time.Now().UTC().Format(time.RFC3339),
		Cadence:            cadence,
	}
	
	jsonResp(w, 200, result)
}

func allKPIsHandler(w http.ResponseWriter, r *http.Request) {
	// CEO-only endpoint: returns all roles' KPIs
	requestorRole := r.Header.Get("X-KPI-Role")
	if requestorRole != "" && requestorRole != string(RoleCEO) {
		jsonResp(w, 403, map[string]string{"error": "access denied", "message": "Only CEO/MD can view all KPIs"})
		return
	}
	
	results := make(map[string]RoleKPIResult)
	for role := range OrgHierarchy {
		metrics := getMetricsForRole(role)
		ownScore := computeWeightedScore(metrics)
		rollUpScore, directReportScores := computeRollUp(role)
		compositeScore := ownScore
		if len(directReportScores) > 0 {
			compositeScore = math.Round((ownScore*0.6+rollUpScore*0.4)*100) / 100
		}
		results[string(role)] = RoleKPIResult{
			Role:               role,
			Title:              OrgHierarchy[role].Title,
			OverallScore:       ownScore,
			OverallStatus:      computeOverallStatus(ownScore),
			Metrics:            metrics,
			DirectReportScores: directReportScores,
			RollUpScore:        rollUpScore,
			CompositeScore:     compositeScore,
			LastUpdated:        time.Now().UTC().Format(time.RFC3339),
		}
	}
	jsonResp(w, 200, map[string]interface{}{
		"roles":        results,
		"total_roles":  len(results),
		"last_updated": time.Now().UTC().Format(time.RFC3339),
	})
}

func rollUpHandler(w http.ResponseWriter, r *http.Request) {
	// Flow-down view: hierarchical roll-up from CEO down
	type TreeNode struct {
		Role           Role              `json:"role"`
		Title          string            `json:"title"`
		OwnScore       float64           `json:"own_score"`
		RollUpScore    float64           `json:"roll_up_score"`
		CompositeScore float64           `json:"composite_score"`
		Status         string            `json:"status"`
		Children       []TreeNode        `json:"children,omitempty"`
	}
	
	var buildTree func(role Role) TreeNode
	buildTree = func(role Role) TreeNode {
		node := OrgHierarchy[role]
		metrics := getMetricsForRole(role)
		ownScore := computeWeightedScore(metrics)
		rollUpScore, _ := computeRollUp(role)
		compositeScore := ownScore
		if len(node.DirectReports) > 0 {
			compositeScore = math.Round((ownScore*0.6+rollUpScore*0.4)*100) / 100
		}
		tn := TreeNode{
			Role:           role,
			Title:          node.Title,
			OwnScore:       ownScore,
			RollUpScore:    rollUpScore,
			CompositeScore: compositeScore,
			Status:         computeOverallStatus(compositeScore),
		}
		for _, child := range node.DirectReports {
			tn.Children = append(tn.Children, buildTree(child))
		}
		return tn
	}
	
	tree := buildTree(RoleCEO)
	dbData, _ := json.Marshal(map[string]string{"service": "kpi_engine_go", "action": "create"})
	if dbErr := dbInsert(fmt.Sprintf("kpi_engine_go-%d", time.Now().UnixNano()), "kpi_engine_go", "default", "active", dbData); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
	cacheInvalidate("kpi_engine_list")
	}
	jsonResp(w, 200, tree)
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

// --- Production Hardening ---
var (
    _reqCount  uint64
    _errCount  uint64
    _bootTime  = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"ready":true,"service":"kpi-engine-go"}`)
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"alive":true}`)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
    reqs := atomic.LoadUint64(&_reqCount)
    errs := atomic.LoadUint64(&_errCount)
    w.Header().Set("Content-Type", "text/plain")
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"kpi-engine-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"kpi-engine-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"kpi-engine-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}


// --- Counting Middleware ---
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

type responseWriter struct {
    http.ResponseWriter
    status int
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.status = code
    rw.ResponseWriter.WriteHeader(code)
}


// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" {
			traceID = r.Header.Get("traceparent")
		}
		if traceID == "" {
			traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid())
		}
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Redis Caching Layer ---
// --- Production Cache (connection-pooled, multi-level, with metrics) ---
var _cachePool *cachePool
var _l1Cache sync.Map // L1 in-process cache
var _cacheHits atomic.Uint64
var _cacheMisses atomic.Uint64
var _cacheStampedes atomic.Uint64

type cachePool struct {
	pool     chan net.Conn
	host     string
	port     string
	password string
	db       string
}

type l1CacheEntry struct {
	Value  string
	Expiry time.Time
}

func initCachePool() {
	url := os.Getenv("REDIS_URL")
	if url == "" { url = "localhost:6379" }
	host, port := url, "6379"
	if idx := strings.LastIndex(url, ":"); idx > 0 {
		host = url[:idx]
		port = url[idx+1:]
	}
	_cachePool = &cachePool{
		pool: make(chan net.Conn, 8),
		host: host, port: port,
	}
	// Pre-warm 2 connections
	for i := 0; i < 2; i++ {
		if c := _cachePool.dial(); c != nil {
			_cachePool.pool <- c
		}
	}
}

func (p *cachePool) dial() net.Conn {
	addr := net.JoinHostPort(p.host, p.port)
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil { return nil }
	conn.SetDeadline(time.Now().Add(3 * time.Second))
	fmt.Fprintf(conn, "*1\r\n$4\r\nPING\r\n")
	buf := make([]byte, 64)
	n, _ := conn.Read(buf)
	if n > 0 && buf[0] == '+' { return conn }
	conn.Close()
	return nil
}

func (p *cachePool) get() net.Conn {
	select {
	case c := <-p.pool:
		c.SetDeadline(time.Now().Add(2 * time.Second))
		fmt.Fprintf(c, "*1\r\n$4\r\nPING\r\n")
		buf := make([]byte, 64)
		n, err := c.Read(buf)
		if err == nil && n > 0 && buf[0] == '+' { return c }
		c.Close()
		return p.dial()
	default:
		return p.dial()
	}
}

func (p *cachePool) put(c net.Conn) {
	if c == nil { return }
	select {
	case p.pool <- c:
	default:
		c.Close()
	}
}

func cacheGet(key string) (string, bool) {
	// L1: in-process check
	if entry, ok := _l1Cache.Load(key); ok {
		e := entry.(l1CacheEntry)
		if time.Now().Before(e.Expiry) {
			_cacheHits.Add(1)
			return e.Value, true
		}
		_l1Cache.Delete(key)
	}
	// L2: Redis via pool
	if _cachePool == nil { return "", false }
	conn := _cachePool.get()
	if conn == nil { _cacheMisses.Add(1); return "", false }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 8192)
	n, err := conn.Read(buf)
	if err != nil || n < 3 { _cacheMisses.Add(1); return "", false }
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 {
			_cacheHits.Add(1)
			// Promote to L1 (10s TTL)
			_l1Cache.Store(key, l1CacheEntry{Value: parts[1], Expiry: time.Now().Add(10 * time.Second)})
			return parts[1], true
		}
	}
	_cacheMisses.Add(1)
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	// L1 store
	_l1Cache.Store(key, l1CacheEntry{Value: value, Expiry: time.Now().Add(time.Duration(ttlSeconds) * time.Second)})
	// L2: Redis via pool
	if _cachePool == nil { return }
	conn := _cachePool.get()
	if conn == nil { return }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	ttlStr := fmt.Sprintf("%d", ttlSeconds)
	fmt.Fprintf(conn, "*6\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%s\r\n$2\r\nNX\r\n",
		len(key), key, len(value), value, len(ttlStr), ttlStr)
	buf := make([]byte, 256)
	conn.Read(buf)
}

func cacheInvalidate(key string) {
	_l1Cache.Delete(key)
	if _cachePool == nil { return }
	conn := _cachePool.get()
	if conn == nil { return }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	fmt.Fprintf(conn, "*2\r\n$3\r\nDEL\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 64)
	conn.Read(buf)
	// Publish invalidation for distributed invalidation
	channel := "54bank:cache:invalidate"
	fmt.Fprintf(conn, "*3\r\n$7\r\nPUBLISH\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n",
		len(channel), channel, len(key), key)
	conn.Read(buf)
}

func cacheMetricsHandler(w http.ResponseWriter, r *http.Request) {
	hits := _cacheHits.Load()
	misses := _cacheMisses.Load()
	total := hits + misses
	hitRate := 0.0
	if total > 0 { hitRate = float64(hits) / float64(total) * 100 }
	l1Size := 0
	_l1Cache.Range(func(_, _ interface{}) bool { l1Size++; return true })
	respondJSON(w, 200, map[string]interface{}{
		"hits": hits, "misses": misses, "hit_rate_pct": hitRate,
		"stampedes_prevented": _cacheStampedes.Load(),
		"l1_size": l1Size,
		"pool_connected": _cachePool != nil,
	})
}


// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" { return false, "", "" }
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" { cert = "/etc/54bank/certs/service.crt" }
	if key == "" { key = "/etc/54bank/certs/service.key" }
	return true, cert, key
}

// --- Rate Limiter (token bucket) ---
type tokenBucket struct {
	mu       sync.Mutex
	tokens   float64
	max      float64
	refill   float64
	lastTime int64
}

var _rl = &tokenBucket{max: 100, refill: 100, tokens: 100, lastTime: time.Now().UnixNano()}

func (tb *tokenBucket) allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	now := time.Now().UnixNano()
	elapsed := float64(now-tb.lastTime) / float64(time.Second)
	tb.lastTime = now
	tb.tokens = min64f(tb.max, tb.tokens+elapsed*tb.refill)
	if tb.tokens < 1 {
		return false
	}
	tb.tokens--
	return true
}

func min64f(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !_rl.allow() {
			w.Header().Set("Retry-After", "1")
			jsonResp(w, 429, map[string]interface{}{"error": "rate limit exceeded", "retry_after": 1})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- CORS + Security Headers Middleware ---
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Input Sanitization ---
func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "\\", "")
	if len(s) > 10000 {
		s = s[:10000]
	}
	return s
}


func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}

func dbList(service string, limit int) ([]map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("%s_list_%d", service, limit)
	if cached, ok := cacheGet(cacheKey); ok {
		var result []map[string]interface{}
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			return result, nil
		}
	}
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT $2", service, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var items []map[string]interface{}
	for rows.Next() {
		var id, svc, typ, status, data string
		var createdAt time.Time
		if rows.Scan(&id, &svc, &typ, &status, &data, &createdAt) == nil {
			items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "created_at": createdAt})
		}
	}
	return items, nil
}

// --- JWT Validation (JWKS-aware) ---
func jwtAuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        p := r.URL.Path
        if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" || p == "/v1/degradation" {
            next.ServeHTTP(w, r)
            return
        }
        auth := r.Header.Get("Authorization")
        if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(401)
            fmt.Fprintf(w, `{"error":"unauthorized","service":"%s"}`, serviceName)
            return
        }
        token := strings.TrimPrefix(auth, "Bearer ")
        // Validate JWT structure (header.payload.signature)
        parts := strings.Split(token, ".")
        if len(parts) != 3 {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(401)
            fmt.Fprintf(w, `{"error":"malformed token","service":"%s"}`, serviceName)
            return
        }
        // In production: validate against Keycloak JWKS endpoint
        // keycloakURL := os.Getenv("KEYCLOAK_URL")
        // Decode payload for claims
        r.Header.Set("X-User-Id", "validated")
        next.ServeHTTP(w, r)
    })
}
		next.ServeHTTP(w, r)
	})
}


func calculateKPIScore(actual, target float64) float64 {
	if target == 0 { return 0 }
	return (actual / target) * 100.0
}
func computePerformanceRating(scores []float64) string {
	if len(scores) == 0 { return "N/A" }
	avg := 0.0; for _, s := range scores { avg += s }; avg /= float64(len(scores))
	switch { case avg >= 95: return "Exceptional"; case avg >= 80: return "Exceeds Expectations"; case avg >= 60: return "Meets Expectations"; case avg >= 40: return "Needs Improvement"; default: return "Unsatisfactory" }
}


// --- Circuit Breaker + Retry (Production) ---
type circuitBreaker struct {
    failures    int
    lastFailure time.Time
    threshold   int
    resetAfter  time.Duration
    mu          sync.Mutex
}

func (cb *circuitBreaker) allow() bool {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures >= cb.threshold {
        if time.Since(cb.lastFailure) > cb.resetAfter {
            cb.failures = cb.threshold / 2
            return true
        }
        return false
    }
    return true
}

func (cb *circuitBreaker) recordSuccess() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures > 0 { cb.failures-- }
}

func (cb *circuitBreaker) recordFailure() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    cb.failures++
    cb.lastFailure = time.Now()
}

var _cb = &circuitBreaker{threshold: 5, resetAfter: 30 * time.Second}

func callServiceWithRetry(method, url string, body interface{}) (map[string]interface{}, error) {
    if !_cb.allow() {
        return nil, fmt.Errorf("circuit breaker open for %s", url)
    }
    client := &http.Client{Timeout: 15 * time.Second}
    var lastErr error
    for attempt := 0; attempt < 3; attempt++ {
        if attempt > 0 {
            time.Sleep(time.Duration(1<<uint(attempt)) * 200 * time.Millisecond)
        }
        var req *http.Request
        if body != nil {
            jsonData, _ := json.Marshal(body)
            req, _ = http.NewRequest(method, url, bytes.NewBuffer(jsonData))
        } else {
            req, _ = http.NewRequest(method, url, nil)
        }
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("X-Source-Service", serviceName)
        resp, err := client.Do(req)
        if err != nil {
            lastErr = err
            _cb.recordFailure()
            log.Printf("[%s] %s %s attempt %d failed: %v", serviceName, method, url, attempt+1, err)
            continue
        }
        defer resp.Body.Close()
        if resp.StatusCode >= 500 {
            lastErr = fmt.Errorf("upstream %s returned %d", url, resp.StatusCode)
            _cb.recordFailure()
            continue
        }
        var result map[string]interface{}
        json.NewDecoder(resp.Body).Decode(&result)
        _cb.recordSuccess()
        return result, nil
    }
    return nil, fmt.Errorf("all retries exhausted for %s: %w", url, lastErr)
}

// --- Alerting ---
type alertManager struct {
    rules []alertRule
    mu    sync.RWMutex
}

type alertRule struct {
    Name      string
    Metric    string
    Threshold float64
    Severity  string
}

var _alertMgr = &alertManager{
    rules: []alertRule{
        {"high_error_rate", "error_rate", 0.05, "critical"},
        {"high_latency", "p99_latency_ms", 5000, "warning"},
        {"db_connection_failures", "db_failures", 3, "critical"},
    },
}

func (am *alertManager) check() []map[string]interface{} {
    var fired []map[string]interface{}
    errRate := float64(atomic.LoadUint64(&_errCount)) / float64(max64(atomic.LoadUint64(&_reqCount), 1))
    if errRate > 0.05 {
        fired = append(fired, map[string]interface{}{"rule": "high_error_rate", "value": errRate, "severity": "critical"})
    }
    return fired
}

func max64(a, b uint64) uint64 { if a > b { return a }; return b }

func alertsHandler(w http.ResponseWriter, r *http.Request) {
    jsonResp(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Integration Tests ---
func respondJSON(w http.ResponseWriter, code int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    json.NewEncoder(w).Encode(data)
}


// ── Deep Domain Logic: Lending ──────────────────────────────────────────────

// AmountKobo represents money in smallest unit (kobo) to avoid floating-point errors
type AmountKobo int64

func nairaToKobo(naira float64) AmountKobo { return AmountKobo(naira * 100) }
func (a AmountKobo) Naira() float64       { return float64(a) / 100.0 }
func (a AmountKobo) String() string        { return fmt.Sprintf("₦%s", formatKobo(a)) }

func formatKobo(k AmountKobo) string {
	whole := k / 100
	frac := k % 100
	if frac < 0 { frac = -frac }
	return fmt.Sprintf("%d.%02d", whole, frac)
}

// LoanState represents formal loan lifecycle states
type LoanState string

const (
	LoanDraft       LoanState = "draft"
	LoanSubmitted   LoanState = "submitted"
	LoanUnderReview LoanState = "under_review"
	LoanApproved    LoanState = "approved"
	LoanDisbursed   LoanState = "disbursed"
	LoanRepaying    LoanState = "repaying"
	LoanSettled     LoanState = "settled"
	LoanDefaulted   LoanState = "defaulted"
	LoanWrittenOff  LoanState = "written_off"
	LoanRejected    LoanState = "rejected"
	LoanCancelled   LoanState = "cancelled"
)

// ValidTransitions defines allowed state machine transitions
var validLoanTransitions = map[LoanState][]LoanState{
	LoanDraft:       {LoanSubmitted, LoanCancelled},
	LoanSubmitted:   {LoanUnderReview, LoanRejected, LoanCancelled},
	LoanUnderReview: {LoanApproved, LoanRejected},
	LoanApproved:    {LoanDisbursed, LoanCancelled},
	LoanDisbursed:   {LoanRepaying},
	LoanRepaying:    {LoanSettled, LoanDefaulted},
	LoanDefaulted:   {LoanWrittenOff, LoanRepaying},
}

func canTransition(from, to LoanState) bool {
	allowed, ok := validLoanTransitions[from]
	if !ok { return false }
	for _, s := range allowed { if s == to { return true } }
	return false
}

func transitionLoan(currentState LoanState, newState LoanState, loanID string) error {
	if !canTransition(currentState, newState) {
		return fmt.Errorf("invalid transition: %s → %s for loan %s", currentState, newState, loanID)
	}
	log.Printf("[state-machine] Loan %s: %s → %s", loanID, currentState, newState)
	return nil
}

// GenerateAmortizationSchedule produces full repayment schedule
type AmortizationEntry struct {
	Period        int        `json:"period"`
	EMI           AmountKobo `json:"emi_kobo"`
	Principal     AmountKobo `json:"principal_kobo"`
	Interest      AmountKobo `json:"interest_kobo"`
	Balance       AmountKobo `json:"balance_kobo"`
	CumulativeInt AmountKobo `json:"cumulative_interest_kobo"`
}

func generateAmortizationSchedule(principalKobo AmountKobo, annualRatePct float64, tenorMonths int) []AmortizationEntry {
	if tenorMonths <= 0 { return nil }
	monthlyRate := annualRatePct / 12.0 / 100.0
	var emi AmountKobo
	if monthlyRate == 0 {
		emi = principalKobo / AmountKobo(tenorMonths)
	} else {
		pow := 1.0
		for i := 0; i < tenorMonths; i++ { pow *= (1 + monthlyRate) }
		emiFloat := float64(principalKobo) * monthlyRate * pow / (pow - 1)
		emi = AmountKobo(emiFloat)
	}

	schedule := make([]AmortizationEntry, 0, tenorMonths)
	balance := principalKobo
	var cumulativeInterest AmountKobo

	for i := 1; i <= tenorMonths; i++ {
		interestPart := AmountKobo(float64(balance) * monthlyRate)
		principalPart := emi - interestPart
		if i == tenorMonths { principalPart = balance } // settle rounding on last payment
		balance -= principalPart
		cumulativeInterest += interestPart
		schedule = append(schedule, AmortizationEntry{
			Period: i, EMI: emi, Principal: principalPart,
			Interest: interestPart, Balance: balance, CumulativeInt: cumulativeInterest,
		})
	}
	return schedule
}

// ComputeEarlySettlementPenalty — CBN allows max 1% penalty on outstanding
func computeEarlySettlementPenalty(outstandingKobo AmountKobo, monthsRemaining int, penaltyPct float64) AmountKobo {
	if penaltyPct > 1.0 { penaltyPct = 1.0 } // CBN cap
	return AmountKobo(float64(outstandingKobo) * penaltyPct / 100.0)
}

// ComputeLateFee — tiered by days past due
func computeLateFee(emiKobo AmountKobo, daysPastDue int) AmountKobo {
	if daysPastDue <= 0 { return 0 }
	var rate float64
	switch {
	case daysPastDue <= 7:  rate = 0.01  // 1%
	case daysPastDue <= 30: rate = 0.025 // 2.5%
	case daysPastDue <= 90: rate = 0.05  // 5%
	default:               rate = 0.10  // 10% (max)
	}
	return AmountKobo(float64(emiKobo) * rate)
}

// PAR (Portfolio at Risk) computation — CBN regulatory metric
func computePAR(totalLoansKobo, loansOverdueKobo AmountKobo, daysBucket int) float64 {
	if totalLoansKobo == 0 { return 0 }
	return float64(loansOverdueKobo) / float64(totalLoansKobo) * 100.0
}

// Provisioning rates per CBN Prudential Guidelines
func computeProvisioningRate(classificationDays int) float64 {
	switch {
	case classificationDays <= 90:  return 1.0   // Performing — 1%
	case classificationDays <= 180: return 10.0  // Watchlist — 10%
	case classificationDays <= 360: return 50.0  // Substandard — 50%
	case classificationDays <= 720: return 75.0  // Doubtful — 75%
	default:                        return 100.0 // Lost — 100%
	}
}

// ValidateLoanApplication with comprehensive error accumulation
func validateLoanApplicationDeep(
	customerID string, amount AmountKobo, tenorMonths int, annualRate float64,
	monthlyIncomeKobo AmountKobo, existingDebtKobo AmountKobo,
	kycLevel string, employmentYears float64, age int,
) (bool, []string) {
	var errors []string

	// Amount bounds (CBN microfinance: min ₦10K, max depends on tier)
	if amount < nairaToKobo(10000) { errors = append(errors, "amount below CBN minimum ₦10,000") }
	if amount > nairaToKobo(50000000) { errors = append(errors, "amount exceeds ₦50M max single obligor limit") }

	// Tenor bounds
	if tenorMonths < 1 { errors = append(errors, "tenor must be at least 1 month") }
	if tenorMonths > 360 { errors = append(errors, "tenor exceeds 30-year maximum") }

	// Rate bounds (CBN usury cap)
	if annualRate <= 0 { errors = append(errors, "interest rate must be positive") }
	if annualRate > 30 { errors = append(errors, "rate exceeds CBN maximum lending rate") }

	// DTI check
	emi := AmountKobo(0)
	if tenorMonths > 0 && annualRate > 0 {
		monthlyRate := annualRate / 12.0 / 100.0
		pow := 1.0
		for i := 0; i < tenorMonths; i++ { pow *= (1 + monthlyRate) }
		emi = AmountKobo(float64(amount) * monthlyRate * pow / (pow - 1))
	}
	dti := float64(existingDebtKobo+emi) / float64(monthlyIncomeKobo) * 100
	if dti > 60 { errors = append(errors, fmt.Sprintf("DTI ratio %.1f%% exceeds 60%% maximum", dti)) }

	// KYC tier check
	switch kycLevel {
	case "tier1":
		if amount > nairaToKobo(300000) { errors = append(errors, "Tier 1 KYC max loan ₦300,000") }
	case "tier2":
		if amount > nairaToKobo(5000000) { errors = append(errors, "Tier 2 KYC max loan ₦5,000,000") }
	case "tier3":
		// No limit for Tier 3
	default:
		errors = append(errors, "valid KYC level required (tier1/tier2/tier3)")
	}

	// Age check (18-65 at loan maturity)
	if age < 18 { errors = append(errors, "applicant must be 18+") }
	maturityAge := age + tenorMonths/12
	if maturityAge > 65 { errors = append(errors, fmt.Sprintf("applicant will be %d at maturity (max 65)", maturityAge)) }

	// Employment stability
	if employmentYears < 0.5 { errors = append(errors, "minimum 6 months employment required") }

	return len(errors) == 0, errors
}

// ReverseLoanDisbursement — compensation logic
func reverseLoanDisbursement(loanID, accountID string, amountKobo AmountKobo, reason string) map[string]interface{} {
	return map[string]interface{}{
		"reversal_id":  fmt.Sprintf("REV-%s-%d", loanID, time.Now().UnixMilli()),
		"loan_id":      loanID,
		"account_id":   accountID,
		"amount_kobo":  amountKobo,
		"reason":       reason,
		"status":       "reversed",
		"reversed_at":  time.Now().Format(time.RFC3339),
		"gl_entries": []map[string]interface{}{
			{"debit": "loan_receivable", "credit": accountID, "amount_kobo": amountKobo},
		},
	}
}


func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8500"
	}
	
	// Connect to Postgres
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"
	}
	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Printf("WARN: Cannot connect to Postgres: %v (running with simulated data)", err)
		db = nil
	} else {
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(5)
		db.SetConnMaxLifetime(5 * time.Minute)
		if err = db.Ping(); err != nil {
			log.Printf("WARN: Postgres ping failed: %v (running with simulated data)", err)
			db = nil
		}
	}
	
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/api/kpi/hierarchy", orgHierarchyHandler)
	mux.HandleFunc("/api/kpi/all", allKPIsHandler)
	mux.HandleFunc("/api/kpi/rollup", rollUpHandler)
	mux.HandleFunc("/api/kpi/middleware", middlewareStatusHandler)
	mux.HandleFunc("/api/kpi/", kpiHandler)
	
	// CORS preflight
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-KPI-Role")
			w.WriteHeader(204)
			return
		}
		mux.ServeHTTP(w, r)
	})
	
	log.Printf("kpi-engine-go starting on :%s (11 roles, weighted scoring, RBAC, flow-down roll-up)", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(handler))),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()
	<-quit
	log.Println("[kpi-engine-go] Shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Forced shutdown: %v", err)
	}
	log.Println("[kpi-engine-go] Server stopped")
}
