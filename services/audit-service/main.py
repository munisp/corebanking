from fastapi import FastAPI, Depends

from database import Base, engine
from database.migrations import run_migrations
from api import health_router, audit_router
from utils import get_config
from middlewares import swagger_keycloak_id_auth, get_request_auth_headers

# Setup config
config = get_config()

app = FastAPI(
    title="Audit Service",
    description="54Link Audit Service.",
    version="0.0.0"
)
# --- OpenTelemetry (SPEC w9 §2.5 TEMPLATE): otelkit init + tenant middleware.
# OTLP gRPC traces+metrics (default http://otel-collector:4317), W3C
# tracecontext+baggage propagation, FastAPI server spans, TenantMiddleware
# (tenant.id span attr from x-tenant-id). Honors OTEL_SDK_DISABLED; never raises.
try:
    import os as _otel_os
    import sys as _otel_sys

    _otel_sys.path.insert(
        0,
        _otel_os.path.normpath(
            _otel_os.path.join(
                _otel_os.path.dirname(__file__), "..", "..", "shared", "otel", "python"
            )
        ),
    )
    from otelkit import init_telemetry

    init_telemetry("audit-service", app)
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

# AU-01 (F15-1): service-to-service audit ingestion credential. Senders present
# the shared secret as the X-Audit-Ingest-Token header; the value is injected
# from the shared `audit-ingest-credentials` k8s secret. Fail-closed: when
# AUDIT_INGEST_TOKEN is unset the header path is disabled and only a Bearer JWT
# whose claims carry role service/audit-writer can ingest.
_AUDIT_INGEST_TOKEN = _jwt_os.environ.get("AUDIT_INGEST_TOKEN", "")
_AUDIT_WRITER_ROLES = frozenset({"service", "audit-writer"})


def _jwt_claim_roles(claims):
    roles = set()
    role = claims.get("role")
    if isinstance(role, str):
        roles.add(role)
    for item in claims.get("roles") or []:
        roles.add(item)
    realm = claims.get("realm_access") or {}
    for item in realm.get("roles") or []:
        roles.add(item)
    return roles


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
        is_ingest = (
            request.method == "POST"
            and request.url.path.rstrip("/") == "/audits"
        )
        # AU-01: shared-secret ingestion path for the 22 audit-shipping services.
        if is_ingest:
            ingest_token = request.headers.get("x-audit-ingest-token", "")
            if ingest_token:
                if not _AUDIT_INGEST_TOKEN or not _jwt_hmac.compare_digest(
                    ingest_token.encode(), _AUDIT_INGEST_TOKEN.encode()
                ):
                    return _JWTJSONResponse(
                        status_code=401,
                        content={"error": "unauthorized", "detail": "Invalid audit ingest token"},
                    )
                request.state.jwt_claims = {
                    "sub": "audit-ingest",
                    "role": "audit-writer",
                    "tenant_id": request.headers.get("x-tenant-id", ""),
                }
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
        # AU-01: ingestion via Bearer JWT requires an explicit writer role.
        if is_ingest and not (_jwt_claim_roles(claims) & _AUDIT_WRITER_ROLES):
            return _JWTJSONResponse(
                status_code=403,
                content={"error": "forbidden", "detail": "audit-writer or service role required"},
            )
        request.state.jwt_claims = claims
        tenant = claims.get("tenant_id") or claims.get("tenant")
        _jwt_set_scope_header(request.scope, "x-tenant-id", tenant)
        _jwt_set_scope_header(request.scope, "x-tenant", tenant)
        subject = claims.get("sub") or claims.get("keycloak_id")
        if subject:
            _jwt_set_scope_header(request.scope, "x-keycloak-id", subject)
        return await call_next(request)


app.add_middleware(JWTAuthMiddleware)


app.middleware("http")(get_request_auth_headers)

Base.metadata.create_all(bind=engine)
# AU-03/PL-10: apply expand-only migrations (hash chain, retention bucket,
# archive certificate table) and backfill. Idempotent.
run_migrations()

app.include_router(health_router, prefix="", tags=["health"])
app.include_router(audit_router, prefix="/audits", tags=["audit"])

# OR-14 (T36): the Dapr `new_audit_log` subscription had zero producers
# fleet-wide (audit arrives via authenticated HTTP POST /audits per F15-2), so
# the orphan subscription and its handler were deleted. HTTP intake is the real
# ingestion path.
