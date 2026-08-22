"""
NFIU CTR/STR Filing Service — Production Implementation

Generates FATF goAML-compliant XML filings for the Nigeria Financial
Intelligence Unit (NFIU) per CBN AML/CFT Regulations 2022 and NFIU
goAML Filing Guide v3.0:

  CTR (Currency Transaction Report):
    • Individual: transactions ≥ ₦5,000,000
    • Corporate:  transactions ≥ ₦10,000,000
    • Deadline:   same business day (by 23:59)

  STR (Suspicious Transaction Report):
    • Any amount — triggered by AML rules or manual referral
    • Deadline:   within 72 hours of detection
    • Tipping-off restriction enforced

XML Format: FATF goAML v3.1 (NFIU-adapted)
Submission:  HTTPS POST to NFIU goAML portal
SLA:        Tracked per filing; breach alerts sent via Dapr pub/sub

Port: 8283

Required environment variables:
  DATABASE_URL        — PostgreSQL DSN
  GOAML_API_URL       — NFIU goAML portal endpoint
  GOAML_API_KEY       — NFIU API key / bearer token
  GOAML_BANK_CODE     — CBN bank code (e.g. "044" for Access Bank)
  GOAML_REPORTER_NAME — Registered institution name in goAML
  DAPR_URL            — Dapr sidecar URL (default: http://localhost:3500)
  DAPR_PUBSUB         — Dapr pub/sub component (default: nfiu-pubsub)
"""

from __future__ import annotations

import os
import uuid
import logging
import asyncio
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from contextlib import asynccontextmanager
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString

import asyncpg
import httpx
from fastapi import FastAPI, HTTPException, Header, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("nfiu-ctr-str")

# ── Configuration ──────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "")
GOAML_API_URL = os.getenv("GOAML_API_URL", "").rstrip("/")
GOAML_API_KEY = os.getenv("GOAML_API_KEY", "")
GOAML_BANK_CODE = os.getenv("GOAML_BANK_CODE", "054")
GOAML_REPORTER_NAME = os.getenv("GOAML_REPORTER_NAME", "54link-dev")
DAPR_URL = os.getenv("DAPR_URL", "http://localhost:3500").rstrip("/")
DAPR_PUBSUB = os.getenv("DAPR_PUBSUB", "nfiu-pubsub")

# CBN AML thresholds (in kobo)
CTR_INDIVIDUAL_THRESHOLD_KOBO = 500_000_000   # ₦5,000,000
CTR_CORPORATE_THRESHOLD_KOBO  = 1_000_000_000 # ₦10,000,000
STR_SLA_HOURS = 72
CTR_SLA_EOD = True  # CTR must be filed same business day

_CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",")
    if o.strip()
]

# ── Database pool ──────────────────────────────────────────────────────────────

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return _pool


async def init_db(dsn: str) -> asyncpg.Pool:
    pool = await asyncpg.create_pool(dsn, min_size=2, max_size=10, command_timeout=30)
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS nfiu_ctrs (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id       TEXT NOT NULL,
                customer_id     TEXT NOT NULL,
                customer_name   TEXT NOT NULL,
                customer_type   TEXT NOT NULL CHECK (customer_type IN ('individual', 'corporate')),
                customer_bvn    TEXT,
                customer_nin    TEXT,
                transaction_id  TEXT NOT NULL,
                transaction_type TEXT NOT NULL,
                amount_kobo     BIGINT NOT NULL,
                currency        TEXT NOT NULL DEFAULT 'NGN',
                channel         TEXT,
                branch_code     TEXT,
                branch_name     TEXT,
                teller_id       TEXT,
                teller_name     TEXT,
                counterparty_name TEXT,
                threshold_kobo  BIGINT NOT NULL,
                goaml_xml       TEXT,
                fiu_ref_no      TEXT UNIQUE,
                goaml_ref       TEXT,
                status          TEXT NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending','generating','generated','submitted','filed','failed')),
                filing_deadline TIMESTAMPTZ NOT NULL,
                filed_at        TIMESTAMPTZ,
                filed_by        TEXT,
                cbn_reference   TEXT,
                sla_breached    BOOLEAN NOT NULL DEFAULT false,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS nfiu_strs (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id       TEXT NOT NULL,
                customer_id     TEXT NOT NULL,
                customer_name   TEXT NOT NULL,
                customer_type   TEXT NOT NULL,
                customer_bvn    TEXT,
                reason          TEXT NOT NULL,
                category        TEXT NOT NULL,
                total_amount_kobo BIGINT NOT NULL,
                transaction_count INT NOT NULL,
                period_start    DATE NOT NULL,
                period_end      DATE NOT NULL,
                detection_method TEXT NOT NULL,
                rule_id         TEXT,
                risk_score      INT NOT NULL DEFAULT 0,
                risk_level      TEXT NOT NULL DEFAULT 'high',
                transaction_ids TEXT[] NOT NULL DEFAULT '{}',
                goaml_xml       TEXT,
                fiu_ref_no      TEXT UNIQUE,
                goaml_ref       TEXT,
                status          TEXT NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending','under_review','approved','submitted','filed','rejected','failed')),
                filing_deadline TIMESTAMPTZ NOT NULL,
                filed_at        TIMESTAMPTZ,
                reviewed_by     TEXT,
                approved_by     TEXT,
                cbn_reference   TEXT,
                sla_breached    BOOLEAN NOT NULL DEFAULT false,
                tipping_off_restricted BOOLEAN NOT NULL DEFAULT true,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS nfiu_audit_log (
                id          SERIAL PRIMARY KEY,
                tenant_id   TEXT NOT NULL,
                report_type TEXT NOT NULL,
                report_id   UUID NOT NULL,
                action      TEXT NOT NULL,
                detail      JSONB,
                performed_by TEXT NOT NULL DEFAULT 'system',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE INDEX IF NOT EXISTS idx_nfiu_ctrs_tenant ON nfiu_ctrs (tenant_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_nfiu_strs_tenant ON nfiu_strs (tenant_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_nfiu_ctrs_deadline ON nfiu_ctrs (filing_deadline, sla_breached, status);
            CREATE INDEX IF NOT EXISTS idx_nfiu_strs_deadline ON nfiu_strs (filing_deadline, sla_breached, status);
        """)
    return pool


# ── HTTP client ────────────────────────────────────────────────────────────────

_http: httpx.AsyncClient | None = None


def get_http() -> httpx.AsyncClient:
    if _http is None:
        raise RuntimeError("HTTP client not initialised")
    return _http


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pool, _http
    _http = httpx.AsyncClient(timeout=30.0)
    if DATABASE_URL:
        try:
            _pool = await init_db(DATABASE_URL)
            logger.info("Database pool initialised")
        except Exception as exc:
            logger.error("DB init failed: %s", exc)
    else:
        logger.warning("DATABASE_URL not set — reports will not be persisted")
    yield
    if _pool:
        await _pool.close()
    if _http:
        await _http.aclose()


app = FastAPI(
    title="54Link NFIU CTR/STR Filing",
    description="goAML-compliant Currency and Suspicious Transaction Report generation and submission",
    version="1.0.0",
    lifespan=lifespan,
)

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

# --- JWT enforcement middleware (finding N-1: fail-closed JWT auth on the live FastAPI path) ---
import inspect as _jwt_inspect
from starlette.middleware.base import BaseHTTPMiddleware as _JWTBaseHTTPMiddleware
from starlette.responses import JSONResponse as _JWTJSONResponse

# Probe endpoints are exempt; everything else requires a verifiable Bearer JWT.
_JWT_EXEMPT_PATHS = frozenset({"/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"})


def _jwt_set_scope_header(scope, name, value):
    """Overwrite (or remove, when value is None) a request header in the ASGI scope so
    downstream handlers see identity derived ONLY from verified token claims."""
    encoded = name.lower().encode("latin-1")
    headers = [(k, v) for k, v in scope.get("headers", []) if k != encoded]
    if value is not None:
        headers.append((encoded, str(value).encode("latin-1")))
    scope["headers"] = headers


class JWTAuthMiddleware(_JWTBaseHTTPMiddleware):
    """Fail-closed JWT authentication for all domain routes.

    Only the probe paths /health, /ready, /metrics (and their k8s variants
    /healthz, /readyz, /livez) plus CORS preflight (OPTIONS) are exempt. On
    success the verified claims are stored on request.state.jwt_claims and the
    tenant identity headers (x-tenant-id / x-tenant) in the ASGI scope are
    overwritten with the verified claim values, so downstream header readers
    receive ONLY the authenticated tenant. Failure: 401 JSON (503 when the JWKS
    endpoint is unreachable with a cold cache). Works with sync or async
    validate_jwt implementations.
    """

    async def dispatch(self, request, call_next):
        if request.method == "OPTIONS" or request.url.path in _JWT_EXEMPT_PATHS:
            return await call_next(request)
        try:
            if _jwt_inspect.iscoroutinefunction(validate_jwt):
                claims, err = await validate_jwt(request.headers)
            else:
                claims, err = validate_jwt(request.headers)
        except Exception as exc:
            return _JWTJSONResponse(status_code=503, content={"error": "auth_unavailable", "detail": str(exc)})
        if not claims:
            status = 503 if err == "jwks_unavailable" else 401
            return _JWTJSONResponse(status_code=status, content={"error": "unauthorized", "detail": err})
        request.state.jwt_claims = claims
        tenant = claims.get("tenant_id") or claims.get("tenant")
        _jwt_set_scope_header(request.scope, "x-tenant-id", tenant)
        _jwt_set_scope_header(request.scope, "x-tenant", tenant)
        subject = claims.get("sub") or claims.get("keycloak_id")
        if subject:
            _jwt_set_scope_header(request.scope, "x-keycloak-id", subject)
        return await call_next(request)


app.add_middleware(JWTAuthMiddleware)


app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── goAML XML generation ───────────────────────────────────────────────────────

def _xml_text(parent: Element, tag: str, text: str) -> Element:
    el = SubElement(parent, tag)
    el.text = text
    return el


def _pretty_xml(el: Element) -> str:
    raw = tostring(el, encoding="unicode", xml_declaration=False)
    dom = parseString(f'<?xml version="1.0" encoding="UTF-8"?>{raw}')
    return dom.toprettyxml(indent="  ", encoding=None)


def generate_ctr_xml(ctr: dict) -> str:
    """
    Generate FATF goAML v3.1 XML for a Currency Transaction Report.
    Schema follows the NFIU Nigeria goAML Filing Guide.
    """
    root = Element("goAML")
    root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")

    report = SubElement(root, "report")
    _xml_text(report, "rentity_id", GOAML_BANK_CODE)
    _xml_text(report, "rentity_branch", ctr.get("branch_code", "HQ"))
    _xml_text(report, "submission_code", "E")  # E = electronic
    _xml_text(report, "report_indicator", "A")
    _xml_text(report, "submission_date", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"))
    _xml_text(report, "currency_code_local", "NGN")
    _xml_text(report, "report_code", "CTR")
    _xml_text(report, "fiu_ref_no", ctr["fiu_ref_no"])
    _xml_text(report, "report_date_period",
              datetime.now(timezone.utc).strftime("%Y-%m-%d"))

    # Reporting institution
    rep_inst = SubElement(report, "reporting_institution")
    _xml_text(rep_inst, "institution_name", GOAML_REPORTER_NAME)
    _xml_text(rep_inst, "institution_code", GOAML_BANK_CODE)

    # Involved parties
    parties = SubElement(report, "involved_parties")
    party = SubElement(parties, "party")
    _xml_text(party, "party_type", "T")  # T = transaction subject

    if ctr["customer_type"] == "individual":
        person = SubElement(party, "person")
        names = ctr["customer_name"].split(" ", 2)
        _xml_text(person, "first_name", names[0])
        _xml_text(person, "last_name", names[-1])
        if ctr.get("customer_bvn"):
            ids = SubElement(person, "identification")
            _xml_text(ids, "id_type", "BVN")
            _xml_text(ids, "id_number", ctr["customer_bvn"])
        if ctr.get("customer_nin"):
            ids2 = SubElement(person, "identification")
            _xml_text(ids2, "id_type", "NIN")
            _xml_text(ids2, "id_number", ctr["customer_nin"])
    else:
        entity = SubElement(party, "entity")
        _xml_text(entity, "name", ctr["customer_name"])
        _xml_text(entity, "entity_type", "COMPANY")

    # Account
    account = SubElement(party, "account")
    _xml_text(account, "institution_name", GOAML_REPORTER_NAME)
    _xml_text(account, "account_number", ctr.get("customer_id", "N/A"))
    _xml_text(account, "currency_code", "NGN")

    # Transaction
    txn = SubElement(report, "transaction")
    _xml_text(txn, "transaction_number", ctr["transaction_id"])
    _xml_text(txn, "date_transaction",
              ctr.get("transaction_date", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")))
    _xml_text(txn, "transaction_type", ctr["transaction_type"].upper())

    if ctr.get("teller_name"):
        _xml_text(txn, "teller", ctr["teller_name"])

    amount_naira = str(Decimal(ctr["amount_kobo"]) / 100)
    _xml_text(txn, "transaction_location", ctr.get("branch_name", GOAML_REPORTER_NAME))

    currency_amount = SubElement(txn, "currency_amount")
    _xml_text(currency_amount, "transaction_amount", amount_naira)
    _xml_text(currency_amount, "currency_code", "NGN")

    return _pretty_xml(root)


def generate_str_xml(str_report: dict) -> str:
    """
    Generate FATF goAML v3.1 XML for a Suspicious Transaction Report.
    """
    root = Element("goAML")
    root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")

    report = SubElement(root, "report")
    _xml_text(report, "rentity_id", GOAML_BANK_CODE)
    _xml_text(report, "submission_code", "E")
    _xml_text(report, "report_indicator", "A")
    _xml_text(report, "submission_date",
              datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"))
    _xml_text(report, "currency_code_local", "NGN")
    _xml_text(report, "report_code", "STR")
    _xml_text(report, "fiu_ref_no", str_report["fiu_ref_no"])
    _xml_text(report, "report_date_period",
              str(str_report["period_end"]))

    rep_inst = SubElement(report, "reporting_institution")
    _xml_text(rep_inst, "institution_name", GOAML_REPORTER_NAME)
    _xml_text(rep_inst, "institution_code", GOAML_BANK_CODE)

    # Suspicious activity description
    activity = SubElement(report, "suspicious_activity")
    _xml_text(activity, "activity_type", str_report["category"].upper())
    _xml_text(activity, "description", str_report["reason"])
    _xml_text(activity, "risk_level", str_report["risk_level"].upper())
    _xml_text(activity, "risk_score", str(str_report["risk_score"]))

    # Involved party
    parties = SubElement(report, "involved_parties")
    party = SubElement(parties, "party")
    _xml_text(party, "party_type", "S")  # S = subject

    if str_report["customer_type"] == "individual":
        person = SubElement(party, "person")
        names = str_report["customer_name"].split(" ", 2)
        _xml_text(person, "first_name", names[0])
        _xml_text(person, "last_name", names[-1])
        if str_report.get("customer_bvn"):
            ids = SubElement(person, "identification")
            _xml_text(ids, "id_type", "BVN")
            _xml_text(ids, "id_number", str_report["customer_bvn"])
    else:
        entity = SubElement(party, "entity")
        _xml_text(entity, "name", str_report["customer_name"])
        _xml_text(entity, "entity_type", "COMPANY")

    # Aggregate transaction block
    total_naira = str(Decimal(str_report["total_amount_kobo"]) / 100)
    agg_txn = SubElement(report, "transaction")
    _xml_text(agg_txn, "transaction_type", "AGGREGATE")
    _xml_text(agg_txn, "transaction_count", str(str_report["transaction_count"]))
    currency_amount = SubElement(agg_txn, "currency_amount")
    _xml_text(currency_amount, "transaction_amount", total_naira)
    _xml_text(currency_amount, "currency_code", "NGN")

    # Individual transaction references
    for txn_id in str_report.get("transaction_ids", []):
        txn_ref = SubElement(report, "linked_transaction")
        _xml_text(txn_ref, "transaction_number", txn_id)

    return _pretty_xml(root)


# ── goAML submission to NFIU ───────────────────────────────────────────────────

async def submit_to_nfiu(xml_content: str, report_type: str, fiu_ref: str) -> dict:
    """
    POST the goAML XML to the NFIU portal.
    Returns the NFIU acknowledgement response.
    """
    if not GOAML_API_URL or not GOAML_API_KEY:
        raise ValueError(
            "GOAML_API_URL and GOAML_API_KEY must be configured for live NFIU submission"
        )

    url = f"{GOAML_API_URL}/api/reports/submit"
    headers = {
        "Authorization": f"Bearer {GOAML_API_KEY}",
        "Content-Type": "application/xml",
        "X-Report-Type": report_type,
        "X-FIU-Ref": fiu_ref,
    }
    resp = await get_http().post(url, content=xml_content.encode("utf-8"), headers=headers)
    if resp.status_code not in (200, 201, 202):
        raise ValueError(
            f"NFIU goAML submission failed HTTP {resp.status_code}: {resp.text[:500]}"
        )
    return resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"raw": resp.text}


# ── Dapr publishing ────────────────────────────────────────────────────────────

async def publish_event(topic: str, payload: dict) -> None:
    url = f"{DAPR_URL}/v1.0/publish/{DAPR_PUBSUB}/{topic}"
    try:
        resp = await get_http().post(url, json=payload)
        if resp.status_code >= 300:
            logger.warning("Dapr publish non-2xx topic=%s status=%d", topic, resp.status_code)
    except Exception as exc:
        logger.warning("Dapr publish failed topic=%s: %s", topic, exc)


# ── SLA helper ─────────────────────────────────────────────────────────────────

def ctr_deadline() -> datetime:
    """CTR must be filed by 23:59 of the same business day."""
    now = datetime.now(timezone.utc)
    return now.replace(hour=23, minute=59, second=59, microsecond=0)


def str_deadline() -> datetime:
    """STR must be filed within 72 hours of detection."""
    return datetime.now(timezone.utc) + timedelta(hours=STR_SLA_HOURS)


def next_ref(prefix: str) -> str:
    now = datetime.now(timezone.utc)
    return f"{GOAML_REPORTER_NAME}/{prefix}/{now.year}/{now.month:02d}/{uuid.uuid4().hex[:6].upper()}"


# ── Tenant header ──────────────────────────────────────────────────────────────

def require_tenant(x_tenant_id: str = Header(..., alias="x-tenant-id")) -> str:
    if not x_tenant_id.strip():
        raise HTTPException(status_code=400, detail="x-tenant-id header required")
    return x_tenant_id.strip()


# ── Request schemas ────────────────────────────────────────────────────────────

class CTRRequest(BaseModel):
    customer_id: str
    customer_name: str
    customer_type: str  # "individual" | "corporate"
    customer_bvn: Optional[str] = None
    customer_nin: Optional[str] = None
    transaction_id: str
    transaction_type: str
    amount_kobo: int
    currency: str = "NGN"
    channel: Optional[str] = None
    branch_code: Optional[str] = None
    branch_name: Optional[str] = None
    teller_id: Optional[str] = None
    teller_name: Optional[str] = None
    counterparty_name: Optional[str] = None

    @field_validator("customer_type")
    @classmethod
    def validate_customer_type(cls, v: str) -> str:
        if v not in ("individual", "corporate"):
            raise ValueError("customer_type must be 'individual' or 'corporate'")
        return v

    @field_validator("amount_kobo")
    @classmethod
    def validate_amount(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("amount_kobo must be positive")
        return v


class STRRequest(BaseModel):
    customer_id: str
    customer_name: str
    customer_type: str
    customer_bvn: Optional[str] = None
    reason: str
    category: str
    total_amount_kobo: int
    transaction_count: int
    period_start: date
    period_end: date
    detection_method: str
    rule_id: Optional[str] = None
    risk_score: int = 0
    risk_level: str = "high"
    transaction_ids: List[str] = []


# ── Background filing task ─────────────────────────────────────────────────────

async def _file_ctr_background(ctr_id: str, tenant_id: str) -> None:
    """Generate XML, submit to NFIU, update record status."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM nfiu_ctrs WHERE id=$1 AND tenant_id=$2", ctr_id, tenant_id
    )
    if not row:
        logger.error("CTR %s not found for background filing", ctr_id)
        return

    fiu_ref = row["fiu_ref_no"]
    ctr_dict = dict(row)
    ctr_dict["fiu_ref_no"] = fiu_ref

    try:
        xml_content = generate_ctr_xml(ctr_dict)
        await pool.execute(
            "UPDATE nfiu_ctrs SET goaml_xml=$1, status='generated' WHERE id=$2",
            xml_content, ctr_id,
        )

        if GOAML_API_URL and GOAML_API_KEY:
            result = await submit_to_nfiu(xml_content, "CTR", fiu_ref)
            goaml_ref = result.get("reference", result.get("raw", ""))
            await pool.execute(
                """UPDATE nfiu_ctrs
                   SET status='filed', filed_at=now(), filed_by='system',
                       goaml_ref=$1
                   WHERE id=$2""",
                str(goaml_ref), ctr_id,
            )
            await publish_event("nfiu.ctr-filed", {
                "tenantId": tenant_id, "ctrId": ctr_id,
                "fiuRef": fiu_ref, "goamlRef": str(goaml_ref),
            })
            logger.info("CTR %s filed to NFIU goaml_ref=%s", ctr_id, goaml_ref)
        else:
            logger.warning("CTR %s XML generated but GOAML_API_URL not configured — not submitted to NFIU", ctr_id)
            await pool.execute(
                "UPDATE nfiu_ctrs SET status='generated' WHERE id=$1", ctr_id
            )
    except Exception as exc:
        logger.error("CTR %s filing failed: %s", ctr_id, exc)
        await pool.execute(
            "UPDATE nfiu_ctrs SET status='failed' WHERE id=$1", ctr_id
        )
        await publish_event("nfiu.filing-failed", {
            "tenantId": tenant_id, "reportType": "CTR",
            "reportId": ctr_id, "error": str(exc),
        })


async def _file_str_background(str_id: str, tenant_id: str) -> None:
    """Generate XML for STR (after compliance review approval)."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM nfiu_strs WHERE id=$1 AND tenant_id=$2", str_id, tenant_id
    )
    if not row or row["status"] not in ("approved", "pending"):
        logger.error("STR %s not found or not approvable", str_id)
        return

    fiu_ref = row["fiu_ref_no"]
    str_dict = dict(row)

    try:
        xml_content = generate_str_xml(str_dict)
        await pool.execute(
            "UPDATE nfiu_strs SET goaml_xml=$1, status='submitted' WHERE id=$2",
            xml_content, str_id,
        )

        if GOAML_API_URL and GOAML_API_KEY:
            result = await submit_to_nfiu(xml_content, "STR", fiu_ref)
            goaml_ref = result.get("reference", result.get("raw", ""))
            await pool.execute(
                """UPDATE nfiu_strs
                   SET status='filed', filed_at=now(), goaml_ref=$1
                   WHERE id=$2""",
                str(goaml_ref), str_id,
            )
            await publish_event("nfiu.str-filed", {
                "tenantId": tenant_id, "strId": str_id,
                "fiuRef": fiu_ref, "goamlRef": str(goaml_ref),
            })
            logger.info("STR %s filed to NFIU goaml_ref=%s", str_id, goaml_ref)
    except Exception as exc:
        logger.error("STR %s filing failed: %s", str_id, exc)
        await pool.execute(
            "UPDATE nfiu_strs SET status='failed' WHERE id=$1", str_id
        )


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/healthz")
async def healthz():
    checks: dict = {}
    db_ok = False
    if _pool:
        try:
            await _pool.fetchval("SELECT 1")
            checks["postgres"] = "connected"
            db_ok = True
        except Exception as exc:
            checks["postgres"] = f"unreachable: {exc}"
    else:
        checks["postgres"] = "not configured"

    checks["goaml_configured"] = bool(GOAML_API_URL and GOAML_API_KEY)
    checks["bank_code"] = GOAML_BANK_CODE
    checks["reporter"] = GOAML_REPORTER_NAME

    return {
        "service": "nfiu-ctr-str-filing-py",
        "status": "healthy" if db_ok else "degraded",
        "checks": checks,
    }


@app.post("/api/ctrs", status_code=201)
async def create_ctr(
    body: CTRRequest,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(require_tenant),
    x_user_id: str = Header(default="system", alias="x-keycloak-id"),
):
    """
    Create a Currency Transaction Report.

    The threshold check is performed here. If the amount is below the CBN
    threshold for the customer type, a 422 is returned. The caller (AML engine
    or transaction monitor) is responsible for calling this only on qualifying
    transactions.

    After creation, XML generation and NFIU submission run in the background.
    """
    threshold = (
        CTR_INDIVIDUAL_THRESHOLD_KOBO
        if body.customer_type == "individual"
        else CTR_CORPORATE_THRESHOLD_KOBO
    )
    if body.amount_kobo < threshold:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Amount ₦{body.amount_kobo/100:,.2f} is below the CTR threshold "
                f"of ₦{threshold/100:,.2f} for {body.customer_type} customers"
            ),
        )

    pool = await get_pool()
    fiu_ref = next_ref("CTR")
    ctr_id = uuid.uuid4()
    deadline = ctr_deadline()

    await pool.execute(
        """
        INSERT INTO nfiu_ctrs
          (id, tenant_id, customer_id, customer_name, customer_type,
           customer_bvn, customer_nin, transaction_id, transaction_type,
           amount_kobo, currency, channel, branch_code, branch_name,
           teller_id, teller_name, counterparty_name, threshold_kobo,
           fiu_ref_no, filing_deadline, filed_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        """,
        ctr_id, tenant_id, body.customer_id, body.customer_name, body.customer_type,
        body.customer_bvn, body.customer_nin, body.transaction_id, body.transaction_type,
        body.amount_kobo, body.currency, body.channel, body.branch_code, body.branch_name,
        body.teller_id, body.teller_name, body.counterparty_name, threshold,
        fiu_ref, deadline, x_user_id,
    )

    await pool.execute(
        """INSERT INTO nfiu_audit_log (tenant_id, report_type, report_id, action, performed_by)
           VALUES ($1,'CTR',$2,'created',$3)""",
        tenant_id, ctr_id, x_user_id,
    )

    background_tasks.add_task(_file_ctr_background, str(ctr_id), tenant_id)

    await publish_event("nfiu.ctr-generated", {
        "tenantId": tenant_id, "ctrId": str(ctr_id),
        "customerId": body.customer_id, "amountKobo": body.amount_kobo,
        "fiuRef": fiu_ref,
    })

    return {
        "ctrId": str(ctr_id),
        "fiuRef": fiu_ref,
        "status": "pending",
        "filingDeadline": deadline.isoformat(),
        "message": "CTR created — XML generation and NFIU submission initiated",
    }


@app.post("/api/strs", status_code=201)
async def create_str(
    body: STRRequest,
    tenant_id: str = Depends(require_tenant),
    x_user_id: str = Header(default="system", alias="x-keycloak-id"),
):
    """
    File a Suspicious Transaction Report.

    STRs require compliance officer review before submission to NFIU.
    Status starts at 'pending' → 'under_review' → 'approved' → 'filed'.
    Use POST /api/strs/{id}/approve to advance the status.

    Tipping-off restriction is enforced: the customer must not be informed.
    """
    pool = await get_pool()
    fiu_ref = next_ref("STR")
    str_id = uuid.uuid4()
    deadline = str_deadline()

    await pool.execute(
        """
        INSERT INTO nfiu_strs
          (id, tenant_id, customer_id, customer_name, customer_type,
           customer_bvn, reason, category, total_amount_kobo, transaction_count,
           period_start, period_end, detection_method, rule_id,
           risk_score, risk_level, transaction_ids, fiu_ref_no, filing_deadline)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        """,
        str_id, tenant_id, body.customer_id, body.customer_name, body.customer_type,
        body.customer_bvn, body.reason, body.category, body.total_amount_kobo,
        body.transaction_count, body.period_start, body.period_end,
        body.detection_method, body.rule_id, body.risk_score, body.risk_level,
        body.transaction_ids, fiu_ref, deadline,
    )

    await pool.execute(
        """INSERT INTO nfiu_audit_log (tenant_id, report_type, report_id, action, performed_by)
           VALUES ($1,'STR',$2,'created',$3)""",
        tenant_id, str_id, x_user_id,
    )

    await publish_event("nfiu.str-generated", {
        "tenantId": tenant_id, "strId": str(str_id),
        "customerId": body.customer_id, "riskScore": body.risk_score,
        "category": body.category, "filingDeadline": deadline.isoformat(),
        "fiuRef": fiu_ref,
    })

    return {
        "strId": str(str_id),
        "fiuRef": fiu_ref,
        "status": "pending",
        "filingDeadline": deadline.isoformat(),
        "tippingOffRestriction": True,
        "message": "STR created — requires compliance review before NFIU submission",
    }


@app.post("/api/strs/{str_id}/approve")
async def approve_str(
    str_id: str,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(require_tenant),
    x_user_id: str = Header(default="officer", alias="x-keycloak-id"),
):
    """Compliance officer approves an STR for submission to NFIU."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT status, sla_breached, filing_deadline FROM nfiu_strs WHERE id=$1 AND tenant_id=$2",
        str_id, tenant_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="STR not found")
    if row["status"] not in ("pending", "under_review"):
        raise HTTPException(status_code=409, detail=f"STR is already in status '{row['status']}'")

    # Check SLA
    sla_ok = datetime.now(timezone.utc) <= row["filing_deadline"]
    if not sla_ok:
        await pool.execute(
            "UPDATE nfiu_strs SET sla_breached=true WHERE id=$1", str_id
        )
        await publish_event("nfiu.sla-breach", {
            "tenantId": tenant_id, "reportType": "STR", "reportId": str_id,
            "deadline": row["filing_deadline"].isoformat(),
        })
        logger.error("STR %s SLA BREACHED — filing after 72-hour deadline", str_id)

    await pool.execute(
        "UPDATE nfiu_strs SET status='approved', approved_by=$1, reviewed_by=$2 WHERE id=$3",
        x_user_id, x_user_id, str_id,
    )
    await pool.execute(
        """INSERT INTO nfiu_audit_log (tenant_id, report_type, report_id, action, detail, performed_by)
           VALUES ($1,'STR',$2,'approved',$3,$4)""",
        tenant_id, str_id, {"sla_ok": sla_ok}, x_user_id,
    )

    background_tasks.add_task(_file_str_background, str_id, tenant_id)

    return {"strId": str_id, "status": "approved", "slaOk": sla_ok}


@app.get("/api/ctrs")
async def list_ctrs(
    tenant_id: str = Depends(require_tenant),
    page: int = 1,
    limit: int = 50,
):
    pool = await get_pool()
    limit = min(limit, 200)
    offset = (page - 1) * limit
    rows = await pool.fetch(
        """SELECT id, customer_id, customer_name, customer_type, transaction_id,
                  amount_kobo, status, fiu_ref_no, goaml_ref, filing_deadline,
                  filed_at, sla_breached, created_at
           FROM nfiu_ctrs WHERE tenant_id=$1
           ORDER BY created_at DESC LIMIT $2 OFFSET $3""",
        tenant_id, limit, offset,
    )
    total = await pool.fetchval("SELECT COUNT(*) FROM nfiu_ctrs WHERE tenant_id=$1", tenant_id)
    return {"items": [dict(r) for r in rows], "total": total}


@app.get("/api/strs")
async def list_strs(
    tenant_id: str = Depends(require_tenant),
    page: int = 1,
    limit: int = 50,
):
    pool = await get_pool()
    limit = min(limit, 200)
    offset = (page - 1) * limit
    rows = await pool.fetch(
        """SELECT id, customer_id, customer_name, customer_type, category,
                  total_amount_kobo, risk_score, risk_level, status,
                  fiu_ref_no, goaml_ref, filing_deadline, filed_at,
                  sla_breached, tipping_off_restricted, created_at
           FROM nfiu_strs WHERE tenant_id=$1
           ORDER BY created_at DESC LIMIT $2 OFFSET $3""",
        tenant_id, limit, offset,
    )
    total = await pool.fetchval("SELECT COUNT(*) FROM nfiu_strs WHERE tenant_id=$1", tenant_id)
    return {"items": [dict(r) for r in rows], "total": total}


@app.get("/api/ctrs/{ctr_id}/xml")
async def get_ctr_xml(
    ctr_id: str,
    tenant_id: str = Depends(require_tenant),
):
    """Return the generated goAML XML for a CTR (for audit/download)."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT goaml_xml FROM nfiu_ctrs WHERE id=$1 AND tenant_id=$2", ctr_id, tenant_id
    )
    if not row or not row["goaml_xml"]:
        raise HTTPException(status_code=404, detail="CTR XML not yet generated")
    return Response(content=row["goaml_xml"], media_type="application/xml")


@app.get("/api/strs/{str_id}/xml")
async def get_str_xml(
    str_id: str,
    tenant_id: str = Depends(require_tenant),
):
    """Return the generated goAML XML for an STR."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT goaml_xml FROM nfiu_strs WHERE id=$1 AND tenant_id=$2", str_id, tenant_id
    )
    if not row or not row["goaml_xml"]:
        raise HTTPException(status_code=404, detail="STR XML not yet generated")
    return Response(content=row["goaml_xml"], media_type="application/xml")


@app.get("/api/dashboard")
async def dashboard(tenant_id: str = Depends(require_tenant)):
    pool = await get_pool()
    ctr_stats = await pool.fetchrow(
        """SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE status='filed') AS filed,
                  COUNT(*) FILTER (WHERE status IN ('pending','generating','generated')) AS pending,
                  COUNT(*) FILTER (WHERE sla_breached) AS sla_breaches
           FROM nfiu_ctrs WHERE tenant_id=$1""",
        tenant_id,
    )
    str_stats = await pool.fetchrow(
        """SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE status='filed') AS filed,
                  COUNT(*) FILTER (WHERE status='under_review') AS under_review,
                  COUNT(*) FILTER (WHERE status='approved') AS approved,
                  COUNT(*) FILTER (WHERE sla_breached) AS sla_breaches
           FROM nfiu_strs WHERE tenant_id=$1""",
        tenant_id,
    )
    return {
        "ctrs": dict(ctr_stats),
        "strs": dict(str_stats),
        "thresholds": {
            "individualCtrNgn": CTR_INDIVIDUAL_THRESHOLD_KOBO / 100,
            "corporateCtrNgn": CTR_CORPORATE_THRESHOLD_KOBO / 100,
            "strDeadlineHours": STR_SLA_HOURS,
        },
        "goamlConfigured": bool(GOAML_API_URL and GOAML_API_KEY),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8283"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")
