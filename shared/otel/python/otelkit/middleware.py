"""Tenant attribution middleware (SPEC §2.3).

Span attribute key: ``tenant.id`` (string).
Source priority: ``x-tenant-id`` header -> JWT ``tenant_id`` claim (when a JWT
middleware has already stashed claims on request.state) -> absent.

The kit never mints tenant ids; it only copies the authenticated identity onto
the current span. When no tenant is known the attribute is left unset.
"""

from __future__ import annotations

from typing import Any, Optional

from opentelemetry import trace


def _set_tenant_on_span(tenant_id: Optional[str]) -> None:
    if not tenant_id:
        return
    try:
        span = trace.get_current_span()
        if span is not None and span.is_recording():
            span.set_attribute("tenant.id", str(tenant_id))
    except Exception:
        pass


def tenant_from_request(headers: Any, jwt_claims: Any = None) -> Optional[str]:
    """Resolve tenant id per SPEC §2.3 priority order."""
    tid = None
    try:
        tid = headers.get("x-tenant-id") or headers.get("X-Tenant-Id")
    except Exception:
        tid = None
    if not tid and isinstance(jwt_claims, dict):
        tid = jwt_claims.get("tenant_id") or jwt_claims.get("tenant")
    return str(tid) if tid else None


try:
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request

    class TenantMiddleware(BaseHTTPMiddleware):
        """FastAPI/Starlette middleware setting ``tenant.id`` on the active span.

        Registered via ``app.add_middleware(TenantMiddleware)`` (also attached
        automatically by ``init_telemetry(..., app=fastapi_app)``).
        """

        async def dispatch(self, request: Request, call_next):
            claims = getattr(request.state, "jwt_claims", None)
            _set_tenant_on_span(tenant_from_request(request.headers, claims))
            return await call_next(request)

except ImportError:  # starlette not installed (e.g. Flask-only services)
    TenantMiddleware = None  # type: ignore[assignment]


def install_flask_tenant_hook(app: Any) -> None:
    """Flask equivalent: before_request hook setting ``tenant.id`` on the span.

    JWT claim fallback reads ``flask.g.jwt_claims`` when a JWT middleware has
    populated it.
    """
    try:
        from flask import g, request as flask_request
    except ImportError:
        return

    @app.before_request
    def _otelkit_tenant_hook():  # pragma: no cover - exercised in deployment
        claims = getattr(g, "jwt_claims", None)
        _set_tenant_on_span(tenant_from_request(flask_request.headers, claims))
