"""
Complete Fraud Detection Service - ML-based fraud scoring, pattern detection, real-time monitoring
Production-ready implementation with comprehensive fraud prevention
"""

from fastapi import FastAPI, HTTPException, Depends, Query, BackgroundTasks, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from audit_middleware import AuditMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from enum import Enum
from decimal import Decimal
import uvicorn
import asyncpg
import asyncio
import os
import sys
import json
import hashlib

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../shared/python'))

try:
    from services.common.lakehouse.lakehouse_publisher import LakehousePublisher
except ImportError:
    LakehousePublisher = None

from rust_risk_evaluator import build_risk_input, evaluate_risk, initialize_cli

# W12 B5-P1-F: real OpenSearch search for fraud alerts / blocked entities
# (replaces ILIKE substring scans). Stdlib-only client; sync calls are run
# via asyncio.to_thread. Import is side-effect free (env-only).
import opensearch_search as _os_search

app = FastAPI(
    title="54link-dev Fraud Detection Service",
    description="Complete fraud detection and prevention service",
    version="1.0.0"
)

# --- OpenTelemetry init (SPEC w9 §2.5): OTLP gRPC traces+metrics, W3C ---
# propagation, FastAPI server spans, TenantMiddleware (tenant.id span attr).
# Honors OTEL_SDK_DISABLED; never raises.
sys.path.insert(
    0,
    os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "shared", "otel", "python")
    ),
)
try:
    from otelkit import init_telemetry

    init_telemetry("fraud-service", app)
except Exception as _otel_exc:
    import logging as _otel_logging

    _otel_logging.getLogger("otel").warning("otelkit init skipped: %s", _otel_exc)

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
# --- Permify authorization (W12-B5-P0-D2) ---
# Every mutating handler performs a REAL Permify permission check AFTER
# JWTAuthMiddleware has authenticated the caller. Subject = verified JWT sub,
# tenant = verified tenant claim, resource = domain entity id, permission per
# action (schema entities: services/auth-service/schemas/permify/
# v2-kyc-compliance.fragment). FAIL-CLOSED: Permify unreachable/non-200 => 503;
# denied => 403. Canonical pattern: services/auth-service/adapters/permify.py
# check_permission (REST /v1/tenants/{tenant}/permissions/check).
import logging as _permify_logging
import json as _permify_json

import requests as _permify_requests


def _permify_http_post(url, payload):
    """POST a Permify check; returns (status, json_body) or None on transport error."""
    try:
        resp = _permify_requests.post(url, json=payload, timeout=5)
        try:
            return resp.status_code, resp.json()
        except Exception:
            return resp.status_code, None
    except Exception as exc:
        _permify_logger.error("permify check unreachable: %s", exc)
        return None

_PERMIFY_URL = os.getenv("PERMIFY_URL", "http://permify:3476").rstrip("/")
_PERMIFY_DEFAULT_TENANT = os.getenv("PERMIFY_DEFAULT_TENANT", "bpmgd")
_permify_logger = _permify_logging.getLogger(__name__)


def permify_authorize(request, entity_type, entity_id, permission):
    """Enforce <permission> on entity_type:entity_id for the JWT-verified caller.

    Raises HTTPException(403) on denial and HTTPException(503) when Permify is
    unreachable or errors (fail-closed). Returns True when allowed.
    """
    claims = getattr(request.state, "jwt_claims", None) or {}
    subject = claims.get("sub") or claims.get("keycloak_id") or ""
    tenant_id = claims.get("tenant_id") or claims.get("tenant") or _PERMIFY_DEFAULT_TENANT
    entity_id = str(entity_id or "")
    if not subject or not entity_id:
        raise HTTPException(status_code=403, detail="authorization context incomplete")
    payload = {
        "metadata": {"schema_version": "", "snap_token": "", "depth": 20},
        "entity": {"type": entity_type, "id": entity_id},
        "permission": permission,
        "subject": {"type": "user", "id": subject},
    }
    url = f"{_PERMIFY_URL}/v1/tenants/{tenant_id}/permissions/check"
    resp = _permify_http_post(url, payload)
    if resp is None:
        raise HTTPException(status_code=503, detail="authorization_unavailable: permify unreachable (fail-closed)")
    status, body = resp
    if status != 200:
        _permify_logger.error("permify check %s on %s:%s http=%s", permission, entity_type, entity_id, status)
        raise HTTPException(status_code=503, detail="authorization_unavailable: permify check failed (fail-closed)")
    can = (body or {}).get("can")
    allowed = can == "CHECK_RESULT_ALLOWED" or can is True
    if not allowed:
        raise HTTPException(status_code=403, detail=f"permify: {permission} denied on {entity_type}:{entity_id}")
    return True



allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "https://app.54link-dev.internal,https://admin.54link-dev.internal,https://pwa.54link-dev.internal").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-Id"],
)

app.add_middleware(AuditMiddleware)
db_pool = None
fraud_lakehouse = None

# Enums
class FraudRiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class FraudType(str, Enum):
    ACCOUNT_TAKEOVER = "account_takeover"
    IDENTITY_THEFT = "identity_theft"
    CARD_FRAUD = "card_fraud"
    TRANSACTION_FRAUD = "transaction_fraud"
    MONEY_LAUNDERING = "money_laundering"
    PHISHING = "phishing"
    SYNTHETIC_IDENTITY = "synthetic_identity"

class ActionType(str, Enum):
    ALLOW = "allow"
    REVIEW = "review"
    BLOCK = "block"
    CHALLENGE = "challenge"

# Models
class TransactionCheck(BaseModel):
    transaction_id: str
    customer_id: str
    tenant_id: str
    amount: Decimal
    currency: str
    merchant_id: Optional[str] = None
    transaction_type: str
    device_fingerprint: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[Dict] = None
    metadata: Optional[Dict] = None

class FraudRule(BaseModel):
    tenant_id: str
    rule_name: str
    rule_type: str
    conditions: Dict
    risk_level: FraudRiskLevel
    action: ActionType
    is_active: bool = True

class DeviceFingerprint(BaseModel):
    customer_id: str
    device_id: str
    device_type: str
    os: str
    browser: str
    ip_address: str
    location: Optional[Dict] = None
    is_trusted: bool = False


def publish_lakehouse_event(event_type: str, tenant_id: str, entity_id: str, payload: Dict, customer_id: Optional[str] = None, entity_type: str = "fraud_event"):
    if not fraud_lakehouse:
        return
    fraud_lakehouse.publish_event(
        event_type=event_type,
        payload=payload,
        tenant_id=tenant_id,
        user_id=customer_id,
        entity_id=entity_id,
        entity_type=entity_type,
    )

@app.on_event("startup")
async def startup():
    global db_pool, fraud_lakehouse
    # W11 PY-003: locate/build the Rust CLI evaluator binary ONCE at startup
    # (in a thread, off the event loop) instead of `cargo run` per request.
    # If unavailable it is marked as such honestly — no mock scores.
    await asyncio.to_thread(initialize_cli)
    db_host = os.getenv("DB_HOST", "postgres")
    db_port = int(os.getenv("DB_PORT", "5432"))
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "postgres")
    db_name = os.getenv("DB_NAME", "fraud_db")

    try:
        db_pool = await asyncpg.create_pool(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database=db_name,
            min_size=5,
            max_size=20
        )

        if LakehousePublisher:
            fraud_lakehouse = LakehousePublisher(
                service_name="fraud-service",
                table_name="bronze.fraud_service_events",
            )

        async with db_pool.acquire() as conn:
            await conn.execute("""
            CREATE TABLE IF NOT EXISTS fraud_checks (
                id SERIAL PRIMARY KEY,
                check_id VARCHAR(50) UNIQUE NOT NULL,
                transaction_id VARCHAR(50) NOT NULL,
                customer_id VARCHAR(50) NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                fraud_score INT NOT NULL,
                risk_level VARCHAR(20) NOT NULL,
                fraud_indicators JSONB,
                recommended_action VARCHAR(20) NOT NULL,
                final_decision VARCHAR(20),
                decided_by VARCHAR(255),
                check_duration_ms INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_fraud_transaction ON fraud_checks(transaction_id);
            CREATE INDEX IF NOT EXISTS idx_fraud_customer ON fraud_checks(customer_id);
            CREATE INDEX IF NOT EXISTS idx_fraud_risk ON fraud_checks(risk_level);
            
            CREATE TABLE IF NOT EXISTS fraud_rules (
                id SERIAL PRIMARY KEY,
                rule_id VARCHAR(50) UNIQUE NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                rule_name VARCHAR(255) NOT NULL,
                rule_type VARCHAR(50) NOT NULL,
                conditions JSONB NOT NULL,
                risk_level VARCHAR(20) NOT NULL,
                action VARCHAR(20) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                triggered_count INT DEFAULT 0,
                last_triggered_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_rules_tenant ON fraud_rules(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_rules_active ON fraud_rules(is_active);
            
            CREATE TABLE IF NOT EXISTS device_fingerprints (
                id SERIAL PRIMARY KEY,
                fingerprint_id VARCHAR(50) UNIQUE NOT NULL,
                customer_id VARCHAR(50) NOT NULL,
                device_id VARCHAR(255) NOT NULL,
                device_type VARCHAR(50),
                os VARCHAR(100),
                browser VARCHAR(100),
                ip_address VARCHAR(50),
                location JSONB,
                is_trusted BOOLEAN DEFAULT false,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                usage_count INT DEFAULT 1
            );
            
            CREATE INDEX IF NOT EXISTS idx_device_customer ON device_fingerprints(customer_id);
            CREATE INDEX IF NOT EXISTS idx_device_id ON device_fingerprints(device_id);
            
            CREATE TABLE IF NOT EXISTS fraud_patterns (
                id SERIAL PRIMARY KEY,
                pattern_id VARCHAR(50) UNIQUE NOT NULL,
                pattern_name VARCHAR(255) NOT NULL,
                pattern_type VARCHAR(50) NOT NULL,
                pattern_definition JSONB NOT NULL,
                severity VARCHAR(20) NOT NULL,
                detection_count INT DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS fraud_alerts (
                id SERIAL PRIMARY KEY,
                alert_id VARCHAR(50) UNIQUE NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                customer_id VARCHAR(50),
                alert_type VARCHAR(50) NOT NULL,
                severity VARCHAR(20) NOT NULL,
                description TEXT NOT NULL,
                related_entities JSONB,
                status VARCHAR(20) DEFAULT 'open',
                assigned_to VARCHAR(255),
                resolved_at TIMESTAMP,
                resolution_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON fraud_alerts(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_alerts_status ON fraud_alerts(status);
            
            CREATE TABLE IF NOT EXISTS blocked_entities (
                id SERIAL PRIMARY KEY,
                entity_id VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                reason TEXT NOT NULL,
                blocked_by VARCHAR(255),
                blocked_until TIMESTAMP,
                is_permanent BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_blocked_entity ON blocked_entities(entity_id, entity_type);
            
            CREATE TABLE IF NOT EXISTS fraud_ml_features (
                id SERIAL PRIMARY KEY,
                customer_id VARCHAR(50) NOT NULL,
                feature_name VARCHAR(100) NOT NULL,
                feature_value DECIMAL(15,4),
                calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_ml_customer ON fraud_ml_features(customer_id);

            CREATE TABLE IF NOT EXISTS fraud_cases (
                id SERIAL PRIMARY KEY,
                case_id VARCHAR(50) UNIQUE NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                source_alert_id VARCHAR(50),
                source_check_id VARCHAR(50),
                customer_id VARCHAR(50),
                status VARCHAR(20) NOT NULL DEFAULT 'open',
                priority VARCHAR(20) NOT NULL DEFAULT 'normal',
                assigned_to VARCHAR(255),
                summary TEXT NOT NULL,
                findings JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_fraud_cases_tenant ON fraud_cases(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_fraud_cases_status ON fraud_cases(status);
        """)

        print("Fraud detection service started successfully")

        # W12 B5-P1-F: backfill the OpenSearch fraud-alerts / blocked-entities
        # indices from Postgres (source of truth) in the background. Failure
        # is not fatal: search endpoints lazily re-sync and fail closed (503)
        # when a search is requested and the cluster is unreachable.
        asyncio.create_task(_boot_opensearch_sync())
    except Exception as exc:
        print(f"WARNING: DB initialisation failed: {exc}", file=sys.stderr)
        print("Service will start without DB — endpoints will return 503 until DB is reachable", file=sys.stderr)


# ── W12 B5-P1-F: OpenSearch fraud-alerts / blocked-entities sync ──
_os_sync_state: dict = {"synced_at": None, "alerts": 0, "blocked": 0}
_os_sync_lock = asyncio.Lock()


async def sync_fraud_indices(force: bool = False) -> dict:
    """Bulk-index real fraud_alerts / blocked_entities rows into OpenSearch.

    Source of truth: the Postgres tables (the exact data the retired ILIKE
    queries read). Idempotent via natural _ids (alert_id;
    tenant:entity_type:entity_id). Runs once per process unless forced
    (POST /api/v1/fraud/opensearch/reindex). Raises on cluster failure."""
    if not force and _os_sync_state["synced_at"]:
        return {"status": "already_synced",
                "alerts": _os_sync_state["alerts"],
                "blocked": _os_sync_state["blocked"],
                "syncedAt": _os_sync_state["synced_at"].isoformat()}
    async with _os_sync_lock:
        if not force and _os_sync_state["synced_at"]:
            return {"status": "already_synced",
                    "alerts": _os_sync_state["alerts"],
                    "blocked": _os_sync_state["blocked"],
                    "syncedAt": _os_sync_state["synced_at"].isoformat()}
        if not db_pool:
            raise _os_search.OpenSearchUnavailable(
                "database pool unavailable — cannot read source tables for sync")
        await asyncio.to_thread(_os_search.ensure_index, _os_search.ALERTS_INDEX)
        await asyncio.to_thread(_os_search.ensure_index, _os_search.BLOCKED_INDEX)
        async with db_pool.acquire() as conn:
            alert_rows = await conn.fetch(
                "SELECT alert_id, tenant_id, customer_id, alert_type, severity, "
                "description, related_entities, status, assigned_to, "
                "resolution_notes, created_at, resolved_at FROM fraud_alerts")
            blocked_rows = await conn.fetch(
                "SELECT entity_id, entity_type, tenant_id, reason, blocked_by, "
                "blocked_until, is_permanent, created_at FROM blocked_entities")
        alert_docs = [_os_search.alert_doc(
            r["alert_id"], r["tenant_id"], r["customer_id"], r["alert_type"],
            r["severity"], r["description"], r["related_entities"], r["status"],
            r["assigned_to"], r["resolution_notes"], r["created_at"], r["resolved_at"])
            for r in alert_rows]
        blocked_docs = [_os_search.blocked_doc(
            r["entity_id"], r["entity_type"], r["tenant_id"], r["reason"],
            r["blocked_by"], r["blocked_until"], r["is_permanent"], r["created_at"])
            for r in blocked_rows]
        if alert_docs:
            await asyncio.to_thread(
                _os_search.bulk_index, _os_search.ALERTS_INDEX, alert_docs)
        if blocked_docs:
            await asyncio.to_thread(
                _os_search.bulk_index, _os_search.BLOCKED_INDEX, blocked_docs)
        _os_sync_state["synced_at"] = datetime.now()
        _os_sync_state["alerts"] = len(alert_docs)
        _os_sync_state["blocked"] = len(blocked_docs)
        return {"status": "synced", "alerts": len(alert_docs),
                "blocked": len(blocked_docs),
                "syncedAt": _os_sync_state["synced_at"].isoformat()}


async def _ensure_fraud_indices_synced() -> None:
    if not _os_sync_state["synced_at"]:
        await sync_fraud_indices()


async def _boot_opensearch_sync():
    try:
        print(f"[fraud-service] opensearch sync: {await sync_fraud_indices()}")
    except Exception as e:
        print(f"[fraud-service] opensearch boot sync deferred: {e}", file=sys.stderr)


@app.post("/api/v1/fraud/opensearch/reindex")
async def reindex_fraud_opensearch():
    """W12 B5-P1-F admin endpoint: force a full fraud_alerts + blocked_entities
    -> OpenSearch resync (idempotent, natural _id). Fail closed: 503 when the
    cluster or the source tables are unavailable."""
    try:
        return await sync_fraud_indices(force=True)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"fraud opensearch reindex failed: {e}")

@app.on_event("shutdown")
async def shutdown():
    global db_pool
    if db_pool:
        await db_pool.close()

@app.get("/health")
async def health_check():
    """W12 B5-P1-F: report REAL OpenSearch cluster reachability (alert/blocked
    search depends on it) instead of a static payload."""
    os_ok, os_detail = await asyncio.to_thread(_os_search.ping)
    return {
        "status": "healthy" if os_ok else "degraded",
        "service": "fraud-service",
        "components": {
            "opensearch": {"status": "connected" if os_ok else "unavailable",
                           **({"detail": os_detail} if os_detail else {})},
        },
    }

@app.get("/ready")
async def readiness_check():
    return {"status": "ready", "service": "fraud-service"}

# Fraud Check Endpoints
@app.post("/api/v1/fraud/check")
async def check_transaction(
    request: Request,
    check: TransactionCheck,
    background_tasks: BackgroundTasks,
    db=Depends(lambda: db_pool)
):
    """Perform real-time fraud check on transaction"""
    permify_authorize(request, "fraud_case", check.transaction_id, "score")
    start_time = datetime.now()
    check_id = f"FRD{int(start_time.timestamp())}"
    
    # Calculate fraud score
    fraud_score = 0
    fraud_indicators = []
    
    async with db.acquire() as conn:
        # Check 1: Amount-based risk
        if check.amount > 1000000:  # 1M threshold
            fraud_score += 30
            fraud_indicators.append("high_transaction_amount")
        
        # Check 2: Velocity check - transactions in last hour
        recent_txns = await conn.fetchval("""
            SELECT COUNT(*) FROM fraud_checks
            WHERE customer_id = $1
                AND created_at >= $2
        """, check.customer_id, datetime.now() - timedelta(hours=1))
        
        if recent_txns > 10:
            fraud_score += 25
            fraud_indicators.append("high_transaction_velocity")
        
        # Check 3: Device fingerprint
        if check.device_fingerprint:
            device = await conn.fetchrow("""
                SELECT * FROM device_fingerprints
                WHERE device_id = $1 AND customer_id = $2
            """, check.device_fingerprint, check.customer_id)
            
            if not device:
                fraud_score += 20
                fraud_indicators.append("unknown_device")
            elif not device['is_trusted']:
                fraud_score += 10
                fraud_indicators.append("untrusted_device")
        
        # Check 4: IP address reputation
        if check.ip_address:
            # Check if IP is blocked
            blocked = await conn.fetchrow("""
                SELECT * FROM blocked_entities
                WHERE entity_id = $1 AND entity_type = 'ip_address'
                    AND (blocked_until IS NULL OR blocked_until > CURRENT_TIMESTAMP)
            """, check.ip_address)
            
            if blocked:
                fraud_score += 50
                fraud_indicators.append("blocked_ip_address")
        
        # Check 5: Location anomaly
        if check.location:
            # Get customer's usual locations
            usual_locations = await conn.fetch("""
                SELECT DISTINCT location FROM device_fingerprints
                WHERE customer_id = $1 AND location IS NOT NULL
                LIMIT 5
            """, check.customer_id)
            
            # Simplified location check
            if len(usual_locations) > 0:
                # In production, would do proper geo-distance calculation
                fraud_score += 15
                fraud_indicators.append("unusual_location")
        
        # Check 6: Time-based patterns
        hour = datetime.now().hour
        if hour >= 2 and hour <= 5:  # Late night transactions
            fraud_score += 10
            fraud_indicators.append("unusual_time")
        
        # Check 7: Evaluate against custom rules
        rules = await conn.fetch("""
            SELECT * FROM fraud_rules
            WHERE tenant_id = $1 AND is_active = true
        """, check.tenant_id)
        
        for rule in rules:
            conditions = json.loads(rule['conditions'])
            if evaluate_fraud_rule(check, conditions):
                fraud_score += 20
                fraud_indicators.append(f"rule_triggered:{rule['rule_name']}")
                
                # Update rule trigger count
                await conn.execute("""
                    UPDATE fraud_rules
                    SET triggered_count = triggered_count + 1,
                        last_triggered_at = CURRENT_TIMESTAMP
                    WHERE rule_id = $1
                """, rule['rule_id'])
        
        # W11 PY-002: evaluate_risk blocks (requests.post + CLI fallback) —
        # run it off the event loop.
        rust_risk = await asyncio.to_thread(evaluate_risk, build_risk_input(
            transaction_id=check.transaction_id,
            tenant_id=check.tenant_id,
            customer_id=check.customer_id,
            amount=check.amount,
            velocity_last_hour=recent_txns,
            unknown_device=(not check.device_fingerprint) or (check.device_fingerprint and 'unknown_device' in fraud_indicators),
            blocked_ip='blocked_ip_address' in fraud_indicators,
            geo_distance_km=600.0 if 'unusual_location' in fraud_indicators else 0.0,
            account_age_days=1,
            chargeback_ratio=0.0,
            merchant_risk=0.2,
            hour_of_day=hour,
            event_time=start_time,
        ))
        fraud_score = min(100, max(fraud_score, int(rust_risk.get('score', 0))))
        for indicator in rust_risk.get('indicators', []):
            if indicator not in fraud_indicators:
                fraud_indicators.append(indicator)

        # Determine risk level and action
        if fraud_score >= 80:
            risk_level = "critical"
            action = "block"
        elif fraud_score >= 55:
            risk_level = "high"
            action = "challenge"
        elif fraud_score >= 30:
            risk_level = "medium"
            action = "review"
        else:
            risk_level = "low"
            action = "allow"
        
        # Calculate check duration
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        
        # Save fraud check
        await conn.execute("""
            INSERT INTO fraud_checks (
                check_id, transaction_id, customer_id, tenant_id, fraud_score,
                risk_level, fraud_indicators, recommended_action, check_duration_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """, check_id, check.transaction_id, check.customer_id, check.tenant_id,
            fraud_score, risk_level, json.dumps(fraud_indicators), action, duration_ms)
        
        # Create alert for high-risk transactions
        if risk_level in ["high", "critical"]:
            alert_id = f"FRDA{int(datetime.now().timestamp())}"
            await conn.execute("""
                INSERT INTO fraud_alerts (
                    alert_id, tenant_id, customer_id, alert_type, severity,
                    description, related_entities, status
                ) VALUES ($1, $2, $3, 'high_risk_transaction', $4, $5, $6, 'open')
            """, alert_id, check.tenant_id, check.customer_id, risk_level,
                f"High-risk transaction detected (score: {fraud_score})",
                json.dumps({
                    "transaction_id": check.transaction_id,
                    "check_id": check_id,
                    "indicators": fraud_indicators
                }))

            # W12 B5-P1-F: dual-write the alert into the fraud-alerts
            # OpenSearch index in the same flow (natural _id = alert_id).
            # Postgres stays the source of truth; a failed index write is
            # logged and backfilled by the boot sync / reindex endpoint.
            try:
                doc_id, doc = _os_search.alert_doc(
                    alert_id, check.tenant_id, check.customer_id,
                    "high_risk_transaction", risk_level,
                    f"High-risk transaction detected (score: {fraud_score})",
                    {"transaction_id": check.transaction_id,
                     "check_id": check_id, "indicators": fraud_indicators},
                    "open", created_at=datetime.now())
                await asyncio.to_thread(_os_search.ensure_index, _os_search.ALERTS_INDEX)
                await asyncio.to_thread(
                    _os_search.index_doc, _os_search.ALERTS_INDEX, doc_id, doc)
            except Exception as _os_exc:
                print(f"[fraud-service] alert dual-write to opensearch failed "
                      f"(resync will backfill): {_os_exc}", file=sys.stderr)

        # Update ML features in background
        background_tasks.add_task(update_ml_features, check.customer_id, check)

    publish_lakehouse_event(
        "FRAUD_CHECK_COMPLETED",
        check.tenant_id,
        check_id,
        {
            "transaction_id": check.transaction_id,
            "fraud_score": fraud_score,
            "risk_level": risk_level,
            "recommended_action": action,
            "fraud_indicators": fraud_indicators,
            "check_duration_ms": duration_ms,
        },
        customer_id=check.customer_id,
        entity_type="fraud_check",
    )
    if risk_level in ["high", "critical"]:
        publish_lakehouse_event(
            "FRAUD_ALERT_CREATED",
            check.tenant_id,
            alert_id,
            {
                "transaction_id": check.transaction_id,
                "check_id": check_id,
                "severity": risk_level,
                "fraud_score": fraud_score,
                "fraud_indicators": fraud_indicators,
            },
            customer_id=check.customer_id,
            entity_type="fraud_alert",
        )
    
    return {
        "check_id": check_id,
        "transaction_id": check.transaction_id,
        "fraud_score": fraud_score,
        "risk_level": risk_level,
        "recommended_action": action,
        "fraud_indicators": fraud_indicators,
        "check_duration_ms": duration_ms,
        "checked_at": datetime.now()
    }

def evaluate_fraud_rule(check: TransactionCheck, conditions: Dict) -> bool:
    """Evaluate if transaction matches fraud rule conditions"""
    # Amount threshold
    if "amount_threshold" in conditions:
        if check.amount > Decimal(str(conditions["amount_threshold"])):
            return True
    
    # Transaction type
    if "transaction_types" in conditions:
        if check.transaction_type in conditions["transaction_types"]:
            return True
    
    # Currency
    if "currencies" in conditions:
        if check.currency in conditions["currencies"]:
            return True
    
    return False

async def update_ml_features(customer_id: str, check: TransactionCheck):
    """Background task to update ML features"""
    async with db_pool.acquire() as conn:
        # Calculate various features
        features = {
            "avg_transaction_amount": float(check.amount),
            "transaction_count_24h": 1,
            "unique_merchants_30d": 1,
            "avg_time_between_txns": 3600.0
        }
        
        for feature_name, feature_value in features.items():
            await conn.execute("""
                INSERT INTO fraud_ml_features (customer_id, feature_name, feature_value)
                VALUES ($1, $2, $3)
            """, customer_id, feature_name, Decimal(str(feature_value)))

@app.get("/api/v1/fraud/check/{check_id}")
async def get_fraud_check(check_id: str, db=Depends(lambda: db_pool)):
    """Get fraud check details"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM fraud_checks WHERE check_id = $1
        """, check_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Fraud check not found")
        
        return dict(row)

@app.get("/api/v1/fraud/checks/transaction/{transaction_id}")
async def get_transaction_checks(
    transaction_id: str,
    db=Depends(lambda: db_pool)
):
    """Get all fraud checks for a transaction"""
    async with db.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM fraud_checks
            WHERE transaction_id = $1
            ORDER BY created_at DESC
        """, transaction_id)
        
        return {
            "transaction_id": transaction_id,
            "checks": [dict(row) for row in rows],
            "total": len(rows)
        }

@app.post("/api/v1/fraud/check/{check_id}/decide")
async def make_fraud_decision(
    request: Request,
    check_id: str,
    decision: ActionType,
    decided_by: str,
    notes: Optional[str] = None,
    db=Depends(lambda: db_pool)
):
    """Make final decision on fraud check"""
    permify_authorize(request, "fraud_case", check_id, "decide")
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE fraud_checks
            SET final_decision = $1, decided_by = $2
            WHERE check_id = $3
            RETURNING transaction_id, customer_id
        """, decision.value, decided_by, check_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Fraud check not found")
        
        # If blocking, add to blocked entities
        if decision == ActionType.BLOCK:
            await conn.execute("""
                INSERT INTO blocked_entities (
                    entity_id, entity_type, tenant_id, reason, blocked_by
                )
                SELECT customer_id, 'customer', tenant_id, $1, $2
                FROM fraud_checks WHERE check_id = $3
            """, notes or "Fraud detected", decided_by, check_id)
        
        return {
            "status": "decided",
            "check_id": check_id,
            "decision": decision.value,
            "decided_by": decided_by,
            "decided_at": datetime.now()
        }

# Fraud Rules Endpoints
@app.post("/api/v1/fraud/rules")
async def create_fraud_rule(
    request: Request,
    rule: FraudRule,
    db=Depends(lambda: db_pool)
):
    """Create fraud detection rule"""
    permify_authorize(request, "fraud_rule", rule.tenant_id, "manage")
    rule_id = f"FRDR{int(datetime.now().timestamp())}"
    
    async with db.acquire() as conn:
        await conn.execute("""
            INSERT INTO fraud_rules (
                rule_id, tenant_id, rule_name, rule_type, conditions,
                risk_level, action, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """, rule_id, rule.tenant_id, rule.rule_name, rule.rule_type,
            json.dumps(rule.conditions), rule.risk_level.value,
            rule.action.value, rule.is_active)

    publish_lakehouse_event(
        "FRAUD_RULE_CREATED",
        rule.tenant_id,
        rule_id,
        {
            "rule_name": rule.rule_name,
            "rule_type": rule.rule_type,
            "risk_level": rule.risk_level.value,
            "action": rule.action.value,
            "is_active": rule.is_active,
        },
        entity_type="fraud_rule",
    )
    
    return {
        "status": "created",
        "rule_id": rule_id,
        "rule_name": rule.rule_name,
        "created_at": datetime.now()
    }


@app.get("/api/v1/fraud/rules")
async def list_fraud_rules(
    tenant_id: str = Query(..., alias="tenantId"),
    active_only: bool = Query(True, alias="activeOnly"),
    db=Depends(lambda: db_pool)
):
    """List fraud detection rules"""
    query = "SELECT * FROM fraud_rules WHERE tenant_id = $1"
    
    if active_only:
        query += " AND is_active = true"
    
    query += " ORDER BY created_at DESC"
    
    async with db.acquire() as conn:
        rows = await conn.fetch(query, tenant_id)
        return {
            "tenant_id": tenant_id,
            "rules": [dict(row) for row in rows],
            "total": len(rows)
        }   
    


_CARD_RULE_TYPES = ["velocity", "geolocation", "amount", "merchant_category", "time_based"]


class CardFraudRulePayload(BaseModel):
    name: str
    ruleType: str
    threshold: Optional[float] = None
    action: str
    enabled: bool = True


def _format_card_rule(row: dict) -> dict:
    cond = row.get("conditions") or {}
    if isinstance(cond, str):
        cond = json.loads(cond)
    return {
        "id": row["rule_id"],
        "name": row["rule_name"],
        "ruleType": row["rule_type"],
        "threshold": cond.get("threshold"),
        "action": row["action"],
        "enabled": row["is_active"],
        "triggeredCount": row.get("triggered_count", 0),
    }


@app.get("/api/v1/fraud/rules/card")
async def list_card_fraud_rules(
    db=Depends(lambda: db_pool),
    tenant_id: str = Query(..., alias="tenantId"),
):
    async with db.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM fraud_rules WHERE tenant_id=$1 AND rule_type=ANY($2) ORDER BY created_at DESC",
            tenant_id, _CARD_RULE_TYPES,
        )
    items = [_format_card_rule(dict(r)) for r in rows]
    return {"items": items, "total": len(items)}


@app.post("/api/v1/fraud/rules/card")
async def create_card_fraud_rule(
    request: Request,
    rule: CardFraudRulePayload,
    db=Depends(lambda: db_pool),
    tenant_id: str = Query(..., alias="tenantId"),
):
    permify_authorize(request, "fraud_rule", tenant_id, "manage")
    rule_id = f"CFR{int(datetime.now().timestamp())}"
    async with db.acquire() as conn:
        await conn.execute(
            """INSERT INTO fraud_rules (rule_id, tenant_id, rule_name, rule_type, conditions, risk_level, action, is_active)
               VALUES ($1, $2, $3, $4, $5, 'medium', $6, $7)""",
            rule_id, tenant_id, rule.name, rule.ruleType,
            json.dumps({"threshold": rule.threshold}), rule.action, rule.enabled,
        )
    return {
        "id": rule_id, "name": rule.name, "ruleType": rule.ruleType,
        "threshold": rule.threshold, "action": rule.action,
        "enabled": rule.enabled, "triggeredCount": 0,
    }


@app.put("/api/v1/fraud/rules/card/{rule_id}")
async def update_card_fraud_rule(
    request: Request,
    rule_id: str,
    rule: CardFraudRulePayload,
    db=Depends(lambda: db_pool),
    tenant_id: str = Query(..., alias="tenantId"),
):
    permify_authorize(request, "fraud_rule", rule_id, "manage")
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE fraud_rules
               SET rule_name=$1, rule_type=$2, conditions=$3, action=$4, is_active=$5, updated_at=CURRENT_TIMESTAMP
               WHERE rule_id=$6 AND tenant_id=$7
               RETURNING *""",
            rule.name, rule.ruleType, json.dumps({"threshold": rule.threshold}),
            rule.action, rule.enabled, rule_id, tenant_id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    return _format_card_rule(dict(row))


@app.delete("/api/v1/fraud/rules/card/{rule_id}")
async def delete_card_fraud_rule(
    request: Request,
    rule_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Query(..., alias="tenantId"),
):
    permify_authorize(request, "fraud_rule", rule_id, "manage")
    async with db.acquire() as conn:
        await conn.execute(
            "DELETE FROM fraud_rules WHERE rule_id=$1 AND tenant_id=$2",
            rule_id, tenant_id,
        )
    return {"status": "deleted", "rule_id": rule_id}


@app.get("/api/v1/fraud/rules/{tenant_id}")
async def list_fraud_rules(
    tenant_id: str,
    active_only: bool = True,
    db=Depends(lambda: db_pool)
):
    """List fraud detection rules"""
    query = "SELECT * FROM fraud_rules WHERE tenant_id = $1"
    
    if active_only:
        query += " AND is_active = true"
    
    query += " ORDER BY created_at DESC"
    
    async with db.acquire() as conn:
        rows = await conn.fetch(query, tenant_id)
        return {
            "tenant_id": tenant_id,
            "rules": [dict(row) for row in rows],
            "total": len(rows)
        }

@app.post("/api/v1/fraud/rules/{rule_id}/toggle")
async def toggle_fraud_rule(
    request: Request,
    rule_id: str,
    is_active: bool,
    db=Depends(lambda: db_pool)
):
    """Toggle fraud rule active status"""
    permify_authorize(request, "fraud_rule", rule_id, "toggle")
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE fraud_rules
            SET is_active = $1, updated_at = CURRENT_TIMESTAMP
            WHERE rule_id = $2
            RETURNING rule_id
        """, is_active, rule_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Rule not found")

    publish_lakehouse_event(
        "FRAUD_RULE_TOGGLED",
        "global",
        rule_id,
        {
            "is_active": is_active,
        },
        entity_type="fraud_rule",
    )

    return {
        "status": "updated",
        "rule_id": rule_id,
        "is_active": is_active
    }

# Device Management Endpoints
@app.post("/api/v1/fraud/devices/register")
async def register_device(
    request: Request,
    device: DeviceFingerprint,
    db=Depends(lambda: db_pool)
):
    """Register device fingerprint"""
    permify_authorize(request, "fraud_device", device.device_id, "register")
    fingerprint_id = f"DEV{int(datetime.now().timestamp())}"
    
    async with db.acquire() as conn:
        # Check if device exists
        existing = await conn.fetchrow("""
            SELECT * FROM device_fingerprints
            WHERE device_id = $1 AND customer_id = $2
        """, device.device_id, device.customer_id)
        
        if existing:
            # Update last seen
            await conn.execute("""
                UPDATE device_fingerprints
                SET last_seen = CURRENT_TIMESTAMP,
                    usage_count = usage_count + 1
                WHERE device_id = $1 AND customer_id = $2
            """, device.device_id, device.customer_id)
            
            publish_lakehouse_event(
                "DEVICE_FINGERPRINT_SEEN",
                "global",
                existing['fingerprint_id'],
                {
                    "customer_id": device.customer_id,
                    "device_id": device.device_id,
                    "is_known": True,
                    "is_trusted": existing['is_trusted'],
                },
                customer_id=device.customer_id,
                entity_type="device_fingerprint",
            )
            return {
                "status": "updated",
                "fingerprint_id": existing['fingerprint_id'],
                "is_known": True
            }
        else:
            # Register new device
            await conn.execute("""
                INSERT INTO device_fingerprints (
                    fingerprint_id, customer_id, device_id, device_type,
                    os, browser, ip_address, location, is_trusted
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, fingerprint_id, device.customer_id, device.device_id,
                device.device_type, device.os, device.browser, device.ip_address,
                json.dumps(device.location or {}), device.is_trusted)
            
            publish_lakehouse_event(
                "DEVICE_FINGERPRINT_REGISTERED",
                "global",
                fingerprint_id,
                {
                    "customer_id": device.customer_id,
                    "device_id": device.device_id,
                    "device_type": device.device_type,
                    "is_trusted": device.is_trusted,
                },
                customer_id=device.customer_id,
                entity_type="device_fingerprint",
            )
            return {
                "status": "registered",
                "fingerprint_id": fingerprint_id,
                "is_known": False
            }

@app.get("/api/v1/fraud/devices/customer/{customer_id}")
async def list_customer_devices(
    customer_id: str,
    db=Depends(lambda: db_pool)
):
    """List devices for customer"""
    async with db.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM device_fingerprints
            WHERE customer_id = $1
            ORDER BY last_seen DESC
        """, customer_id)
        
        return {
            "customer_id": customer_id,
            "devices": [dict(row) for row in rows],
            "total": len(rows)
        }

@app.post("/api/v1/fraud/devices/{fingerprint_id}/trust")
async def trust_device(
    request: Request,
    fingerprint_id: str,
    is_trusted: bool,
    db=Depends(lambda: db_pool)
):
    """Mark device as trusted/untrusted"""
    permify_authorize(request, "fraud_device", fingerprint_id, "trust")
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE device_fingerprints
            SET is_trusted = $1
            WHERE fingerprint_id = $2
            RETURNING fingerprint_id
        """, is_trusted, fingerprint_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Device not found")
        
        return {
            "status": "updated",
            "fingerprint_id": fingerprint_id,
            "is_trusted": is_trusted
        }

# Fraud Alerts Endpoints
@app.get("/api/v1/fraud/alerts/{tenant_id}")
async def list_fraud_alerts(
    tenant_id: str,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(lambda: db_pool)
):
    """List fraud alerts.

    W12 B5-P1-F: the `search` parameter is served by a real OpenSearch query
    (multi-field match + fuzziness=AUTO over customer_id / description /
    alert_type, tenant-filtered, SCREENING_MIN_SCORE threshold) instead of
    ILIKE substring scans. Search returns relevance-ordered alert_ids which
    are hydrated from Postgres (source of truth), so the response contract is
    unchanged. Fail closed: 503 when search is requested and the cluster is
    unreachable — never a silent unfiltered/substring fallback."""
    if search:
        try:
            await _ensure_fraud_indices_synced()
            alert_ids = await asyncio.to_thread(
                _os_search.search_alert_ids, tenant_id, search)
        except _os_search.OpenSearchUnavailable as e:
            raise HTTPException(
                status_code=503,
                detail=f"fraud alert search backend unavailable: {e}")
        if not alert_ids:
            return {"tenant_id": tenant_id, "alerts": [], "total": 0}

        query = "SELECT * FROM fraud_alerts WHERE tenant_id = $1 AND alert_id = ANY($2::varchar[])"
        params: list = [tenant_id, alert_ids]
        param_count = 3
        if status:
            query += f" AND status = ${param_count}"
            params.append(status)
            param_count += 1
        if severity:
            query += f" AND severity = ${param_count}"
            params.append(severity)
            param_count += 1
        async with db.acquire() as conn:
            rows = await conn.fetch(query, *params)
        # Relevance order from OpenSearch, then the same page contract
        # (skip/limit, total = page size) as the SQL path.
        order = {aid: i for i, aid in enumerate(alert_ids)}
        rows = sorted(rows, key=lambda r: order.get(r["alert_id"], len(order)))
        page = rows[skip:skip + limit]
        return {
            "tenant_id": tenant_id,
            "alerts": [dict(row) for row in page],
            "total": len(page)
        }

    query = "SELECT * FROM fraud_alerts WHERE tenant_id = $1"
    params = [tenant_id]
    param_count = 2

    if status:
        query += f" AND status = ${param_count}"
        params.append(status)
        param_count += 1

    if severity:
        query += f" AND severity = ${param_count}"
        params.append(severity)
        param_count += 1

    query += f" ORDER BY created_at DESC LIMIT ${param_count} OFFSET ${param_count + 1}"
    params.extend([limit, skip])

    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return {
            "tenant_id": tenant_id,
            "alerts": [dict(row) for row in rows],
            "total": len(rows)
        }

@app.post("/api/v1/fraud/alerts/{alert_id}/resolve")
async def resolve_fraud_alert(
    request: Request,
    alert_id: str,
    assigned_to: str,
    resolution_notes: str,
    db=Depends(lambda: db_pool)
):
    """Resolve fraud alert"""
    permify_authorize(request, "fraud_case", alert_id, "resolve")
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE fraud_alerts
            SET status = 'resolved',
                assigned_to = $1,
                resolution_notes = $2,
                resolved_at = CURRENT_TIMESTAMP
            WHERE alert_id = $3 AND status = 'open'
            RETURNING alert_id, tenant_id, customer_id, alert_type, severity, description, related_entities, created_at
        """, assigned_to, resolution_notes, alert_id)

        if not row:
            raise HTTPException(
                status_code=400,
                detail="Alert not found or already resolved"
            )

        # W12 B5-P1-F: dual-write the resolved status into the fraud-alerts
        # index in the same flow (natural _id = alert_id; upsert semantics).
        try:
            resolved_at = datetime.now()
            doc_id, doc = _os_search.alert_doc(
                alert_id, row["tenant_id"], row["customer_id"], row["alert_type"],
                row["severity"], row["description"], row["related_entities"],
                "resolved", assigned_to, resolution_notes,
                row["created_at"], resolved_at)
            await asyncio.to_thread(
                _os_search.index_doc, _os_search.ALERTS_INDEX, doc_id, doc)
        except Exception as _os_exc:
            print(f"[fraud-service] alert-resolve dual-write to opensearch "
                  f"failed (resync will backfill): {_os_exc}", file=sys.stderr)

        return {
            "status": "resolved",
            "alert_id": alert_id,
            "resolved_by": assigned_to,
            "resolved_at": datetime.now()
        }

# Blocked Entities Endpoints
@app.post("/api/v1/fraud/block")
async def block_entity(
    request: Request,
    entity_id: str,
    entity_type: str,
    tenant_id: str,
    reason: str,
    blocked_by: str,
    duration_hours: Optional[int] = None,
    db=Depends(lambda: db_pool)
):
    """Block entity (customer, IP, device, etc.)"""
    permify_authorize(request, "fraud_case", entity_id, "block")
    blocked_until = None
    is_permanent = True
    
    if duration_hours:
        blocked_until = datetime.now() + timedelta(hours=duration_hours)
        is_permanent = False
    
    async with db.acquire() as conn:
        await conn.execute("""
            INSERT INTO blocked_entities (
                entity_id, entity_type, tenant_id, reason, blocked_by,
                blocked_until, is_permanent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, entity_id, entity_type, tenant_id, reason, blocked_by,
            blocked_until, is_permanent)

    # W12 B5-P1-F: dual-write into the fraud-blocked-entities OpenSearch
    # index in the same flow (natural _id = tenant:entity_type:entity_id).
    # Postgres stays the source of truth; failures are logged and backfilled
    # by the boot sync / reindex endpoint.
    try:
        doc_id, doc = _os_search.blocked_doc(
            entity_id, entity_type, tenant_id, reason, blocked_by,
            blocked_until, is_permanent, datetime.now())
        await asyncio.to_thread(_os_search.ensure_index, _os_search.BLOCKED_INDEX)
        await asyncio.to_thread(
            _os_search.index_doc, _os_search.BLOCKED_INDEX, doc_id, doc)
    except Exception as _os_exc:
        print(f"[fraud-service] blocked-entity dual-write to opensearch "
              f"failed (resync will backfill): {_os_exc}", file=sys.stderr)

    publish_lakehouse_event(
        "ENTITY_BLOCKED",
        tenant_id,
        entity_id,
        {
            "entity_type": entity_type,
            "reason": reason,
            "blocked_by": blocked_by,
            "blocked_until": blocked_until.isoformat() if blocked_until else None,
            "is_permanent": is_permanent,
        },
        entity_type="blocked_entity",
    )
    
    return {
        "status": "blocked",
        "entity_id": entity_id,
        "entity_type": entity_type,
        "is_permanent": is_permanent,
        "blocked_until": blocked_until,
        "blocked_at": datetime.now()
    }

@app.get("/api/v1/fraud/blocked/{entity_id}")
async def check_if_blocked(
    entity_id: str,
    entity_type: str,
    db=Depends(lambda: db_pool)
):
    """Check if entity is blocked"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM blocked_entities
            WHERE entity_id = $1 AND entity_type = $2
                AND (blocked_until IS NULL OR blocked_until > CURRENT_TIMESTAMP)
            ORDER BY created_at DESC
            LIMIT 1
        """, entity_id, entity_type)
        
        if row:
            return {
                "is_blocked": True,
                "entity_id": entity_id,
                "entity_type": entity_type,
                "reason": row['reason'],
                "blocked_until": row['blocked_until'],
                "is_permanent": row['is_permanent']
            }
        else:
            return {
                "is_blocked": False,
                "entity_id": entity_id,
                "entity_type": entity_type
            }

@app.get("/api/v1/fraud/blocked")
async def list_blocked_entities(
    tenant_id: str,
    entity_type: Optional[str] = None,
    search: Optional[str] = None,
    db=Depends(lambda: db_pool)
):
    """List blocked entities.

    W12 B5-P1-F: the `search` parameter is served by a real OpenSearch query
    (match + fuzziness=AUTO on entity_id, tenant-filtered) instead of an
    ILIKE substring scan; hits are hydrated from Postgres (source of truth)
    preserving the response contract. Fail closed: 503 when search is
    requested and the cluster is unreachable."""
    if search:
        try:
            await _ensure_fraud_indices_synced()
            keys = await asyncio.to_thread(
                _os_search.search_blocked_entity_keys, tenant_id, search)
        except _os_search.OpenSearchUnavailable as e:
            raise HTTPException(
                status_code=503,
                detail=f"blocked-entity search backend unavailable: {e}")
        if not keys:
            return {"tenant_id": tenant_id, "blocked_entities": [], "total": 0}
        if entity_type:
            keys = [k for k in keys if k[0] == entity_type]
        keyset = set(keys)
        order = {k: i for i, k in enumerate(keys)}
        async with db.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM blocked_entities WHERE tenant_id = $1", tenant_id)
        rows = [r for r in rows
                if (r["entity_type"], r["entity_id"]) in keyset]
        rows.sort(key=lambda r: order.get((r["entity_type"], r["entity_id"]), len(order)))
        return {"tenant_id": tenant_id,
                "blocked_entities": [dict(row) for row in rows],
                "total": len(rows)}

    query = "SELECT * FROM blocked_entities WHERE tenant_id = $1"
    params = [tenant_id]
    param_count = 2
    if entity_type:
        query += f" AND entity_type = ${param_count}"
        params.append(entity_type)
        param_count += 1
    query += " ORDER BY created_at DESC"
    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
    return {"tenant_id": tenant_id, "blocked_entities": [dict(row) for row in rows], "total": len(rows)}

@app.post("/api/v1/fraud/unblock")
async def unblock_entity(
    request: Request,
    entity_id: str,
    entity_type: str,
    unblocked_by: str,
    db=Depends(lambda: db_pool)
):
    """Unblock entity"""
    permify_authorize(request, "fraud_case", entity_id, "block")
    unblocked_at = datetime.now()
    async with db.acquire() as conn:
        # Set blocked_until to now to effectively unblock
        updated_rows = await conn.fetch("""
            UPDATE blocked_entities
            SET blocked_until = CURRENT_TIMESTAMP
            WHERE entity_id = $1 AND entity_type = $2
                AND (blocked_until IS NULL OR blocked_until > CURRENT_TIMESTAMP)
            RETURNING tenant_id, reason, blocked_by, is_permanent, created_at
        """, entity_id, entity_type)

        # W12 B5-P1-F: dual-write the unblocked state (blocked_until=now) into
        # the fraud-blocked-entities index for every updated row.
        for row in updated_rows:
            try:
                doc_id, doc = _os_search.blocked_doc(
                    entity_id, entity_type, row["tenant_id"], row["reason"],
                    row["blocked_by"], unblocked_at, row["is_permanent"],
                    row["created_at"])
                await asyncio.to_thread(
                    _os_search.index_doc, _os_search.BLOCKED_INDEX, doc_id, doc)
            except Exception as _os_exc:
                print(f"[fraud-service] unblock dual-write to opensearch "
                      f"failed (resync will backfill): {_os_exc}", file=sys.stderr)

        return {
            "status": "unblocked",
            "entity_id": entity_id,
            "entity_type": entity_type,
            "unblocked_by": unblocked_by,
            "unblocked_at": datetime.now()
        }

@app.post("/api/v1/fraud/cases")
async def create_case(
    request: Request,
    tenant_id: str,
    summary: str,
    customer_id: Optional[str] = None,
    source_alert_id: Optional[str] = None,
    source_check_id: Optional[str] = None,
    priority: str = "normal",
    assigned_to: Optional[str] = None,
    db=Depends(lambda: db_pool)
):
    permify_authorize(request, "fraud_case", tenant_id, "create")
    case_id = f"FRDC{int(datetime.now().timestamp())}"
    async with db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO fraud_cases (
                case_id, tenant_id, source_alert_id, source_check_id, customer_id,
                status, priority, assigned_to, summary, findings
            ) VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8,$9)
            """,
            case_id,
            tenant_id,
            source_alert_id,
            source_check_id,
            customer_id,
            priority,
            assigned_to,
            summary,
            json.dumps([]),
        )
    return {"status": "created", "case_id": case_id}

@app.get("/api/v1/fraud/cases")
async def list_cases_overview(
    tenant_id: str,
    db=Depends(lambda: db_pool)
):
    async with db.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT status, COUNT(*) AS count FROM fraud_cases
            WHERE tenant_id = $1
            GROUP BY status
            """,
            tenant_id
        )
    return {
        "tenant_id": tenant_id,
        "case_overview": {row['status']: row['count'] for row in rows}
    }

@app.get("/api/v1/fraud/cases/{tenant_id}")
async def list_cases(
    tenant_id: str,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    db=Depends(lambda: db_pool)
):
    query = "SELECT * FROM fraud_cases WHERE tenant_id = $1"
    params = [tenant_id]
    param_count = 2
    if status:
        query += f" AND status = ${param_count}"
        params.append(status)
        param_count += 1
    if assigned_to:
        query += f" AND assigned_to = ${param_count}"
        params.append(assigned_to)
        param_count += 1
    query += " ORDER BY created_at DESC"
    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
    return {"tenant_id": tenant_id, "cases": [dict(row) for row in rows], "total": len(rows)}

@app.post("/api/v1/fraud/cases/{case_id}/findings")
async def append_case_finding(
    request: Request,
    case_id: str,
    actor: str,
    finding: str,
    close_case: bool = False,
    db=Depends(lambda: db_pool)
):
    permify_authorize(request, "fraud_case", case_id, "decide")
    async with db.acquire() as conn:
        row = await conn.fetchrow("SELECT findings, status FROM fraud_cases WHERE case_id = $1", case_id)
        if not row:
            raise HTTPException(status_code=404, detail="Fraud case not found")
        findings = list(row["findings"] or [])
        findings.append({"actor": actor, "finding": finding, "at": datetime.utcnow().isoformat()})
        status = "closed" if close_case else row["status"]
        await conn.execute(
            "UPDATE fraud_cases SET findings = $1, status = $2, updated_at = CURRENT_TIMESTAMP, closed_at = CASE WHEN $2 = 'closed' THEN CURRENT_TIMESTAMP ELSE closed_at END WHERE case_id = $3",
            findings,
            status,
            case_id,
        )
    return {"status": status, "case_id": case_id, "findings_total": len(findings)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8084)
