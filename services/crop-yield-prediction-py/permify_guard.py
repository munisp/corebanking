"""Wave-12 B5-P1-D-E: Permify authorization dependency for mutating handlers.
Mirrors the landed wave-12 B5-P0-D1 money guard
(services/merchant-service/permify_guard.py): real Permify permissions/check
call (stdlib urllib only — no new dependencies) with a 30s in-process decision
cache; errors are never cached; fail-closed (Permify unreachable -> 502,
denied -> 403). Runs AFTER the wave-11 JWTAuthMiddleware, which stores
verified claims on request.state.jwt_claims; for services whose JWT check is a
route-level dependency instead of a middleware, the subject/tenant claims are
read from the same Bearer token the dependency already verified (identity
extraction only — signature verification stays with the JWT verifier).
Attach via `dependencies=[Depends(require_permify("<entity>", "<permission>"))]`
on mutating route decorators, or call permify_http_check from non-FastAPI
handlers (http.server) with the same fail-closed semantics.
"""
import base64
import json
import logging
import os
import threading
import time
import urllib.request

from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

PERMIFY_URL = os.getenv("PERMIFY_URL", "http://permify:3476").rstrip("/")
DEFAULT_TENANT = os.getenv("PERMIFY_DEFAULT_TENANT", "bpmgd")

# 30s decision cache (permify-authz-go:470): only completed decisions are
# cached; errors are never cached so callers stay fail-closed.
DECISION_CACHE_TTL = 30.0
DECISION_CACHE_MAX = 10000

_cache = {}
_cache_lock = threading.Lock()

_ID_FIELDS = (
    "id", "record_id", "account_id", "customer_id", "tenant_id", "user_id",
    "farm_id", "farmer_id", "loan_id", "case_id", "session_id", "key_id",
    "request_id", "resource_id",
)


def _permify_check(tenant_id, user_id, entity_type, entity_id, permission):
    """Real Permify permissions/check call with a 30s decision cache."""
    key = (tenant_id, user_id, entity_type, entity_id, permission)
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
    if hit and now < hit[1]:
        return hit[0]

    payload = json.dumps({
        "metadata": {"schema_version": "", "snap_token": "", "depth": 20},
        "entity": {"type": entity_type, "id": entity_id},
        "permission": permission,
        "subject": {"type": "user", "id": user_id},
    }).encode()
    req = urllib.request.Request(
        f"{PERMIFY_URL}/v1/tenants/{tenant_id}/permissions/check",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        result = json.loads(resp.read().decode())
    allowed = result.get("can") == "CHECK_RESULT_ALLOWED"

    with _cache_lock:
        if len(_cache) >= DECISION_CACHE_MAX:
            for k in [k for k, v in _cache.items() if now >= v[1]]:
                _cache.pop(k, None)
            if len(_cache) >= DECISION_CACHE_MAX:
                _cache.pop(next(iter(_cache)), None)
        _cache[key] = (allowed, now + DECISION_CACHE_TTL)
    return allowed


def _bearer_claims(authorization):
    """Identity claims from the Bearer token payload. Identity extraction
    only: the token's signature is verified by the service's JWT middleware /
    dependency BEFORE this runs (fail-closed upstream), so reading the payload
    here never authenticates anything by itself."""
    if not authorization or not authorization.startswith("Bearer "):
        return {}
    parts = authorization[7:].split(".")
    if len(parts) != 3:
        return {}
    try:
        padded = parts[1] + "=" * (-len(parts[1]) % 4)
        return json.loads(base64.urlsafe_b64decode(padded.encode()))
    except Exception:
        return {}


def _subject_and_tenant(request: Request):
    claims = getattr(request.state, "jwt_claims", None) or {}
    if not claims:
        claims = _bearer_claims(request.headers.get("authorization", ""))
    user_id = (
        claims.get("sub")
        or claims.get("user_id")
        or claims.get("preferred_username")
        or claims.get("email")
        or claims.get("keycloak_id")
        or request.headers.get("x-keycloak-id")
        or request.headers.get("x-user-id")
    )
    tenant_id = (
        claims.get("tenant_id")
        or claims.get("tenant")
        or request.headers.get("x-tenant-id")
        or DEFAULT_TENANT
    )
    return user_id, tenant_id


def _entity_id(request: Request):
    """Resource id from path parameters, else a stable per-route scope so the
    decision is still real and tenant-scoped."""
    for field in _ID_FIELDS:
        value = request.path_params.get(field)
        if value:
            return str(value)
    return "scope:" + request.url.path.lstrip("/")


def require_permify(entity_type, permission):
    """FastAPI dependency factory: enforce entity_type:permission on the
    authenticated subject before the mutating handler executes."""

    def dependency(request: Request):
        user_id, tenant_id = _subject_and_tenant(request)
        if not user_id:
            raise HTTPException(status_code=403, detail="missing authenticated subject")
        try:
            allowed = _permify_check(
                tenant_id, user_id, entity_type, _entity_id(request), permission
            )
        except HTTPException:
            raise
        except Exception as exc:  # fail-closed: permify unreachable
            logger.error("permify check failed (fail-closed): %s", exc)
            raise HTTPException(status_code=502, detail="authorization service unavailable")
        if not allowed:
            raise HTTPException(
                status_code=403,
                detail=f"forbidden: missing permission {entity_type}:{permission}",
            )

    return dependency


# --- Non-FastAPI (http.server) variant — same check, same cache, fail-closed.

def permission_for_path(path, method="POST"):
    """Route -> permission mapping for raw-handler services: a trailing action
    verb wins, otherwise the HTTP method decides."""
    segs = [s for s in path.strip("/").split("/") if s]
    last = segs[-1].lower().replace("-", "_") if segs else ""
    if last in (
        "check", "register", "match", "search", "detect", "classify",
        "analyze", "extract", "assess", "submit", "verify", "accumulate",
    ):
        return last
    return {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}.get(method, "create")


def permify_http_check(headers, entity_type, entity_id, permission):
    """http.server-flavored guard: headers is a mapping with authorization /
    x-tenant-id. Returns (status_code, error_body) on failure — (502|403,
    dict) — or (None, None) when the check allows. Fail-closed."""
    claims = _bearer_claims(headers.get("Authorization") or headers.get("authorization") or "")
    user_id = claims.get("sub") or claims.get("user_id") or claims.get("preferred_username") or headers.get("X-User-Id")
    tenant_id = claims.get("tenant_id") or claims.get("tenant") or headers.get("X-Tenant-Id") or DEFAULT_TENANT
    if not user_id:
        return 403, {"error": "missing authenticated subject"}
    try:
        allowed = _permify_check(tenant_id, user_id, entity_type, entity_id or "scope:" + entity_type, permission)
    except Exception as exc:  # fail-closed: permify unreachable
        logger.error("permify check failed (fail-closed): %s", exc)
        return 502, {"error": "authorization service unavailable"}
    if not allowed:
        return 403, {"error": f"forbidden: missing permission {entity_type}:{permission}"}
    return None, None
