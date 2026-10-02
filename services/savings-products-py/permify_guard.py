"""Wave-12 B5-P1-D-D: Permify authorization dependency for mutating money
handlers. Mirrors the landed wave-12 B5-P0-D1 guard (services/card-service/utils/permify_guard.py)
and services/permify-authz-go/main.go:470 (30s decision cache). Stdlib-only so
no dependency changes are required. Runs AFTER the wave-11 JWTAuthMiddleware,
which stores verified claims on request.state.jwt_claims. Fail-closed: Permify
unreachable -> 502; denial -> 403. Attach via
`dependencies=[Depends(require_permify("<entity>", "<permission>"))]` on
mutating route decorators.
"""
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
    "id", "account_id", "transfer_id", "lien_id", "card_id", "goal_id",
    "merchant_id", "settlement_id", "entry_id", "journal_id",
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
