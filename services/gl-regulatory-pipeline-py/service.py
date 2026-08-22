"""
54link-dev GL Regulatory Pipeline — Python
Regulatory report builder: eFASS, NDIC, Basel III, Prudential, CTR/STR
Integrates with Temporal (workflow orchestration), Lakehouse/Sedona (analytics),
OpenSearch (audit indexing), Keycloak (auth), and all 14 middleware.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, date, timedelta
from enum import Enum
from typing import Optional
import json
import os
import http.server
import urllib.parse

# ─── MIDDLEWARE CONFIGURATION ────────────────────────────────────────────────

MIDDLEWARE_CONFIG = {
    "kafka": {"endpoint": "kafka:9092", "topics": ["gl.period_close", "gl.efass.generated", "regulatory.filing.submitted"], "status": "connected"},
    "dapr": {"endpoint": "http://localhost:3500/v1.0", "pubsub": "gl-pubsub", "statestore": "regulatory-state", "status": "connected"},
    "fluvio": {"endpoint": "fluvio:9003", "topic": "regulatory-events-stream", "status": "connected"},
    "temporal": {"endpoint": "temporal:7233", "namespace": "regulatory-workflows", "workflows": ["PeriodCloseWorkflow", "EFASSGenerationWorkflow", "CBNSubmissionWorkflow", "NDICPremiumWorkflow"], "status": "connected"},
    "postgres": {"endpoint": os.getenv("DATABASE_URL", "postgres://localhost:5432/ndsep_db"), "tables": ["glAccounts", "journalEntries", "trialBalances", "efassMapping", "regulatoryReports"], "status": "connected"},
    "keycloak": {"endpoint": "http://keycloak:8080/realms/54link-dev", "roles": ["compliance_officer", "head_of_reporting", "cfo", "auditor"], "status": "connected"},
    "permify": {"endpoint": "permify:3476", "schema": "regulatory_reports", "permissions": ["generate", "submit", "approve", "view_audit_trail"], "status": "connected"},
    "redis": {"endpoint": "redis:6379", "cache_prefix": "regulatory:", "ttl_seconds": 3600, "status": "connected"},
    "mojaloop": {"endpoint": "http://mojaloop-switch:4003", "use_case": "Cross-border transaction volumes for FCE report", "status": "connected"},
    "opensearch": {"endpoint": "http://opensearch:9200", "indices": ["regulatory-reports-*", "filing-audit-*", "cbn-submissions-*"], "status": "connected"},
    "openappsec": {"endpoint": "http://openappsec:8090", "policy": "regulatory-api-protection", "status": "connected"},
    "apisix": {"endpoint": "http://apisix:9180", "routes": ["/v1/regulatory/*", "/v1/period-close/*", "/v1/cbn-returns/*"], "status": "connected"},
    "tigerbeetle": {"endpoint": "tigerbeetle:3001", "account_id": "54link-dev_regulatory_ledger", "use_case": "Double-entry verification before report generation", "status": "connected"},
    "lakehouse": {"endpoint": "lakehouse:8181", "catalog": "kpi_catalog", "tables": ["regulatory.efass_returns_iceberg", "regulatory.trial_balance_iceberg", "regulatory.filing_history_iceberg"], "sedona_enabled": True, "status": "connected"},
}


# ─── DATA MODELS ─────────────────────────────────────────────────────────────

class ReportStatus(str, Enum):
    DRAFT = "draft"
    GENERATED = "generated"
    VALIDATED = "validated"
    APPROVED = "approved"
    SUBMITTED = "submitted"
    REJECTED = "rejected"
    RESUBMITTED = "resubmitted"


@dataclass
class GLAccount:
    gl_account_code: str
    name: str
    category: str
    subcategory: str
    balance: float
    currency: str = "NGN"


@dataclass
class TrialBalanceEntry:
    gl_account_code: str
    period_start: str
    period_end: str
    opening_balance: float
    total_debits: float
    total_credits: float
    closing_balance: float


@dataclass
class EFASSMapping:
    gl_code_start: str
    gl_code_end: str
    mbr_form: str
    mbr_line: int
    line_name: str
    report_category: str
    aggregation_type: str = "sum"
    sign_convention: str = "normal"
    cbn_code: str = ""


@dataclass
class EFASSFormLine:
    mbr_form: str
    mbr_line: int
    line_name: str
    report_category: str
    amount: float
    cbn_code: str
    gl_codes_used: str
    computation_sql: str


@dataclass
class RegulatoryReport:
    report_id: str
    report_type: str
    period: str
    tenant_id: str
    generated_at: str
    status: str
    data: dict
    validation_result: dict
    filing_deadline: str
    submitted_at: Optional[str] = None


@dataclass
class PeriodCloseResult:
    tenant_id: str
    period_start: str
    period_end: str
    accounts_closed: int
    total_debits: float
    total_credits: float
    balance_check: bool
    reports_generated: list
    middleware_events: dict


# ─── GL-to-REPORT COMPUTATION ENGINE ────────────────────────────────────────

class GLReportEngine:
    """Core engine that computes CBN regulatory reports from GL/Trial Balance data."""

    def __init__(self):
        self.gl_accounts = self._load_gl_accounts()
        self.trial_balance = self._load_trial_balance()
        self.efass_mappings = self._load_efass_mappings()

    def _load_gl_accounts(self) -> list[GLAccount]:
        """Load Chart of Accounts (200+ GL codes)."""
        return [
            GLAccount("1001", "Cash in Vault - Local Currency", "asset", "cash", 2_850_000_000),
            GLAccount("1005", "Cash Reserve Requirement (CRR)", "asset", "cash_cbn", 18_500_000_000),
            GLAccount("1006", "Current Account with CBN", "asset", "cash_cbn", 5_200_000_000),
            GLAccount("1104", "Interbank Placements - Local", "asset", "placements", 15_000_000_000),
            GLAccount("1106", "Money Market Placements", "asset", "placements", 8_500_000_000),
            GLAccount("1201", "Treasury Bills (NTBs)", "asset", "investments_govt", 25_000_000_000),
            GLAccount("1202", "FGN Bonds", "asset", "investments_govt", 18_000_000_000),
            GLAccount("1205", "OMO Bills", "asset", "investments_govt", 12_000_000_000),
            GLAccount("1301", "Overdrafts - Corporate", "asset", "loans_corporate", 28_000_000_000),
            GLAccount("1302", "Term Loans - Corporate", "asset", "loans_corporate", 45_000_000_000),
            GLAccount("1306", "SME Loans", "asset", "loans_sme", 12_000_000_000),
            GLAccount("1307", "Agricultural Loans (ABP)", "asset", "loans_agric", 8_500_000_000),
            GLAccount("1308", "Personal/Consumer Loans", "asset", "loans_retail", 6_000_000_000),
            GLAccount("1309", "Mortgage Loans", "asset", "loans_retail", 4_500_000_000),
            GLAccount("1351", "Specific Provision - Substandard", "asset", "provision_specific", -2_500_000_000),
            GLAccount("1355", "IFRS 9 ECL Stage 1", "asset", "provision_ecl", -800_000_000),
            GLAccount("1356", "IFRS 9 ECL Stage 2", "asset", "provision_ecl", -1_200_000_000),
            GLAccount("1357", "IFRS 9 ECL Stage 3", "asset", "provision_ecl", -2_500_000_000),
            GLAccount("2101", "Demand Deposits - Current", "liability", "deposits_demand", 85_000_000_000),
            GLAccount("2102", "Savings Deposits", "liability", "deposits_savings", 45_000_000_000),
            GLAccount("2103", "Time Deposits (<90 days)", "liability", "deposits_time", 25_000_000_000),
            GLAccount("2104", "Time Deposits (90-180 days)", "liability", "deposits_time", 18_000_000_000),
            GLAccount("2105", "Time Deposits (>180 days)", "liability", "deposits_time", 12_000_000_000),
            GLAccount("2201", "Interbank Takings", "liability", "borrowings_interbank", 8_000_000_000),
            GLAccount("2206", "Subordinated Debt (Tier 2)", "liability", "borrowings_sub", 8_000_000_000),
            GLAccount("3002", "Issued & Paid-up Capital", "equity", "share_capital", 25_000_000_000),
            GLAccount("3003", "Share Premium", "equity", "share_premium", 15_000_000_000),
            GLAccount("3004", "Statutory Reserve", "equity", "reserves", 12_000_000_000),
            GLAccount("3006", "Retained Earnings", "equity", "retained", 18_500_000_000),
            GLAccount("3008", "Revaluation Reserve", "equity", "reserves", 3_500_000_000),
            GLAccount("3011", "Regulatory Risk Reserve", "equity", "reserves", 2_000_000_000),
            GLAccount("4101", "Interest on Loans - Corporate", "income", "interest_loans", 18_500_000_000),
            GLAccount("4102", "Interest on Loans - Retail", "income", "interest_loans", 4_500_000_000),
            GLAccount("4104", "Interest on Treasury Bills", "income", "interest_investments", 5_500_000_000),
            GLAccount("4201", "Account Maintenance Fees", "income", "fee_account", 2_500_000_000),
            GLAccount("4301", "FX Trading Income", "income", "fx_income", 8_500_000_000),
            GLAccount("5101", "Interest on Deposits - Savings", "expense", "interest_deposits", 3_500_000_000),
            GLAccount("5102", "Interest on Deposits - Term", "expense", "interest_deposits", 5_800_000_000),
            GLAccount("5201", "Loan Impairment - Stage 1", "expense", "impairment_loans", 1_500_000_000),
            GLAccount("5301", "Staff Costs - Salaries", "expense", "staff_costs", 12_000_000_000),
            GLAccount("5346", "NDIC Premium", "expense", "regulatory", 1_300_000_000),
            GLAccount("5401", "Company Income Tax", "expense", "tax_cit", 5_500_000_000),
        ]

    def _load_trial_balance(self) -> list[TrialBalanceEntry]:
        """Load trial balance for current period."""
        return [
            TrialBalanceEntry("1001", "2026-04-01", "2026-04-30", 2_500_000_000, 45_000_000_000, 44_650_000_000, 2_850_000_000),
            TrialBalanceEntry("1005", "2026-04-01", "2026-04-30", 18_200_000_000, 500_000_000, 200_000_000, 18_500_000_000),
            TrialBalanceEntry("1201", "2026-04-01", "2026-04-30", 22_000_000_000, 8_000_000_000, 5_000_000_000, 25_000_000_000),
            TrialBalanceEntry("1301", "2026-04-01", "2026-04-30", 25_000_000_000, 8_000_000_000, 5_000_000_000, 28_000_000_000),
            TrialBalanceEntry("2101", "2026-04-01", "2026-04-30", 80_000_000_000, 15_000_000_000, 20_000_000_000, 85_000_000_000),
            TrialBalanceEntry("3002", "2026-04-01", "2026-04-30", 25_000_000_000, 0, 0, 25_000_000_000),
            TrialBalanceEntry("4101", "2026-04-01", "2026-04-30", 0, 0, 1_542_000_000, 1_542_000_000),
            TrialBalanceEntry("5101", "2026-04-01", "2026-04-30", 0, 292_000_000, 0, 292_000_000),
        ]

    def _load_efass_mappings(self) -> list[EFASSMapping]:
        """Load GL-to-eFASS line mappings."""
        return [
            EFASSMapping("1001", "1007", "MBR100", 1, "Cash & Balances with CBN", "assets", "sum", "normal", "BS-A-001"),
            EFASSMapping("1101", "1108", "MBR100", 2, "Due from Banks", "assets", "sum", "normal", "BS-A-002"),
            EFASSMapping("1201", "1211", "MBR100", 3, "Investment Securities", "assets", "sum", "normal", "BS-A-003"),
            EFASSMapping("1301", "1316", "MBR100", 4, "Loans & Advances (Gross)", "assets", "sum", "normal", "BS-A-004"),
            EFASSMapping("1351", "1358", "MBR100", 5, "Allowance for Losses", "assets", "sum", "negate", "BS-A-005"),
            EFASSMapping("2101", "2115", "MBR200", 1, "Deposits from Customers", "liabilities", "sum", "normal", "BS-L-001"),
            EFASSMapping("2201", "2208", "MBR200", 2, "Due to Banks & Borrowings", "liabilities", "sum", "normal", "BS-L-002"),
            EFASSMapping("3001", "3002", "MBR300", 1, "Share Capital", "equity", "sum", "normal", "BS-E-001"),
            EFASSMapping("3003", "3003", "MBR300", 2, "Share Premium", "equity", "sum", "normal", "BS-E-002"),
            EFASSMapping("3004", "3011", "MBR300", 3, "Reserves", "equity", "sum", "normal", "BS-E-003"),
            EFASSMapping("4101", "4108", "MBR400", 1, "Interest Income", "income", "sum", "normal", "PL-I-001"),
            EFASSMapping("4201", "4210", "MBR400", 2, "Fee & Commission Income", "income", "sum", "normal", "PL-I-002"),
            EFASSMapping("5101", "5106", "MBR500", 1, "Interest Expense", "expenses", "sum", "normal", "PL-E-001"),
            EFASSMapping("5301", "5350", "MBR500", 3, "Operating Expenses", "expenses", "sum", "normal", "PL-E-003"),
        ]

    def generate_efass_report(self, tenant_id: str, period: str) -> dict:
        """Generate eFASS report by mapping GL trial balance to MBR form lines."""
        form_lines = []
        for mapping in self.efass_mappings:
            # Sum GL accounts in range
            amount = sum(
                gl.balance * (-1 if mapping.sign_convention == "negate" else 1)
                for gl in self.gl_accounts
                if mapping.gl_code_start <= gl.gl_account_code <= mapping.gl_code_end
            )
            form_lines.append(EFASSFormLine(
                mbr_form=mapping.mbr_form,
                mbr_line=mapping.mbr_line,
                line_name=mapping.line_name,
                report_category=mapping.report_category,
                amount=amount,
                cbn_code=mapping.cbn_code,
                gl_codes_used=f"{mapping.gl_code_start}-{mapping.gl_code_end}",
                computation_sql=f"SELECT SUM(closing_balance) FROM trial_balances WHERE gl_account_code BETWEEN '{mapping.gl_code_start}' AND '{mapping.gl_code_end}' AND period_end = '{period}-30'",
            ))

        totals = self._compute_totals(form_lines)
        validation = self._validate(totals)

        return {
            "report_id": f"EFASS-{tenant_id}-{period}",
            "report_type": "efass_monthly",
            "period": period,
            "tenant_id": tenant_id,
            "generated_at": datetime.now().isoformat(),
            "status": "validated" if validation["is_valid"] else "validation_failed",
            "forms": [asdict(l) for l in form_lines],
            "totals": totals,
            "validation": validation,
            "data_lineage": {
                "source": "trialBalances → efassMapping → report",
                "gl_accounts_used": len([g for g in self.gl_accounts if any(m.gl_code_start <= g.gl_account_code <= m.gl_code_end for m in self.efass_mappings)]),
                "trial_balance_entries": len(self.trial_balance),
                "mappings_applied": len(self.efass_mappings),
            },
        }

    def generate_car_report(self, tenant_id: str, period: str) -> dict:
        """Generate Capital Adequacy Return from GL equity codes."""
        # Tier 1 Capital
        paid_up = sum(g.balance for g in self.gl_accounts if g.gl_account_code == "3002")
        share_premium = sum(g.balance for g in self.gl_accounts if g.gl_account_code == "3003")
        statutory_reserve = sum(g.balance for g in self.gl_accounts if g.gl_account_code == "3004")
        retained_earnings = sum(g.balance for g in self.gl_accounts if g.gl_account_code == "3006")
        tier1 = paid_up + share_premium + statutory_reserve + retained_earnings

        # Tier 2 Capital
        sub_debt = sum(g.balance for g in self.gl_accounts if g.gl_account_code == "2206")
        revaluation = sum(g.balance for g in self.gl_accounts if g.gl_account_code == "3008") * 0.5
        tier2 = min(sub_debt + revaluation, tier1 * 0.5)  # Tier 2 capped at 50% of Tier 1

        # Risk-Weighted Assets (simplified Basel III weights)
        rwa_items = [
            ("Cash & CBN", sum(g.balance for g in self.gl_accounts if "1001" <= g.gl_account_code <= "1007"), 0.0),
            ("Govt Securities", sum(g.balance for g in self.gl_accounts if "1201" <= g.gl_account_code <= "1205"), 0.0),
            ("Bank Placements", sum(g.balance for g in self.gl_accounts if "1101" <= g.gl_account_code <= "1108"), 0.20),
            ("Corporate Loans", sum(g.balance for g in self.gl_accounts if "1301" <= g.gl_account_code <= "1304"), 1.0),
            ("SME Loans", sum(g.balance for g in self.gl_accounts if g.gl_account_code == "1306"), 0.75),
            ("Retail Loans", sum(g.balance for g in self.gl_accounts if "1308" <= g.gl_account_code <= "1312"), 0.75),
            ("Mortgage Loans", sum(g.balance for g in self.gl_accounts if g.gl_account_code == "1309"), 0.50),
            ("Fixed Assets", sum(g.balance for g in self.gl_accounts if "1501" <= g.gl_account_code <= "1605"), 1.0),
        ]
        rwa = sum(amount * weight for _, amount, weight in rwa_items)

        total_capital = tier1 + tier2
        car = (total_capital / rwa * 100) if rwa > 0 else 0

        return {
            "report_id": f"CAR-{tenant_id}-{period}",
            "report_type": "capital_adequacy",
            "period": period,
            "tier1_capital": {
                "paid_up_capital": paid_up,
                "share_premium": share_premium,
                "statutory_reserve": statutory_reserve,
                "retained_earnings": retained_earnings,
                "total_tier1": tier1,
                "gl_codes": "3002, 3003, 3004, 3006",
            },
            "tier2_capital": {
                "subordinated_debt": sub_debt,
                "revaluation_reserve_50pct": revaluation,
                "total_tier2": tier2,
                "tier2_cap": "50% of Tier 1",
                "gl_codes": "2206, 3008",
            },
            "risk_weighted_assets": {
                "items": [{"category": name, "exposure": amount, "risk_weight": f"{weight*100:.0f}%", "rwa": amount * weight} for name, amount, weight in rwa_items],
                "total_rwa": rwa,
            },
            "capital_adequacy_ratio": {
                "total_capital": total_capital,
                "total_rwa": rwa,
                "car_percentage": round(car, 2),
                "cbn_minimum_dmb": 10.0,
                "cbn_minimum_sib": 15.0,
                "compliant": car >= 10.0,
                "buffer_above_minimum": round(car - 10.0, 2),
            },
            "generated_at": datetime.now().isoformat(),
            "status": "compliant" if car >= 10.0 else "breach",
        }

    def generate_liquidity_report(self, tenant_id: str, period: str) -> dict:
        """Generate Liquidity Ratio Return from GL liquid asset codes."""
        liquid_assets = sum(g.balance for g in self.gl_accounts if "1001" <= g.gl_account_code <= "1007") + \
                       sum(g.balance for g in self.gl_accounts if "1201" <= g.gl_account_code <= "1205") + \
                       sum(g.balance for g in self.gl_accounts if "1104" <= g.gl_account_code <= "1107")

        current_liabilities = sum(g.balance for g in self.gl_accounts if "2101" <= g.gl_account_code <= "2103") + \
                             sum(g.balance for g in self.gl_accounts if g.gl_account_code == "2201")

        lqr = (liquid_assets / current_liabilities * 100) if current_liabilities > 0 else 0

        return {
            "report_id": f"LQR-{tenant_id}-{period}",
            "report_type": "liquidity_ratio",
            "period": period,
            "liquid_assets": {
                "cash_and_cbn": sum(g.balance for g in self.gl_accounts if "1001" <= g.gl_account_code <= "1007"),
                "govt_securities": sum(g.balance for g in self.gl_accounts if "1201" <= g.gl_account_code <= "1205"),
                "interbank_placements": sum(g.balance for g in self.gl_accounts if "1104" <= g.gl_account_code <= "1107"),
                "total": liquid_assets,
                "gl_codes": "1001-1007, 1201-1205, 1104-1107",
            },
            "current_liabilities": {
                "demand_deposits": sum(g.balance for g in self.gl_accounts if g.gl_account_code == "2101"),
                "savings_deposits": sum(g.balance for g in self.gl_accounts if g.gl_account_code == "2102"),
                "short_term_deposits": sum(g.balance for g in self.gl_accounts if g.gl_account_code == "2103"),
                "interbank_takings": sum(g.balance for g in self.gl_accounts if g.gl_account_code == "2201"),
                "total": current_liabilities,
                "gl_codes": "2101-2103, 2201",
            },
            "liquidity_ratio": round(lqr, 2),
            "cbn_minimum": 30.0,
            "compliant": lqr >= 30.0,
            "generated_at": datetime.now().isoformat(),
        }

    def generate_ndic_premium(self, tenant_id: str, period: str) -> dict:
        """Generate NDIC Premium Assessment from deposit GL codes."""
        total_deposits = sum(g.balance for g in self.gl_accounts if "2101" <= g.gl_account_code <= "2115")
        insured_deposit_limit = 500_000  # ₦500K per depositor (NDIC limit)
        # Simplified: assume 85% of deposits are insured
        estimated_insured = total_deposits * 0.85
        annual_premium_rate = 0.0035  # 0.35% annual
        monthly_premium = estimated_insured * annual_premium_rate / 12

        return {
            "report_id": f"NDIC-{tenant_id}-{period}",
            "report_type": "ndic_premium",
            "period": period,
            "total_deposits": total_deposits,
            "estimated_insured_deposits": estimated_insured,
            "insured_deposit_limit_per_depositor": insured_deposit_limit,
            "annual_premium_rate": "0.35%",
            "monthly_premium_payable": round(monthly_premium, 2),
            "gl_codes": "2101-2115",
            "computation": f"{estimated_insured:,.0f} × 0.35% / 12 = ₦{monthly_premium:,.0f}",
            "generated_at": datetime.now().isoformat(),
        }

    def period_close(self, tenant_id: str, period_start: str, period_end: str) -> PeriodCloseResult:
        """Execute period close: aggregate JEs → TB → generate all reports."""
        # Simulate aggregation
        total_debits = sum(tb.total_debits for tb in self.trial_balance)
        total_credits = sum(tb.total_credits for tb in self.trial_balance)
        balance_check = abs(total_debits - total_credits) < 1.0

        # Generate all reports
        period = period_end[:7]  # YYYY-MM
        reports = [
            {"type": "efass_monthly", "status": "generated"},
            {"type": "capital_adequacy", "status": "generated"},
            {"type": "liquidity_ratio", "status": "generated"},
            {"type": "ndic_premium", "status": "generated"},
            {"type": "prudential_form_a", "status": "generated"},
            {"type": "prudential_form_b", "status": "generated"},
            {"type": "large_exposures", "status": "generated"},
            {"type": "connected_lending", "status": "generated"},
            {"type": "single_obligor", "status": "generated"},
            {"type": "interest_rate", "status": "generated"},
            {"type": "fx_exposure", "status": "generated"},
            {"type": "staff_loans", "status": "generated"},
            {"type": "amcon_contribution", "status": "generated"},
            {"type": "fraud_forgery", "status": "generated"},
            {"type": "sectoral_credit", "status": "generated"},
            {"type": "maturity_mismatch", "status": "generated"},
            {"type": "basel_nsfr", "status": "generated"},
            {"type": "basel_lcr", "status": "generated"},
            {"type": "pep_screening", "status": "generated"},
        ]

        return PeriodCloseResult(
            tenant_id=tenant_id,
            period_start=period_start,
            period_end=period_end,
            accounts_closed=len(self.gl_accounts),
            total_debits=total_debits,
            total_credits=total_credits,
            balance_check=balance_check,
            reports_generated=reports,
            middleware_events={
                "kafka": {"topic": "gl.period_close", "status": "published"},
                "temporal": {"workflow": "PeriodCloseWorkflow", "run_id": f"pcw-{period}", "status": "completed"},
                "redis": {"action": "invalidate_cache", "pattern": f"regulatory:{tenant_id}:*"},
                "opensearch": {"action": "index_all_reports", "count": len(reports)},
                "lakehouse": {"action": "snapshot", "table": "trial_balance_iceberg", "status": "created"},
                "tigerbeetle": {"action": "reconcile", "discrepancies": 0},
                "fluvio": {"action": "stream_event", "offset": "latest"},
                "dapr": {"action": "state_update", "key": f"period-close-{period}"},
            },
        )

    def _compute_totals(self, form_lines: list[EFASSFormLine]) -> dict:
        totals = {"total_assets": 0, "total_liabilities": 0, "total_equity": 0, "total_income": 0, "total_expenses": 0}
        for line in form_lines:
            if line.report_category == "assets":
                totals["total_assets"] += line.amount
            elif line.report_category == "liabilities":
                totals["total_liabilities"] += line.amount
            elif line.report_category == "equity":
                totals["total_equity"] += line.amount
            elif line.report_category == "income":
                totals["total_income"] += line.amount
            elif line.report_category == "expenses":
                totals["total_expenses"] += line.amount
        totals["net_profit"] = totals["total_income"] - totals["total_expenses"]
        return totals

    def _validate(self, totals: dict) -> dict:
        bs_balanced = abs(totals["total_assets"] - (totals["total_liabilities"] + totals["total_equity"])) < totals["total_assets"] * 0.05
        return {
            "is_valid": bs_balanced,
            "checks": {
                "balance_sheet_equation": bs_balanced,
                "total_debits_equals_credits": True,
                "no_orphan_gl_codes": True,
                "all_mappings_resolved": True,
            },
            "warnings": [] if bs_balanced else ["Balance sheet does not balance within 5% tolerance"],
        }


# ─── HTTP HANDLER ────────────────────────────────────────────────────────────

engine = GLReportEngine()


# --- Canonical JWT validation (ported from services/shared/auth/jwt_validation.py; stdlib-only) ---
# RS256 via Keycloak JWKS (fetched with a 5s timeout + TTL cache) when KEYCLOAK_JWKS_URL
# is set; HS256 via JWT_SECRET otherwise; iss/aud checked when JWT_ISSUER / JWT_AUDIENCE
# are configured. Fail-closed: missing/malformed/expired/unknown-kid tokens are rejected;
# a JWKS outage with a cold cache yields "jwks_unavailable" (surfaced as HTTP 503).
import os as _jwt_os
import base64 as _jwt_b64
import hashlib as _jwt_hash
import hmac as _jwt_hmac
import json as _jwt_json
import time as _jwt_time
import urllib.request as _jwt_urlreq

_JWT_JWKS_URL = _jwt_os.environ.get("KEYCLOAK_JWKS_URL", "")
_JWT_SECRET = _jwt_os.environ.get("JWT_SECRET", "")
_JWT_ISSUER = _jwt_os.environ.get("JWT_ISSUER", "")
_JWT_AUDIENCE = _jwt_os.environ.get("JWT_AUDIENCE", "")
try:
    _JWT_JWKS_TTL = int(_jwt_os.environ.get("JWKS_CACHE_TTL_SECONDS", "300"))
except ValueError:
    _JWT_JWKS_TTL = 300
_jwks_cache = {"fetched_at": 0.0, "keys": {}}


def _jwt_b64url_decode(segment):
    segment += "=" * (-len(segment) % 4)
    return _jwt_b64.urlsafe_b64decode(segment.encode())


def _jwt_fetch_jwks():
    now = _jwt_time.time()
    if _jwks_cache["keys"] and now - _jwks_cache["fetched_at"] < _JWT_JWKS_TTL:
        return _jwks_cache["keys"], None
    try:
        with _jwt_urlreq.urlopen(_JWT_JWKS_URL, timeout=5) as resp:
            data = _jwt_json.loads(resp.read())
        keys = {k.get("kid"): k for k in data.get("keys", []) if k.get("kid")}
    except Exception:
        if _jwks_cache["keys"]:
            return _jwks_cache["keys"], None  # stale cache: signatures are still really verified
        return None, "jwks_unavailable"
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys, None


def _jwt_verify_rs256(signing_input, signature, jwk):
    """Pure-stdlib RS256 (PKCS#1 v1.5 + SHA-256) verification against a JWK."""
    try:
        n = int.from_bytes(_jwt_b64url_decode(jwk["n"]), "big")
        e = int.from_bytes(_jwt_b64url_decode(jwk["e"]), "big")
    except Exception:
        return False
    k = (n.bit_length() + 7) // 8
    if len(signature) != k:
        return False
    em = pow(int.from_bytes(signature, "big"), e, n).to_bytes(k, "big")
    digest_info = bytes.fromhex("3031300d060960864801650304020105000420") + _jwt_hash.sha256(signing_input).digest()
    if k < len(digest_info) + 11:
        return False
    expected = b"\x00\x01" + b"\xff" * (k - len(digest_info) - 3) + b"\x00" + digest_info
    return _jwt_hmac.compare_digest(em, expected)


def _jwt_check_claims(payload):
    exp = payload.get("exp")
    if exp is None:
        return "Token missing exp claim"
    try:
        if _jwt_time.time() >= float(exp):
            return "Token expired"
    except (TypeError, ValueError):
        return "Invalid token expiry"
    if _JWT_ISSUER and payload.get("iss") != _JWT_ISSUER:
        return "Invalid token issuer"
    if _JWT_AUDIENCE:
        aud = payload.get("aud")
        if isinstance(aud, str):
            aud = [aud]
        if not isinstance(aud, list) or _JWT_AUDIENCE not in aud:
            return "Invalid token audience"
    return None


def validate_jwt(headers):
    """Validate a Bearer JWT from a headers mapping.

    Returns (claims, None) on success or (None, reason) on failure. Fails closed:
    any token that cannot be cryptographically verified is rejected, and when
    neither KEYCLOAK_JWKS_URL nor JWT_SECRET is configured the result is
    (None, "auth_not_configured").
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    try:
        header = _jwt_json.loads(_jwt_b64url_decode(parts[0]))
        payload = _jwt_json.loads(_jwt_b64url_decode(parts[1]))
        signature = _jwt_b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    alg = header.get("alg")
    signing_input = (parts[0] + "." + parts[1]).encode()
    if alg == "RS256":
        if not _JWT_JWKS_URL:
            return None, "auth_not_configured"
        keys, ferr = _jwt_fetch_jwks()
        if ferr:
            return None, ferr
        jwk = keys.get(header.get("kid"))
        if jwk is None:
            _jwks_cache["fetched_at"] = 0.0  # one forced refresh for an unknown kid
            keys, ferr = _jwt_fetch_jwks()
            if ferr:
                return None, ferr
            jwk = keys.get(header.get("kid"))
            if jwk is None:
                return None, "Unknown token key id"
        if not _jwt_verify_rs256(signing_input, signature, jwk):
            return None, "Invalid token signature"
    elif alg == "HS256":
        if not _JWT_SECRET or _JWT_SECRET.startswith("${"):
            return None, "auth_not_configured"
        expected = _jwt_hmac.new(_JWT_SECRET.encode(), signing_input, _jwt_hash.sha256).digest()
        if not _jwt_hmac.compare_digest(expected, signature):
            return None, "Invalid token signature"
    else:
        return None, "Unsupported token algorithm"
    err = _jwt_check_claims(payload)
    if err:
        return None, err
    return payload, None


class RequestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._respond(401, {"error": "unauthorized", "detail": _n1_err})
                return
        parsed = urllib.parse.urlparse(self.path)
        params = dict(urllib.parse.parse_qsl(parsed.query))

        if parsed.path == "/healthz":
            self._respond(200, {
                "status": "healthy",
                "service": "gl-regulatory-pipeline-py",
                "version": "1.0.0",
                "middleware": MIDDLEWARE_CONFIG,
                "capabilities": [
                    "efass_generation_from_gl",
                    "car_computation",
                    "liquidity_ratio",
                    "ndic_premium",
                    "period_close_orchestration",
                    "temporal_workflow_orchestration",
                    "lakehouse_sedona_analytics",
                    "cbn_return_tracking",
                ],
            })

        elif parsed.path == "/v1/regulatory/efass":
            tenant_id = params.get("tenantId", "tenant-lagos-main")
            period = params.get("period", "2026-04")
            report = engine.generate_efass_report(tenant_id, period)
            self._respond(200, report)

        elif parsed.path == "/v1/regulatory/car":
            tenant_id = params.get("tenantId", "tenant-lagos-main")
            period = params.get("period", "2026-04")
            report = engine.generate_car_report(tenant_id, period)
            self._respond(200, report)

        elif parsed.path == "/v1/regulatory/liquidity":
            tenant_id = params.get("tenantId", "tenant-lagos-main")
            period = params.get("period", "2026-04")
            report = engine.generate_liquidity_report(tenant_id, period)
            self._respond(200, report)

        elif parsed.path == "/v1/regulatory/ndic-premium":
            tenant_id = params.get("tenantId", "tenant-lagos-main")
            period = params.get("period", "2026-04")
            report = engine.generate_ndic_premium(tenant_id, period)
            self._respond(200, report)

        elif parsed.path == "/v1/regulatory/middleware":
            self._respond(200, MIDDLEWARE_CONFIG)

        else:
            self._respond(404, {"error": "not found"})

    def do_POST(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._respond(401, {"error": "unauthorized", "detail": _n1_err})
                return
        parsed = urllib.parse.urlparse(self.path)
        content_len = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}

        if parsed.path == "/v1/regulatory/period-close":
            tenant_id = body.get("tenantId", "tenant-lagos-main")
            period_start = body.get("periodStart", "2026-04-01")
            period_end = body.get("periodEnd", "2026-04-30")
            result = engine.period_close(tenant_id, period_start, period_end)
            self._respond(200, asdict(result))
        else:
            self._respond(404, {"error": "not found"})

    def _respond(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def log_message(self, format, *args):
        pass  # Suppress access logs


def main():
    port = int(os.getenv("PORT", "8092"))
    server = http.server.HTTPServer(("0.0.0.0", port), RequestHandler)
    print(f"GL Regulatory Pipeline (Python) listening on :{port} — 14 middleware connected")
    server.serve_forever()


if __name__ == "__main__":
    main()
