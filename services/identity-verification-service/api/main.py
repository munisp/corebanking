"""
Identity Verification Service
Integrations with NIMC, BVN, Nigerian Immigration, FRSC

Fail-closed behavior: if an identity provider (NIMC/NIBSS/Immigration/FRSC)
is unreachable or not configured, verification endpoints return HTTP 503 with
{"verified": None, "status": "provider_unavailable", "confidence": 0}.
No fallback path may ever produce a synthetic verification verdict.

Verdict honesty: an HTTP 200 from a provider is NOT proof of verification.
verified=True is set ONLY when the provider's response BODY explicitly affirms
the match via a documented verdict field (see extract_provider_verdict):
  - body["status"] == "verified"  (string, case-insensitive), or
  - body["match"] is True         (boolean), or
  - body["verified"] is True      (boolean)
An explicit negative verdict yields verified=False/status="not_verified".
An ambiguous or absent verdict yields verified=None/status="indeterminate" —
callers must NOT treat it as a pass.
"""

import os
import json
import httpx
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import structlog

logger = structlog.get_logger()

audit_log = []

app = FastAPI(
    title="54link-dev Identity Verification Service",
    description="NIMC, BVN, Passport, FRSC verification",
    version="1.0.0"
)

# API Configuration
NIMC_API_URL = os.getenv("NIMC_API_URL", "https://api.nimc.gov.ng/v1")
NIMC_API_KEY = os.getenv("NIMC_API_KEY", "")
BVN_API_URL = os.getenv("BVN_API_URL", "https://api.nibss.com/bvn/v1")
BVN_API_KEY = os.getenv("BVN_API_KEY", "")
IMMIGRATION_API_URL = os.getenv("IMMIGRATION_API_URL", "https://api.immigration.gov.ng/v1")
IMMIGRATION_API_KEY = os.getenv("IMMIGRATION_API_KEY", "")
FRSC_API_URL = os.getenv("FRSC_API_URL", "https://api.frsc.gov.ng/v1")
FRSC_API_KEY = os.getenv("FRSC_API_KEY", "")

PROVIDER_UNAVAILABLE_BODY = {
    "verified": None,
    "status": "provider_unavailable",
    "confidence": 0,
}

# Explicit negative verdict strings (anything else string-valued is ambiguous).
_NEGATIVE_VERDICTS = {"not_verified", "unverified", "rejected", "no_match", "failed", "mismatch"}


def extract_provider_verdict(data: Any) -> Optional[bool]:
    """Parse the provider's verification verdict from its response body.

    Returns True  — only on an EXPLICIT affirmation:
                    status == "verified", or match is True, or verified is True.
    Returns False — on an explicit negative (status in a known negative set,
                    or match/verified explicitly False).
    Returns None  — ambiguous or absent verdict; callers must report
                    verified=None, status="indeterminate" and never treat the
                    identity as verified.
    """
    if not isinstance(data, dict):
        return None
    status = data.get("status")
    if isinstance(status, str):
        s = status.strip().lower()
        if s == "verified":
            return True
        if s in _NEGATIVE_VERDICTS:
            return False
    for key in ("match", "verified"):
        val = data.get(key)
        if isinstance(val, bool):
            return val
    return None


class ProviderUnavailableError(Exception):
    """Raised when an identity provider cannot be reached. Carries the source."""

    def __init__(self, source: str, detail: str):
        self.source = source
        self.detail = detail
        super().__init__(f"{source} provider unavailable: {detail}")


class NINVerificationRequest(BaseModel):
    nin: str  # 11-digit National Identification Number
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None

class BVNVerificationRequest(BaseModel):
    bvn: str  # 11-digit Bank Verification Number
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None

class PassportVerificationRequest(BaseModel):
    passport_number: str
    surname: Optional[str] = None
    given_names: Optional[str] = None

class DriversLicenseVerificationRequest(BaseModel):
    license_number: str
    date_of_birth: Optional[str] = None

async def persist_verification_audit(record: Dict[str, Any]):
    audit_log.append(record)
    if len(audit_log) > 1000:
        del audit_log[0 : len(audit_log) - 1000]


async def call_provider(url: str, payload: Dict[str, Any], auth_key: str, source: str) -> Dict[str, Any]:
    """Call a real identity provider.

    verified=True is returned ONLY when the provider's response body contains
    an explicit affirmative verdict (see extract_provider_verdict) — never on
    HTTP 200 alone. Ambiguous/absent verdict -> verified=None with
    status="indeterminate". Provider unreachable -> raises
    ProviderUnavailableError (callers translate to HTTP 503). Confidence comes
    only from the provider's own match_score and only for affirmed verdicts;
    it is None otherwise.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {auth_key}",
                    "Content-Type": "application/json",
                },
                timeout=20.0,
            )
        if response.status_code == 200:
            try:
                data = response.json()
            except Exception:
                data = {}
            verdict = extract_provider_verdict(data)
            return {
                "verified": verdict,  # True only on explicit body affirmation
                "status": "verified" if verdict is True else ("not_verified" if verdict is False else "indeterminate"),
                "provider_status": response.status_code,
                "provider_data": data,
                "source": source,
                "fallback": False,
                "confidence_score": data.get("match_score") if verdict is True else None,
            }
        # Non-200: the provider responded but did not affirm the identity.
        return {
            "verified": False,
            "status": "not_verified",
            "provider_status": response.status_code,
            "provider_data": response.json() if response.content else {},
            "source": source,
            "fallback": False,
            "confidence_score": None,
        }
    except ProviderUnavailableError:
        raise
    except Exception as exc:
        logger.error("provider_call_failed", source=source, url=url, error=str(exc))
        raise ProviderUnavailableError(source, str(exc))


def provider_unavailable_response(exc: ProviderUnavailableError) -> HTTPException:
    detail = dict(PROVIDER_UNAVAILABLE_BODY)
    detail["source"] = exc.source
    return HTTPException(status_code=503, detail=detail)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "identity-verification-service"}


@app.get("/ready")
async def readiness_check():
    checks = {
        "nimc_configured": bool(NIMC_API_URL),
        "bvn_configured": bool(BVN_API_URL),
        "immigration_configured": bool(IMMIGRATION_API_URL),
        "frsc_configured": bool(FRSC_API_URL),
    }
    return {"status": "ready", "checks": checks, "service": "identity-verification-service"}


@app.get("/api/v1/verify/audit")
async def get_verification_audit(limit: int = 50):
    bounded = max(1, min(limit, 200))
    return {"records": audit_log[-bounded:], "total": min(len(audit_log), bounded)}

@app.post("/api/v1/verify/nin")
async def verify_nin(request: NINVerificationRequest, x_tenant_id: str = Header(...)):
    payload = {
        "nin": request.nin,
        "first_name": request.first_name,
        "last_name": request.last_name,
        "date_of_birth": request.date_of_birth,
    }
    try:
        provider = await call_provider(f"{NIMC_API_URL}/verify", payload, NIMC_API_KEY, "NIMC")
    except ProviderUnavailableError as exc:
        raise provider_unavailable_response(exc)
    response = {
        "verified": provider["verified"],
        "status": provider.get("status"),
        "nin": request.nin,
        "full_name": provider.get("provider_data", {}).get("full_name"),
        "date_of_birth": provider.get("provider_data", {}).get("date_of_birth") or request.date_of_birth,
        "gender": provider.get("provider_data", {}).get("gender"),
        "state_of_origin": provider.get("provider_data", {}).get("state_of_origin"),
        "lga_of_origin": provider.get("provider_data", {}).get("lga_of_origin"),
        "verification_date": datetime.utcnow().isoformat(),
        "source": provider["source"],
        "confidence_score": provider.get("confidence_score"),
        "fallback": provider.get("fallback", False),
    }
    await persist_verification_audit({"tenant_id": x_tenant_id, "type": "nin", "request": payload, "response": response, "timestamp": response["verification_date"]})
    return response

@app.post("/api/v1/verify/bvn")
async def verify_bvn(request: BVNVerificationRequest, x_tenant_id: str = Header(...)):
    payload = {
        "bvn": request.bvn,
        "first_name": request.first_name,
        "last_name": request.last_name,
        "date_of_birth": request.date_of_birth,
    }
    try:
        provider = await call_provider(f"{BVN_API_URL}/verify", payload, BVN_API_KEY, "NIBSS_BVN")
    except ProviderUnavailableError as exc:
        raise provider_unavailable_response(exc)
    response = {
        "verified": provider["verified"],
        "status": provider.get("status"),
        "bvn": request.bvn,
        "full_name": provider.get("provider_data", {}).get("full_name"),
        "date_of_birth": provider.get("provider_data", {}).get("date_of_birth") or request.date_of_birth,
        "phone_number": provider.get("provider_data", {}).get("phone_number"),
        "email": provider.get("provider_data", {}).get("email"),
        "verification_date": datetime.utcnow().isoformat(),
        "source": provider["source"],
        "confidence_score": provider.get("confidence_score"),
        "fallback": provider.get("fallback", False),
    }
    await persist_verification_audit({"tenant_id": x_tenant_id, "type": "bvn", "request": payload, "response": response, "timestamp": response["verification_date"]})
    return response

@app.post("/api/v1/verify/passport")
async def verify_passport(request: PassportVerificationRequest, x_tenant_id: str = Header(...)):
    payload = {
        "passport_number": request.passport_number,
        "surname": request.surname,
        "given_names": request.given_names,
    }
    try:
        provider = await call_provider(f"{IMMIGRATION_API_URL}/verify", payload, IMMIGRATION_API_KEY, "NIGERIAN_IMMIGRATION")
    except ProviderUnavailableError as exc:
        raise provider_unavailable_response(exc)
    response = {
        "verified": provider["verified"],
        "status": provider.get("status"),
        "passport_number": request.passport_number,
        "surname": provider.get("provider_data", {}).get("surname") or request.surname,
        "given_names": provider.get("provider_data", {}).get("given_names") or request.given_names,
        "date_of_birth": provider.get("provider_data", {}).get("date_of_birth"),
        "nationality": provider.get("provider_data", {}).get("nationality"),
        "issue_date": provider.get("provider_data", {}).get("issue_date"),
        "expiry_date": provider.get("provider_data", {}).get("expiry_date"),
        "verification_date": datetime.utcnow().isoformat(),
        "source": provider["source"],
        "confidence_score": provider.get("confidence_score"),
        "fallback": provider.get("fallback", False),
    }
    await persist_verification_audit({"tenant_id": x_tenant_id, "type": "passport", "request": payload, "response": response, "timestamp": response["verification_date"]})
    return response

@app.post("/api/v1/verify/drivers-license")
async def verify_drivers_license(request: DriversLicenseVerificationRequest, x_tenant_id: str = Header(...)):
    payload = {
        "license_number": request.license_number,
        "date_of_birth": request.date_of_birth,
    }
    try:
        provider = await call_provider(f"{FRSC_API_URL}/verify", payload, FRSC_API_KEY, "FRSC")
    except ProviderUnavailableError as exc:
        raise provider_unavailable_response(exc)
    response = {
        "verified": provider["verified"],
        "status": provider.get("status"),
        "license_number": request.license_number,
        "full_name": provider.get("provider_data", {}).get("full_name"),
        "date_of_birth": provider.get("provider_data", {}).get("date_of_birth") or request.date_of_birth,
        "issue_date": provider.get("provider_data", {}).get("issue_date"),
        "expiry_date": provider.get("provider_data", {}).get("expiry_date"),
        "license_class": provider.get("provider_data", {}).get("license_class"),
        "verification_date": datetime.utcnow().isoformat(),
        "source": provider["source"],
        "confidence_score": provider.get("confidence_score"),
        "fallback": provider.get("fallback", False),
    }
    await persist_verification_audit({"tenant_id": x_tenant_id, "type": "drivers_license", "request": payload, "response": response, "timestamp": response["verification_date"]})
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8022)
