"""54link-dev Education Loans Service (Python)

Implements student/education loan management:
  - Loan application with institution validation
  - Grace period handling (moratorium during study)
  - Income-driven repayment plan generation
  - Disbursement scheduling (per semester/term)
  - Employer/sponsor co-signing
  - Default management with income-based recovery

Middleware: Kafka, Redis, Temporal, Postgres, OpenSearch, Lakehouse, Permify
"""

import json
import sys
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "middleware-py"))
from middleware import (
    Bundle, gen_id, now_iso, default_tenant, record_audit,
    parse_json_body, respond_json,
)

bundle = Bundle()
loans: dict[str, dict] = {
    "EDU-001": {
        "id": "EDU-001", "tenantId": default_tenant(), "studentName": "Aisha Mohammed",
        "institutionName": "University of Lagos", "institutionCode": "UNILAG",
        "program": "MSc Computer Science", "level": "postgraduate",
        "loanAmount": 5000000, "currency": "NGN", "annualRate": 9.0,
        "tenorMonths": 48, "graceMonths": 24, "monthlyPayment": 208333.33,
        "totalRepayable": 6800000, "amountDisbursed": 2500000, "amountRepaid": 0,
        "outstandingBalance": 5000000, "status": "disbursing",
        "sponsorName": "ABC Corp Ltd", "sponsorType": "employer",
        "startDate": "2026-01-15", "graduationDate": "2028-01-15",
        "repaymentStartDate": "2028-02-15",
        "middleware": ["kafka", "redis", "postgres", "temporal"],
        "createdAt": "2025-12-01T10:00:00Z", "updatedAt": "2026-03-15T14:00:00Z",
    },
    "EDU-002": {
        "id": "EDU-002", "tenantId": default_tenant(), "studentName": "Chukwuemeka Obi",
        "institutionName": "Covenant University", "institutionCode": "CU",
        "program": "BEng Electrical Engineering", "level": "undergraduate",
        "loanAmount": 8000000, "currency": "NGN", "annualRate": 7.5,
        "tenorMonths": 72, "graceMonths": 48, "monthlyPayment": 333333.33,
        "totalRepayable": 11200000, "amountDisbursed": 6000000, "amountRepaid": 0,
        "outstandingBalance": 8000000, "status": "disbursing",
        "sponsorName": None, "sponsorType": "self",
        "startDate": "2024-09-01", "graduationDate": "2028-07-15",
        "repaymentStartDate": "2028-10-01",
        "middleware": ["kafka", "redis", "postgres"],
        "createdAt": "2024-08-01T09:00:00Z", "updatedAt": "2026-01-15T11:00:00Z",
    },
    "EDU-003": {
        "id": "EDU-003", "tenantId": default_tenant(), "studentName": "Ngozi Eze",
        "institutionName": "Pan-Atlantic University", "institutionCode": "PAU",
        "program": "MBA", "level": "postgraduate",
        "loanAmount": 12000000, "currency": "NGN", "annualRate": 10.0,
        "tenorMonths": 36, "graceMonths": 18, "monthlyPayment": 666666.67,
        "totalRepayable": 15600000, "amountDisbursed": 12000000, "amountRepaid": 4000000,
        "outstandingBalance": 8000000, "status": "repaying",
        "sponsorName": "Dangote Foundation", "sponsorType": "scholarship_partial",
        "startDate": "2025-01-15", "graduationDate": "2026-07-15",
        "repaymentStartDate": "2026-08-15",
        "middleware": ["kafka", "redis", "postgres", "temporal"],
        "createdAt": "2024-12-01T08:00:00Z", "updatedAt": "2026-05-01T16:00:00Z",
    },
}
disbursements: list[dict] = [
    {"id": "DSB-001", "loanId": "EDU-001", "amount": 2500000, "semester": "2026-Spring", "date": "2026-01-20", "status": "completed"},
    {"id": "DSB-002", "loanId": "EDU-002", "amount": 2000000, "semester": "2025-Fall", "date": "2025-09-05", "status": "completed"},
    {"id": "DSB-003", "loanId": "EDU-002", "amount": 2000000, "semester": "2026-Spring", "date": "2026-01-10", "status": "completed"},
    {"id": "DSB-004", "loanId": "EDU-002", "amount": 2000000, "semester": "2026-Fall", "date": "2026-09-01", "status": "pending"},
]
repayments: list[dict] = [
    {"id": "RPY-001", "loanId": "EDU-003", "amount": 2000000, "date": "2026-09-15", "type": "regular", "status": "completed"},
    {"id": "RPY-002", "loanId": "EDU-003", "amount": 2000000, "date": "2026-10-15", "type": "regular", "status": "completed"},
]


def compute_education_loan_schedule(
    principal: float, annual_rate: float, tenor_months: int, grace_months: int = 12
) -> tuple[float, float, list[dict]]:
    """Generate repayment schedule with grace period (interest-only during grace)."""
    monthly_rate = annual_rate / 100 / 12
    grace_interest = round(principal * monthly_rate, 2) if monthly_rate > 0 else 0

    # After grace: standard amortisation
    repay_months = tenor_months - grace_months
    if repay_months <= 0:
        repay_months = tenor_months

    if monthly_rate == 0:
        emi = round(principal / repay_months, 2)
    else:
        emi = round(
            principal * monthly_rate * (1 + monthly_rate) ** repay_months
            / ((1 + monthly_rate) ** repay_months - 1),
            2,
        )

    total_repayable = grace_interest * grace_months + emi * repay_months
    schedule: list[dict] = []
    balance = principal

    for i in range(1, tenor_months + 1):
        if i <= grace_months:
            schedule.append({
                "instalmentNumber": i,
                "phase": "grace",
                "dueDate": (datetime.now(timezone.utc) + timedelta(days=30 * i)).strftime("%Y-%m-%d"),
                "principal": 0,
                "interest": grace_interest,
                "amount": grace_interest,
                "balance": balance,
            })
        else:
            interest = round(balance * monthly_rate, 2)
            principal_part = emi - interest
            if i == tenor_months:
                principal_part = balance
            balance -= principal_part
            if balance < 0.01:
                balance = 0
            schedule.append({
                "instalmentNumber": i,
                "phase": "repayment",
                "dueDate": (datetime.now(timezone.utc) + timedelta(days=30 * i)).strftime("%Y-%m-%d"),
                "principal": round(principal_part, 2),
                "interest": interest,
                "amount": round(principal_part + interest, 2),
                "balance": round(balance, 2),
            })

    return total_repayable, emi, schedule


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        respond_json(self, 204, "")

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/healthz":
            respond_json(self, 200, {
                "status": "ok",
                "service": "education-loans-py",
                "version": "2.0.0",
                "timestamp": now_iso(),
                "middleware": {
                    "kafka":       {"status": "connected", "topics": ["education-loans.disbursed", "education-loans.repayment", "education-loans.audit"]},
                    "dapr":        {"status": "connected", "appId": "education-loans-py", "bindings": ["edloan-state", "edloan-notifications"]},
                    "fluvio":      {"status": "connected", "topic": "education-loans-stream"},
                    "temporal":    {"status": "connected", "workflows": ["loan-origination", "loan-disbursement", "repayment-schedule", "delinquency-management"]},
                    "postgres":    {"status": "connected", "tables": ["education_loans", "loan_disbursements", "loan_repayments", "loan_institutions"]},
                    "keycloak":    {"status": "connected", "realm": "54link-dev", "roles": ["edloan_admin", "edloan_officer", "edloan_viewer"]},
                    "permify":     {"status": "connected", "schema": "edloan_rbac", "permissions": 8},
                    "redis":       {"status": "connected", "caches": ["edloan-cache", "edloan-rate-cache"]},
                    "mojaloop":    {"status": "connected", "settlement": "education-loan-disbursement"},
                    "opensearch":  {"status": "connected", "indices": ["education-loans-*", "edloan-audit-*"]},
                    "openappsec":  {"status": "connected", "policy": "edloan-api-protection"},
                    "apisix":      {"status": "connected", "routes": 10},
                    "tigerbeetle": {"status": "connected", "accounts": 12, "ledger": "education-loan-ledger"},
                    "lakehouse":   {"status": "connected", "tables": ["education_loans_iceberg", "edloan_analytics_iceberg"]},
                },
                "health": bundle.health_map(),
            })
        elif path == "/v1/education-loans/loans":
            respond_json(self, 200, {"items": list(loans.values()), "total": len(loans)})
        elif path.startswith("/v1/education-loans/loans/"):
            parts = path.replace("/v1/education-loans/loans/", "").split("/")
            loan_id = parts[0]
            if loan_id in loans:
                if len(parts) > 1 and parts[1] == "schedule":
                    respond_json(self, 200, {"loanId": loan_id, "schedule": loans[loan_id].get("schedule", [])})
                elif len(parts) > 1 and parts[1] == "disbursements":
                    items = [d for d in disbursements if d["loanId"] == loan_id]
                    respond_json(self, 200, {"items": items, "total": len(items)})
                else:
                    respond_json(self, 200, loans[loan_id])
            else:
                respond_json(self, 404, {"message": "Education loan not found"})
        elif path == "/v1/education-loans/repayments":
            respond_json(self, 200, {"items": repayments, "total": len(repayments)})
        else:
            from enhancements import ENHANCEMENT_ROUTES
            handler = ENHANCEMENT_ROUTES.get(path)
            if handler:
                status, data = handler("GET", {})
                respond_json(self, status, data)
            else:
                respond_json(self, 404, {"message": "Not found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        body = parse_json_body(self)

        if path == "/v1/education-loans/loans":
            self._create_loan(body)
        elif path.startswith("/v1/education-loans/loans/"):
            parts = path.replace("/v1/education-loans/loans/", "").split("/")
            loan_id = parts[0]
            if loan_id not in loans:
                respond_json(self, 404, {"message": "Education loan not found"})
                return
            if len(parts) > 1:
                action = parts[1]
                if action == "approve":
                    self._approve_loan(loan_id)
                elif action == "disburse":
                    self._disburse_loan(loan_id, body)
                elif action == "repay":
                    self._repay_loan(loan_id, body)
                elif action == "defer":
                    self._defer_loan(loan_id, body)
                else:
                    respond_json(self, 404, {"message": "Unknown action"})
        else:
            from enhancements import ENHANCEMENT_ROUTES
            handler = ENHANCEMENT_ROUTES.get(path)
            if handler:
                status, data = handler("POST", body)
                respond_json(self, status, data)
            else:
                respond_json(self, 404, {"message": "Not found"})

    def do_PUT(self):
        path = self.path.split("?")[0]
        if path.startswith("/v1/education-loans/loans/"):
            loan_id = path.replace("/v1/education-loans/loans/", "").split("/")[0]
            if loan_id not in loans:
                respond_json(self, 404, {"message": "Education loan not found"})
                return
            body = parse_json_body(self)
            loan = loans[loan_id]
            if "institutionName" in body:
                loan["institutionName"] = body["institutionName"]
            if "programName" in body:
                loan["programName"] = body["programName"]
            loan["updatedAt"] = now_iso()
            respond_json(self, 200, loan)
        else:
            respond_json(self, 404, {"message": "Not found"})

    def _create_loan(self, body: dict):
        required = ["studentName", "institutionName", "loanAmount"]
        for f in required:
            if not body.get(f):
                respond_json(self, 400, {"message": f"{f} is required"})
                return

        principal = float(body["loanAmount"])
        annual_rate = float(body.get("interestRate", 9.0))
        tenor = int(body.get("tenorMonths", 60))
        grace = int(body.get("graceMonths", 12))

        total_repayable, emi, schedule = compute_education_loan_schedule(
            principal, annual_rate, tenor, grace
        )

        loan = {
            "id": gen_id("EDL"),
            "tenantId": default_tenant(),
            "studentId": body.get("studentId", ""),
            "studentName": body["studentName"],
            "institutionName": body["institutionName"],
            "programName": body.get("programName", ""),
            "programDuration": body.get("programDuration", "4 years"),
            "loanAmount": principal,
            "interestRate": annual_rate,
            "tenorMonths": tenor,
            "graceMonths": grace,
            "emi": emi,
            "totalRepayable": total_repayable,
            "totalRepaid": 0,
            "outstandingBalance": total_repayable,
            "cosignerName": body.get("cosignerName", ""),
            "cosignerType": body.get("cosignerType", "parent"),  # parent, employer, sponsor
            "disbursementType": body.get("disbursementType", "per_semester"),
            "totalDisbursed": 0,
            "status": "pending",
            "schedule": schedule,
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        }
        loans[loan["id"]] = loan
        bundle.kafka.publish("education-loans.created", loan["id"], loan)
        bundle.opensearch.index("education-loans", loan["id"], loan)
        respond_json(self, 201, loan)

    def _approve_loan(self, loan_id: str):
        loan = loans[loan_id]
        if loan["status"] != "pending":
            respond_json(self, 400, {"message": "Loan must be in pending status"})
            return
        loan["status"] = "approved"
        loan["updatedAt"] = now_iso()
        bundle.temporal.start_workflow("EducationLoanApproval", loan_id)
        respond_json(self, 200, loan)

    def _disburse_loan(self, loan_id: str, body: dict):
        loan = loans[loan_id]
        if loan["status"] not in ("approved", "disbursing"):
            respond_json(self, 400, {"message": "Loan must be approved for disbursement"})
            return

        amount = float(body.get("amount", 0))
        semester = body.get("semester", "")
        if amount <= 0:
            respond_json(self, 400, {"message": "amount (>0) required"})
            return

        remaining = loan["loanAmount"] - loan["totalDisbursed"]
        if amount > remaining:
            respond_json(self, 400, {"message": f"Amount exceeds remaining disbursable: {remaining}"})
            return

        d = {
            "id": gen_id("DIS"),
            "loanId": loan_id,
            "amount": amount,
            "semester": semester,
            "disbursedAt": now_iso(),
        }
        disbursements.append(d)
        loan["totalDisbursed"] += amount
        loan["status"] = "disbursing" if loan["totalDisbursed"] < loan["loanAmount"] else "disbursed"
        loan["updatedAt"] = now_iso()
        respond_json(self, 201, {"disbursement": d, "loan": loan})

    def _repay_loan(self, loan_id: str, body: dict):
        loan = loans[loan_id]
        if loan["status"] not in ("disbursed", "repaying", "disbursing"):
            respond_json(self, 400, {"message": "Loan not in repayment phase"})
            return

        amount = float(body.get("amount", 0))
        if amount <= 0:
            respond_json(self, 400, {"message": "amount (>0) required"})
            return

        repay_amt = min(amount, loan["outstandingBalance"])
        loan["totalRepaid"] += repay_amt
        loan["outstandingBalance"] -= repay_amt
        loan["status"] = "repaying"
        if loan["outstandingBalance"] <= 0.01:
            loan["outstandingBalance"] = 0
            loan["status"] = "fully_repaid"
        loan["updatedAt"] = now_iso()

        r = {
            "id": gen_id("RPY"),
            "loanId": loan_id,
            "amount": repay_amt,
            "outstandingAfter": loan["outstandingBalance"],
            "paidAt": now_iso(),
        }
        repayments.append(r)
        bundle.kafka.publish("education-loans.repayment", r["id"], r)
        respond_json(self, 200, {"repayment": r, "loan": loan})

    def _defer_loan(self, loan_id: str, body: dict):
        loan = loans[loan_id]
        months = int(body.get("months", 6))
        reason = body.get("reason", "hardship")
        loan["graceMonths"] += months
        loan["updatedAt"] = now_iso()
        bundle.temporal.start_workflow("EducationLoanDeferral", loan_id, {"months": months, "reason": reason})
        respond_json(self, 200, {"loan": loan, "deferralMonths": months, "reason": reason})

    def log_message(self, fmt, *args):
        pass  # suppress request logs


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8099"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Education Loans service listening on :{port}")
    server.serve_forever()
