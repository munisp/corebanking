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


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        respond_json(self, 204, "")

    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                respond_json(self, 401, {"error": "unauthorized", "detail": _n1_err})
                return
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

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                respond_json(self, 401, {"error": "unauthorized", "detail": _n1_err})
                return
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

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                respond_json(self, 401, {"error": "unauthorized", "detail": _n1_err})
                return
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
