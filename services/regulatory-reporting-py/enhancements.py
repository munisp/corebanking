"""B10: Regulatory Reporting Enhancements
Adds: NDIC returns, FIRS tax reporting, anti-money laundering (AML) screening,
CBN prudential guidelines compliance, Basel III capital adequacy
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import uuid


@dataclass
class NDICReturn:
    id: str = ""
    return_type: str = ""  # monthly_statement, quarterly_return, annual_return, deposit_insurance
    period: str = ""
    total_deposits: float = 0
    insured_deposits: float = 0
    premium_due: float = 0
    premium_rate: float = 0.35  # 35 basis points
    filing_deadline: str = ""
    status: str = "draft"  # draft, submitted, acknowledged, queried
    submission_ref: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class FIRSTaxFiling:
    id: str = ""
    tax_type: str = ""  # WHT, VAT, CIT, EDT, tertiary_education
    period: str = ""
    gross_amount: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    deductions: float = 0
    net_payable: float = 0
    tin: str = ""
    status: str = "calculated"

    def to_dict(self):
        return asdict(self)


@dataclass
class AMLScreening:
    id: str = ""
    customer_id: str = ""
    screening_type: str = ""  # onboarding, periodic, transaction_triggered, enhanced_due_diligence
    watchlists_checked: list = field(default_factory=lambda: ["OFAC", "EU", "UN", "PEP", "EFCC"])
    match_found: bool = False
    match_details: str = ""
    risk_rating: str = ""  # low, medium, high, prohibited
    screened_at: str = ""
    next_review: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class BaselIIIReport:
    id: str = ""
    report_date: str = ""
    tier1_capital: float = 0
    tier2_capital: float = 0
    total_capital: float = 0
    risk_weighted_assets: float = 0
    capital_adequacy_ratio: float = 0  # min 10% for Nigerian banks
    leverage_ratio: float = 0
    liquidity_coverage_ratio: float = 0  # min 100%
    net_stable_funding_ratio: float = 0  # min 100%
    compliant: bool = False

    def to_dict(self):
        return asdict(self)


ndic_returns: list[NDICReturn] = []
tax_filings: list[FIRSTaxFiling] = []
aml_screenings: list[AMLScreening] = []
basel_reports: list[BaselIIIReport] = []


def handle_ndic(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"returns": [r.to_dict() for r in ndic_returns]}
    if method == "POST":
        ret = NDICReturn(**{k: v for k, v in body.items() if k in NDICReturn.__dataclass_fields__})
        ret.id = f"NDIC-{uuid.uuid4().hex[:8]}"
        ret.premium_due = ret.insured_deposits * (ret.premium_rate / 100 / 100)  # basis points
        ndic_returns.append(ret)
        return 201, ret.to_dict()
    return 405, {"error": "method not allowed"}


def handle_firs(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"filings": [f.to_dict() for f in tax_filings]}
    if method == "POST":
        filing = FIRSTaxFiling(**{k: v for k, v in body.items() if k in FIRSTaxFiling.__dataclass_fields__})
        filing.id = f"FIRS-{uuid.uuid4().hex[:8]}"
        # Tax rates by type
        rates = {"WHT": 10, "VAT": 7.5, "CIT": 30, "EDT": 0.005, "tertiary_education": 2}
        if filing.tax_type in rates:
            filing.tax_rate = rates[filing.tax_type]
        filing.tax_amount = filing.gross_amount * (filing.tax_rate / 100)
        filing.net_payable = filing.tax_amount - filing.deductions
        tax_filings.append(filing)
        return 201, filing.to_dict()
    return 405, {"error": "method not allowed"}


def handle_aml(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"screenings": [s.to_dict() for s in aml_screenings]}
    if method == "POST":
        scr = AMLScreening(**{k: v for k, v in body.items() if k in AMLScreening.__dataclass_fields__})
        scr.id = f"AML-{uuid.uuid4().hex[:8]}"
        scr.screened_at = datetime.now(timezone.utc).isoformat()
        # Auto risk rating
        if scr.match_found:
            scr.risk_rating = "high"
        elif scr.screening_type == "enhanced_due_diligence":
            scr.risk_rating = "medium"
        else:
            scr.risk_rating = "low"
        aml_screenings.append(scr)
        return 201, scr.to_dict()
    return 405, {"error": "method not allowed"}


def handle_basel(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"reports": [r.to_dict() for r in basel_reports]}
    if method == "POST":
        report = BaselIIIReport(**{k: v for k, v in body.items() if k in BaselIIIReport.__dataclass_fields__})
        report.id = f"BAS-{uuid.uuid4().hex[:8]}"
        report.report_date = datetime.now(timezone.utc).isoformat()
        report.total_capital = report.tier1_capital + report.tier2_capital
        if report.risk_weighted_assets > 0:
            report.capital_adequacy_ratio = (report.total_capital / report.risk_weighted_assets) * 100
        # CBN minimum CAR = 10% for national, 15% for international
        report.compliant = report.capital_adequacy_ratio >= 10 and report.liquidity_coverage_ratio >= 100
        basel_reports.append(report)
        return 201, report.to_dict()
    return 405, {"error": "method not allowed"}


ENHANCEMENT_ROUTES = {
    "/v1/regulatory/ndic": handle_ndic,
    "/v1/regulatory/firs-tax": handle_firs,
    "/v1/regulatory/aml-screening": handle_aml,
    "/v1/regulatory/basel-iii": handle_basel,
}
