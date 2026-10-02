"""Wave-12 B5-P1-D-C: Permify authorization guard (real enforcement).

Modeled on services/auth-service/adapters/permify.py (REST check call) and
services/permify-authz-go/main.go:470 (30s in-process decision cache). Stdlib
urllib only -- no new dependencies. Runs AFTER the wave-11 JWTAuthMiddleware,
which stores verified claims on request.state.jwt_claims (FastAPI path) or
returns them from validate_jwt (raw http.server path).

Fail-closed: Permify unreachable / non-200 -> 502 (FastAPI) or raised
PermifyUnavailableError (raw path); denial -> 403. Errors are NEVER cached.
"""
import json
import logging
import os
import threading
import time
import urllib.request

logger = logging.getLogger(__name__)

PERMIFY_URL = (os.getenv("PERMIFY_URL") or os.getenv("PERMIFY_ENDPOINT")
               or "http://permify:3476").rstrip("/")
DEFAULT_TENANT = os.getenv("PERMIFY_DEFAULT_TENANT", "bpmgd")

# 30s decision cache (permify-authz-go:470): only completed decisions are
# cached; errors are never cached so callers stay fail-closed.
DECISION_CACHE_TTL = 30.0
DECISION_CACHE_MAX = 10000

_cache = {}
_cache_lock = threading.Lock()


class PermifyUnavailableError(Exception):
    """Raised when Permify cannot be reached or returns a non-200 status."""


def check_permission(tenant_id, entity_type, entity_id, permission, subject_id):
    """Real Permify permissions/check call with a 30s decision cache.

    Returns True/False for completed decisions; raises
    PermifyUnavailableError on transport/HTTP failure (never cached).
    """
    tenant_id = tenant_id or DEFAULT_TENANT
    entity_id = str(entity_id or "")
    key = (tenant_id, entity_type, entity_id, permission, subject_id)
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
    if hit and now < hit[1]:
        return hit[0]

    payload = json.dumps({
        "metadata": {"schema_version": "", "snap_token": "", "depth": 20},
        "entity": {"type": entity_type, "id": entity_id},
        "permission": permission,
        "subject": {"type": "user", "id": subject_id},
    }).encode()
    req = urllib.request.Request(
        f"{PERMIFY_URL}/v1/tenants/{tenant_id}/permissions/check",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read().decode())
    except Exception as exc:
        raise PermifyUnavailableError(str(exc))
    allowed = result.get("can") == "CHECK_RESULT_ALLOWED" or result.get("can") is True

    with _cache_lock:
        if len(_cache) >= DECISION_CACHE_MAX:
            for k in [k for k, v in _cache.items() if now >= v[1]]:
                _cache.pop(k, None)
            if len(_cache) >= DECISION_CACHE_MAX:
                _cache.pop(next(iter(_cache)), None)
        _cache[key] = (allowed, now + DECISION_CACHE_TTL)
    return allowed


def require_permify(entity_type, permission):
    """FastAPI dependency factory: enforce <entity_type>:<permission> for the
    JWT-verified caller before the handler executes. Fail-closed."""
    from fastapi import HTTPException, Request  # lazy: stdlib-only module import

    def dependency(request: Request):
        claims = getattr(request.state, "jwt_claims", None) or {}
        user_id = (
            claims.get("sub")
            or claims.get("keycloak_id")
            or request.headers.get("x-keycloak-id")
        )
        tenant_id = (
            claims.get("tenant_id")
            or claims.get("tenant")
            or request.headers.get("x-tenant-id")
            or DEFAULT_TENANT
        )
        if not user_id:
            raise HTTPException(status_code=403, detail="missing authenticated subject")
        entity_id = ""
        for value in request.path_params.values():
            entity_id = str(value)
            break
        if not entity_id:
            entity_id = "scope:" + request.url.path.lstrip("/")
        try:
            allowed = check_permission(
                tenant_id, entity_type, entity_id, permission, user_id
            )
        except PermifyUnavailableError as exc:  # fail-closed: permify unreachable
            logger.error("permify check failed (fail-closed): %s", exc)
            raise HTTPException(status_code=502, detail="authorization service unavailable")
        if not allowed:
            raise HTTPException(
                status_code=403,
                detail=f"forbidden: missing permission {entity_type}:{permission}",
            )

    return dependency
