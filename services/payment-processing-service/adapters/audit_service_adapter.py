import os
import time
from utils import ExternalAPIClient, get_config, create_logger
from schemas import Context, AuditEventSchema

logger = create_logger(__name__)
config = get_config()

_MAX_RETRIES = 3
_RETRY_DELAYS = [0.2, 0.5, 1.0]  # seconds between retries


class AuditServiceAdapter(ExternalAPIClient):
    """Audit service adapter — synchronous with retry and structured fallback logging."""

    def __init__(self):
        ExternalAPIClient.__init__(
            self,
            base_url=config.AUDIT_SVC_URL,
            headers={"Content-Type": "application/json"},
        )

    def create_audit(self, payload: AuditEventSchema, context: Context = None) -> None:
        """
        Emit an audit event synchronously with up to _MAX_RETRIES attempts.
        On total failure, persists the event to the durable audit_outbox table
        (retried by the outbox relay). Raises only if the durable outbox write
        itself fails — an audit event must never be silently dropped.
        """
        headers = {
            "x-tenant-id": context.tenant_id if context else "system",
            "x-keycloak-id": "system",
        }
        # AU-01 (F15-1): service-to-service ingest credential (fail-closed receiver).
        _ingest_token = os.getenv("AUDIT_INGEST_TOKEN", "")
        if _ingest_token:
            headers["X-Audit-Ingest-Token"] = _ingest_token
        event_data = payload.model_dump()

        last_exc = None
        for attempt in range(_MAX_RETRIES):
            try:
                self._post(endpoint="/audits", data=event_data, headers=headers)
                return
            except Exception as exc:
                last_exc = exc
                if attempt < _MAX_RETRIES - 1:
                    time.sleep(_RETRY_DELAYS[attempt])

        # All retries exhausted — W13-RISK-15: do NOT drop the event. Persist
        # it to the durable audit_outbox table so the outbox relay retries
        # delivery; the audit trail must survive a sustained audit-service
        # outage. Fail-closed: if the outbox write itself fails, propagate so
        # the caller knows the audit trail is not durable.
        from services.outbox_relay import enqueue_audit_event

        outbox_id = enqueue_audit_event(
            event_data=event_data,
            headers=headers,
            tenant_id=context.tenant_id if context else "system",
            event_type=getattr(payload, "event_type", "UNKNOWN"),
        )
        logger.critical(
            "audit_emission_failed_all_retries event_type=%s actor_id=%s tenant_id=%s "
            "error=%s ACTION=enqueued_to_audit_outbox outbox_id=%s",
            getattr(payload, "event_type", "UNKNOWN"),
            getattr(payload, "actor_id", "UNKNOWN"),
            context.tenant_id if context else "UNKNOWN",
            str(last_exc),
            outbox_id,
        )
        # Alerting contract (w9 addendum): count exhausted audit ship failures.
        try:
            import sys as _s
            _s.path.insert(0, os.path.normpath(os.path.join(
                os.path.dirname(__file__), "..", "..", "..", "shared", "otel", "python")))
            from otelkit import inc_counter
            inc_counter("audit_ship_failures_total",
                        {"service": "payment-processing-service",
                         "tenant_id": context.tenant_id if context else "unknown"})
        except Exception:
            pass
