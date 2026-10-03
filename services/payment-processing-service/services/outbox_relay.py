"""Durable outbox enqueue + relay (W13-RISK-15/16).

Two write paths become durable here:
  * audit events whose shipment to the audit service exhausted retries
    (RISK-15, previously retried-then-dropped), and
  * outbound external payment notifications (mojaloop/payment-rails) that
    failed AFTER the TigerBeetle debit was already durable
    (RISK-16, previously fire-and-forget).

Rows are persisted in Postgres (audit_outbox / external_notification_outbox)
and a background relay thread retries delivery until it succeeds, so the
notification/audit trail is as durable as the debit itself.
"""
import json
import os
import threading
import time

from database.setup import SessionFactory
from models.outbox import AuditOutbox, ExternalNotificationOutbox
from utils import create_logger

logger = create_logger(__name__)

_RELAY_INTERVAL_SECONDS = float(os.getenv("OUTBOX_RELAY_INTERVAL_SECONDS", "30"))
_RELAY_BATCH_SIZE = int(os.getenv("OUTBOX_RELAY_BATCH_SIZE", "50"))
_relay_started = False
_relay_lock = threading.Lock()


def _jsonable(obj):
    """Guarantee a JSONB-serializable payload."""
    return json.loads(json.dumps(obj, default=str))


def enqueue_audit_event(event_data: dict, headers: dict, tenant_id: str, event_type: str) -> str:
    """Persist an audit event for later shipment. Raises on DB error
    (fail-closed: a failed outbox write means the audit trail is not durable,
    and the caller must know)."""
    session = SessionFactory()
    try:
        row = AuditOutbox(
            tenant_id=tenant_id or "system",
            event_type=event_type or "UNKNOWN",
            payload=_jsonable(event_data),
            headers=_jsonable(headers or {}),
            status="pending",
        )
        session.add(row)
        session.commit()
        logger.warning(
            "audit_event_enqueued_to_outbox id=%s event_type=%s tenant_id=%s",
            row.id, row.event_type, row.tenant_id,
        )
        return row.id
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def enqueue_external_notification(reference: str, payload: dict, tenant_id: str) -> str:
    """Persist an outbound payment notification for later delivery.
    Raises on DB error (fail-closed)."""
    session = SessionFactory()
    try:
        row = ExternalNotificationOutbox(
            reference=str(reference),
            tenant_id=tenant_id or "system",
            payload=_jsonable(payload),
            status="pending",
        )
        session.add(row)
        session.commit()
        logger.warning(
            "external_notification_enqueued_to_outbox id=%s reference=%s tenant_id=%s",
            row.id, row.reference, row.tenant_id,
        )
        return row.id
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _ship_audit(row: AuditOutbox) -> None:
    from adapters.audit_service_adapter import AuditServiceAdapter

    AuditServiceAdapter()._post(endpoint="/audits", data=row.payload, headers=dict(row.headers or {}))


def _ship_external_notification(row: ExternalNotificationOutbox) -> None:
    from adapters import payment_rails_connector_adapter

    payment_rails_connector_adapter.initiate_outbound_transfer(dict(row.payload or {}))


def _drain(model, ship_fn) -> None:
    session = SessionFactory()
    try:
        rows = (
            session.query(model)
            .filter(model.status == "pending")
            .order_by(model.created_at)
            .limit(_RELAY_BATCH_SIZE)
            .all()
        )
        for row in rows:
            try:
                ship_fn(row)
                row.status = "shipped"
                row.last_error = None
                session.commit()
                logger.info("outbox_shipped table=%s id=%s", model.__tablename__, row.id)
            except Exception as exc:  # leave pending, retry next cycle
                session.rollback()
                try:
                    row2 = session.get(model, row.id)
                    if row2 is not None:
                        row2.attempts = (row2.attempts or 0) + 1
                        row2.last_error = str(exc)[:2000]
                        session.commit()
                except Exception:
                    session.rollback()
                logger.warning(
                    "outbox_ship_retry table=%s id=%s error=%s",
                    model.__tablename__, row.id, exc,
                )
    finally:
        session.close()


def _relay_loop() -> None:
    logger.info("outbox_relay_started interval=%ss", _RELAY_INTERVAL_SECONDS)
    while True:
        try:
            _drain(AuditOutbox, _ship_audit)
            _drain(ExternalNotificationOutbox, _ship_external_notification)
        except Exception as exc:
            logger.error("outbox_relay_cycle_failed error=%s", exc)
        time.sleep(_RELAY_INTERVAL_SECONDS)


def start_relay_thread() -> None:
    """Start the background relay (idempotent, daemon thread)."""
    global _relay_started
    with _relay_lock:
        if _relay_started:
            return
        _relay_started = True
    t = threading.Thread(target=_relay_loop, name="outbox-relay", daemon=True)
    t.start()
