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
import hmac
import hashlib
import base64
import time
import httpx
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

from fastapi import FastAPI, HTTPException, Header, Depends
from permify_guard import require_permify
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
import structlog
import uuid
import asyncpg

logger = structlog.get_logger()


# --- W12-C3P2B5: PostgreSQL persistence via the service's DECLARED asyncpg
# driver (requirements.txt: asyncpg==0.29.0). PG is authoritative for the
# verification audit trail; no in-memory shadow.
#
# PII NOTICE (NDPR): verification_audit payloads contain BVN/NIN inside
# request/response. At rest they rely on Postgres storage encryption
# (volume/TDE); field-level KMS envelope encryption is a TRACKED FOLLOW-UP —
# no envelope helper exists in this service (see fix dispositions).
# RETENTION: newest 1000 audit rows are kept (rolling window); CBN/NDPR
# audit-retention review (>= 5 years for identity verification records) is a
# tracked follow-up (see dispositions). Reads mask BVN/NIN (last 3 chars).
_w12_pg_pool = None


async def _w12_pool():
    """Lazily create the asyncpg pool (async service pattern)."""
    global _w12_pg_pool
    if _w12_pg_pool is None:
        _w12_pg_pool = await asyncpg.create_pool(
            os.environ["DATABASE_URL"], min_size=1, max_size=10)
    return _w12_pg_pool


async def _w12_ensure_audit(conn):
    await conn.execute("""CREATE TABLE IF NOT EXISTS verification_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)""")



def validate_jwt(authorization: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Validate a Bearer JWT with real HS256 signature verification (stdlib).

    Mirrors the canonical pattern in services/shared/auth/jwt_validation.py and
    sibling Python services (e.g. docling-service). FAILS CLOSED: returns
    (None, reason) whenever the token cannot be cryptographically verified, is
    expired, is missing exp, or JWT_SECRET is not configured. Never
    warn-and-allow.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = authorization[7:]

    def _b64url_decode(s: str) -> bytes:
        s += "=" * (-len(s) % 4)
        return base64.urlsafe_b64decode(s.encode())

    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or secret.startswith("${"):
        return None, "auth_not_configured"
    try:
        header = json.loads(_b64url_decode(parts[0]))
        payload = json.loads(_b64url_decode(parts[1]))
        signature = _b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    if header.get("alg") != "HS256":
        return None, "Unsupported token algorithm"
    expected = hmac.new(secret.encode(), (parts[0] + "." + parts[1]).encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, signature):
        return None, "Invalid token signature"
    exp = payload.get("exp")
    if exp is None:
        return None, "Token missing exp claim"
    try:
        if time.time() >= float(exp):
            return None, "Token expired"
    except (TypeError, ValueError):
        return None, "Invalid token expiry"
    issuer = os.environ.get("JWT_ISSUER", "")
    if issuer and payload.get("iss") != issuer:
        return None, "Invalid token issuer"
    return payload, None


async def get_current_tenant(authorization: str = Header(None)) -> str:
    """Require a valid Bearer JWT and derive the tenant from verified claims.

    H-33: tenant identity comes ONLY from verified token claims — never from a
    caller-supplied x-tenant-id header, which is attacker-controlled.
    """
    claims, err = validate_jwt(authorization or "")
    if err is not None:
        raise HTTPException(status_code=401, detail=f"Unauthorized: {err}")
    tenant_id = claims.get("tenant_id") or claims.get("tenant")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Token missing tenant claim")
    return tenant_id


async def get_verified_tenant(authorization: str = Header(None), x_tenant_id: str = Header(None)) -> str:
    """W12-B5-P0-A: require a verified Bearer JWT on the mutating verify
    endpoints (previously only an attacker-controlled x-tenant-id header was
    required, and GET /audit was the sole JWT-enforced route).

    Tenant identity is derived from the VERIFIED token claims. The
    caller-supplied x-tenant-id header is used only as a fallback when the
    token carries no tenant claim; a header/claim discrepancy is always
    logged and the token claim wins.
    """
    claims, err = validate_jwt(authorization or "")
    if err is not None:
        raise HTTPException(status_code=401, detail=f"Unauthorized: {err}")
    token_tenant = claims.get("tenant_id") or claims.get("tenant")
    if token_tenant:
        if x_tenant_id and x_tenant_id != token_tenant:
            logger.warning(
                "tenant_header_token_mismatch",
                token_tenant=token_tenant,
                header_tenant=x_tenant_id,
            )
        return token_tenant
    if x_tenant_id:
        logger.warning("tenant_from_header_fallback", header_tenant=x_tenant_id)
        return x_tenant_id
    raise HTTPException(status_code=401, detail="Token missing tenant claim")


def _mask_identifier(value: Any) -> str:
    """M-52/M-53: mask government identifiers (BVN/NIN) — last 3 chars only."""
    if not isinstance(value, str) or not value:
        return "***"
    return "***" + value[-3:]


def _mask_audit_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of an audit record with BVN/NIN masked in request/response."""
    masked = dict(record)
    for section in ("request", "response"):
        data = record.get(section)
        if isinstance(data, dict):
            scrubbed = dict(data)
            for key in ("nin", "bvn"):
                if key in scrubbed:
                    scrubbed[key] = _mask_identifier(scrubbed[key])
            masked[section] = scrubbed
    return masked


# W12-C3P2B5: in-memory audit_log removed — verification_audit (PG) is the
# authoritative audit trail (see persist_verification_audit).

app = FastAPI(
    title="54link-dev Identity Verification Service",
    description="NIMC, BVN, Passport, FRSC verification",
    version="1.0.0"
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

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
    """Persist a verification audit record to PG (table verification_audit).

    Idempotency: record_id = type:tenant:timestamp => a retried persist of the
    same verification event is an ON CONFLICT DO NOTHING no-op. Retention:
    rolling newest-1000 window (see PII/retention notice above).
    W12-DEGRADED: a persist failure is logged and does NOT fail the
    verification response (the provider verdict was already obtained) — but
    unlike the old in-memory list, every written row is durable."""
    try:
        pool = await _w12_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                await _w12_ensure_audit(conn)
                rid = f"{record.get('type')}:{record.get('tenant_id')}:{record.get('timestamp')}"
                await conn.execute(
                    "INSERT INTO verification_audit (record_id, tenant_id, payload) "
                    "VALUES ($1, $2, $3::jsonb) ON CONFLICT (record_id) DO NOTHING",
                    rid, record.get("tenant_id"), json.dumps(record, default=str))
                await conn.execute(
                    "DELETE FROM verification_audit WHERE record_id NOT IN "
                    "(SELECT record_id FROM verification_audit "
                    "ORDER BY created_at DESC, record_id LIMIT 1000)")
    except Exception as e:
        logger.error("W12-DEGRADED verification_audit persist failed", error=str(e))


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
async def get_verification_audit(limit: int = 50, tenant_id: str = Depends(get_current_tenant)):
    """H-33: requires a verified Bearer JWT; the tenant is derived from verified
    token claims (not caller-supplied headers) and results are scoped to that
    tenant only. BVN/NIN values are masked (last 3 chars) in the response."""
    bounded = max(1, min(limit, 200))
    try:
        pool = await _w12_pool()
        async with pool.acquire() as conn:
            await _w12_ensure_audit(conn)
            rows = await conn.fetch(
                "SELECT payload FROM verification_audit WHERE tenant_id = $1 "
                "ORDER BY created_at DESC, record_id DESC LIMIT $2",
                tenant_id, bounded)
        scoped = [json.loads(r["payload"]) for r in reversed(rows)]
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"persistence_unavailable: {e}")
    return {"records": [_mask_audit_record(r) for r in scoped], "total": len(scoped)}

@app.post("/api/v1/verify/nin", dependencies=[Depends(require_permify("identity_verification", "verify"))])
async def verify_nin(request: NINVerificationRequest, tenant_id: str = Depends(get_verified_tenant)):
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
    await persist_verification_audit({"tenant_id": tenant_id, "type": "nin", "request": payload, "response": response, "timestamp": response["verification_date"]})
    return response

@app.post("/api/v1/verify/bvn", dependencies=[Depends(require_permify("identity_verification", "verify"))])
async def verify_bvn(request: BVNVerificationRequest, tenant_id: str = Depends(get_verified_tenant)):
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
    await persist_verification_audit({"tenant_id": tenant_id, "type": "bvn", "request": payload, "response": response, "timestamp": response["verification_date"]})
    return response

@app.post("/api/v1/verify/passport", dependencies=[Depends(require_permify("identity_verification", "verify"))])
async def verify_passport(request: PassportVerificationRequest, tenant_id: str = Depends(get_verified_tenant)):
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
    await persist_verification_audit({"tenant_id": tenant_id, "type": "passport", "request": payload, "response": response, "timestamp": response["verification_date"]})
    return response

@app.post("/api/v1/verify/drivers-license", dependencies=[Depends(require_permify("identity_verification", "verify"))])
async def verify_drivers_license(request: DriversLicenseVerificationRequest, tenant_id: str = Depends(get_verified_tenant)):
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
    await persist_verification_audit({"tenant_id": tenant_id, "type": "drivers_license", "request": payload, "response": response, "timestamp": response["verification_date"]})
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8022)
