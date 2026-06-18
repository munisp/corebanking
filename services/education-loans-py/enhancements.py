"""B8: Education Loans Enhancements
Adds: Institution verification, NYSC integration, scholarship matching,
grace period management, income-driven repayment
"""

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
import uuid


@dataclass
class InstitutionVerification:
    id: str = ""
    institution_name: str = ""
    institution_code: str = ""
    nuc_accredited: bool = False
    program_name: str = ""
    program_duration_years: int = 0
    tuition_range_min: float = 0
    tuition_range_max: float = 0
    verified: bool = False
    verified_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class GracePeriod:
    id: str = ""
    loan_id: str = ""
    student_id: str = ""
    period_type: str = ""  # study, nysc, job_search
    start_date: str = ""
    end_date: str = ""
    months: int = 0
    status: str = "active"

    def to_dict(self):
        return asdict(self)


@dataclass
class ScholarshipMatch:
    id: str = ""
    student_id: str = ""
    scholarship_name: str = ""
    provider: str = ""
    amount: float = 0
    eligibility_score: float = 0
    deadline: str = ""
    status: str = "available"  # available, applied, awarded, expired

    def to_dict(self):
        return asdict(self)


@dataclass
class IncomeRepaymentPlan:
    id: str = ""
    loan_id: str = ""
    borrower_id: str = ""
    monthly_income: float = 0
    repayment_percentage: float = 10  # % of income
    monthly_payment: float = 0
    plan_duration_months: int = 0
    status: str = "active"

    def to_dict(self):
        return asdict(self)


# Storage
institutions: list[InstitutionVerification] = []
grace_periods: list[GracePeriod] = []
scholarships: list[ScholarshipMatch] = []
repayment_plans: list[IncomeRepaymentPlan] = []


def handle_institutions(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"institutions": [i.to_dict() for i in institutions]}
    if method == "POST":
        inst = InstitutionVerification(**{k: v for k, v in body.items() if k in InstitutionVerification.__dataclass_fields__})
        inst.id = f"INST-{uuid.uuid4().hex[:8]}"
        inst.verified_at = datetime.now(timezone.utc).isoformat()
        institutions.append(inst)
        return 201, inst.to_dict()
    return 405, {"error": "method not allowed"}


def handle_grace_period(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"gracePeriods": [g.to_dict() for g in grace_periods]}
    if method == "POST":
        gp = GracePeriod(**{k: v for k, v in body.items() if k in GracePeriod.__dataclass_fields__})
        gp.id = f"GP-{uuid.uuid4().hex[:8]}"
        if gp.period_type not in ("study", "nysc", "job_search"):
            return 400, {"error": "period_type must be study, nysc, or job_search"}
        max_months = {"study": 48, "nysc": 12, "job_search": 6}
        if gp.months > max_months.get(gp.period_type, 12):
            return 400, {"error": f"Max grace period for {gp.period_type} is {max_months[gp.period_type]} months"}
        grace_periods.append(gp)
        return 201, gp.to_dict()
    return 405, {"error": "method not allowed"}


def handle_scholarships(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"scholarships": [s.to_dict() for s in scholarships]}
    if method == "POST":
        sm = ScholarshipMatch(**{k: v for k, v in body.items() if k in ScholarshipMatch.__dataclass_fields__})
        sm.id = f"SCH-{uuid.uuid4().hex[:8]}"
        scholarships.append(sm)
        return 201, sm.to_dict()
    return 405, {"error": "method not allowed"}


def handle_income_repayment(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"plans": [p.to_dict() for p in repayment_plans]}
    if method == "POST":
        plan = IncomeRepaymentPlan(**{k: v for k, v in body.items() if k in IncomeRepaymentPlan.__dataclass_fields__})
        plan.id = f"IRP-{uuid.uuid4().hex[:8]}"
        plan.monthly_payment = plan.monthly_income * (plan.repayment_percentage / 100)
        repayment_plans.append(plan)
        return 201, plan.to_dict()
    return 405, {"error": "method not allowed"}


ENHANCEMENT_ROUTES = {
    "/v1/education/institutions": handle_institutions,
    "/v1/education/grace-periods": handle_grace_period,
    "/v1/education/scholarships": handle_scholarships,
    "/v1/education/income-repayment": handle_income_repayment,
}
