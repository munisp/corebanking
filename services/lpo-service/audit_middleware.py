import datetime
import json
import os
import re
import threading
import urllib.request

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# --- OpenTelemetry (SPEC w9 addendum): audit_ship_failures_total counter ---
import sys as _otel_sys

_otel_sys.path.insert(
    0,
    os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "shared", "otel", "python")
    ),
)
try:
    from otelkit import inc_counter
except Exception:

    def inc_counter(name, attrs=None):
        return None

_AUDIT_URL = os.getenv("AUDIT_SVC_URL", "http://audit-service:8000")
# AU-01 (F15-1): shared-secret ingest credential (k8s secret audit-ingest-credentials).
_AUDIT_INGEST_TOKEN = os.getenv("AUDIT_INGEST_TOKEN", "")
_SKIP_METHODS = {"GET", "HEAD", "OPTIONS"}
_SKIP_PREFIXES = ("/health", "/metrics", "/dapr", "/docs", "/openapi")
_UUID_RE = re.compile(r"/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")
_INT_RE = re.compile(r"/\d+")


def _path_to_event_type(method: str, path: str) -> str:
    clean = _UUID_RE.sub("/{id}", path)
    clean = _INT_RE.sub("/{id}", clean)
    return f"{method}:{clean}"


def _emit(actor_id: str, tenant_id: str, event_type: str, event_data: dict) -> None:
    if not _AUDIT_URL:
        return
    try:
        body = json.dumps({
            "actor_id": actor_id,
            "tenant_id": tenant_id,
            "event_type": event_type,
            "event_data": event_data,
            "timestamp": datetime.datetime.utcnow().isoformat(),
        }).encode()
        req = urllib.request.Request(
            f"{_AUDIT_URL}/audits",
            data=body,
            headers={
                "Content-Type": "application/json",
                "x-tenant-id": tenant_id,
                "x-keycloak-id": "system",
            },
            method="POST",
        )
        # AU-01 (F15-1): present the shared ingest credential so the fail-closed
        # audit-service accepts the event (secret: audit-ingest-credentials).
        if _AUDIT_INGEST_TOKEN:
            req.add_header("X-Audit-Ingest-Token", _AUDIT_INGEST_TOKEN)
        urllib.request.urlopen(req, timeout=3)
    except Exception:
        # Alerting contract (w9 addendum): count swallowed audit ship failures.
        inc_counter(
            "audit_ship_failures_total",
            {"service": "lpo-service", "tenant_id": tenant_id or "unknown"},
        )


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in _SKIP_METHODS:
            return await call_next(request)
        path = request.url.path
        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            return await call_next(request)

        response = await call_next(request)

        tenant_id = request.headers.get("x-tenant-id", "unknown")
        actor_id = (
            request.headers.get("x-keycloak-id")
            or request.headers.get("x-keycloak-id", "unknown")
        )
        event_data: dict = {
            "method": request.method,
            "path": path,
            "status_code": response.status_code,
        }
        if str(request.query_params):
            event_data["query"] = str(request.query_params)

        threading.Thread(
            target=_emit,
            args=(actor_id, tenant_id, _path_to_event_type(request.method, path), event_data),
            daemon=True,
        ).start()

        return response

