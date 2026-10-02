import os
import threading
from utils import ExternalAPIClient, get_config, create_logger
from schemas.v1 import Context, AuditEventSchema

logger = create_logger(__name__)
config = get_config()


class AuditServiceAdapter(ExternalAPIClient):
    """Audit service adapter."""

    def __init__(self):
        ExternalAPIClient.__init__(
            self,
            base_url=config.AUDIT_SVC_URL,
            headers={
                "Content-Type": "application/json",
            },
        )

    def _emit_audit(self, payload: AuditEventSchema, context: Context):
        headers = {
            "x-tenant-id": context.tenant_id,
            "x-keycloak-id": "system",
        }
        # AU-01 (F15-1): service-to-service ingest credential (fail-closed receiver).
        _ingest_token = os.getenv("AUDIT_INGEST_TOKEN", "")
        if _ingest_token:
            headers["X-Audit-Ingest-Token"] = _ingest_token

        try:
            self._post(
                endpoint="/audits",
                data=payload.model_dump(),
                headers=headers,
            )
        except Exception as exc:
            # Explicitly swallow — audit failures must never affect core flow
            logger.warning("Failed to emit audit event: %s", exc)
            # Alerting contract (w9 addendum): count swallowed ship failures.
            try:
                import sys as _s
                _s.path.insert(0, os.path.normpath(os.path.join(
                    os.path.dirname(__file__), "..", "..", "..", "shared", "otel", "python")))
                from otelkit import inc_counter
                inc_counter("audit_ship_failures_total",
                            {"service": "auth-service",
                             "tenant_id": getattr(context, "tenant_id", None) or "unknown"})
            except Exception:
                pass

    def create_audit(self, payload: AuditEventSchema, context: Context):
        """Fire-and-forget audit emission."""

        thread = threading.Thread(
            target=self._emit_audit,
            args=(payload, context),
            daemon=True,  # Dies with the process
        )
        thread.start()
