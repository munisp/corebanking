"""
OR-12/OR-13/OR-16/OR-24: Dapr event subscriptions for notification-service.

This module closes the fleet's unread high-value topics by subscribing to them
and turning each event into a PERSISTED notification row (status=pending).

Honesty note (W10 audit): the service's channel adapters
(`handlers.send_email` / `handlers.send_sms`) are print-only stubs — no SMTP or
SMS provider integration exists. We therefore do NOT call them and we do NOT
mark anything 'sent'. Every event is persisted to the `notifications` table
with status `pending` (= queued) plus a `notification_delivery_attempts` row
recording the intake. A real dispatcher can pick up pending rows later.

Consumer-group note: under Dapr, the kafka pubsub component derives the Kafka
consumer group from the app-id, so this service's group is distinct from the
nfiu-ctr-str-filing-py subscriber that also reads `transactions.high-value`.
CAVEAT: the shared component infrastructure/new/dapr/components/pubsub.yaml
currently pins `consumerGroup: 54bank-dapr`; if Dapr honours that fixed group
across apps, deliveries would be split between subscribers. Infra should drop
the fixed consumerGroup (or scope one component per consuming app) — flagged
in the R7B report.

Transport note: producers are mixed. payment-hub / maker-checker-go /
standing-orders-go / nfiu-ctr-str-filing-py publish via Dapr; escrow-service
publishes to raw Kafka. Because all Dapr pubsub components here are
kafka-backed against the same broker, a Dapr subscription on component
`pubsub` receives messages for the same Kafka topic regardless of which
component name the producer used. Handlers therefore accept BOTH
CloudEvent-wrapped and raw JSON payloads.
"""

import json
import logging
import os
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from database import (
    Notification,
    NotificationDeliveryAttempt,
    NotificationStatus,
    NotificationType,
    SessionLocal,
)

logger = logging.getLogger("notification-service.events")

router = APIRouter()

# Dapr pubsub component these subscriptions bind to (OR-09 created the
# kafka-backed components; producers publish under several component names
# that all resolve to the same Kafka topics).
DAPR_SUB_PUBSUB = os.getenv("DAPR_SUB_PUBSUB", "pubsub")

# topic -> route
SUBSCRIPTIONS = {
    # payment-hub (OR-12): sanctions block + high-value alerts + lifecycle
    "sanctions.match-blocked": "/events/sanctions-match-blocked",
    "transactions.high-value": "/events/transactions-high-value",
    "payment.completed": "/events/payment-completed",
    "payment.inflow.received": "/events/payment-inflow-received",
    # maker-checker-go (OR-13)
    "approval.requested": "/events/approval-requested",
    "approval.completed": "/events/approval-completed",
    # escrow-service (OR-16)
    "escrow.contract.created": "/events/escrow-contract-created",
    # standing-orders-go (OR-24; producer added by R4 MN-20)
    "standing_orders.failed": "/events/standing-orders-failed",
    # nfiu-ctr-str-filing-py (OR-24: alerting consumer)
    "nfiu.sla-breach": "/events/nfiu-sla-breach",
    "nfiu.filing-failed": "/events/nfiu-filing-failed",
}


@router.get("/dapr/subscribe")
def dapr_subscribe():
    return [
        {"pubsubname": DAPR_SUB_PUBSUB, "topic": topic, "route": route}
        for topic, route in SUBSCRIPTIONS.items()
    ]


def _unwrap(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Accept CloudEvent-wrapped or raw JSON payloads; return the data dict."""
    if isinstance(payload, dict) and "data" in payload and isinstance(payload["data"], (dict, str)):
        data = payload["data"]
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except (ValueError, TypeError):
                return {"raw": data}
        if isinstance(data, dict):
            # carry CloudEvent id for idempotency when present
            if payload.get("id") and "event_id" not in data:
                data = {**data, "event_id": payload["id"]}
            return data
    return payload if isinstance(payload, dict) else {}


def _first(data: Dict[str, Any], *keys: str) -> Optional[str]:
    for k in keys:
        v = data.get(k)
        if v not in (None, ""):
            return str(v)
    return None


def _persist_notification(
    *,
    tenant_id: str,
    user_id: str,
    subject: str,
    message: str,
    topic: str,
    event_id: Optional[str],
    recipient: Optional[str] = None,
) -> str:
    """Persist a queued (pending) in-app notification. Idempotent on event_id.

    Returns 'queued' or 'duplicate'. Never raises on DB error — the caller
    maps failures to a Dapr retry response.
    """
    # Deterministic idempotency key: source event id when available, else a
    # fresh id (at-least-once delivery without an event id cannot be deduped).
    notification_id = f"EVT-{event_id}"[:100] if event_id else f"NTF-{uuid.uuid4().hex[:18].upper()}"

    db = SessionLocal()
    try:
        if event_id and db.query(Notification).filter(Notification.notification_id == notification_id).first():
            return "duplicate"
        row = Notification(
            notification_id=notification_id,
            tenant_id=tenant_id,
            user_id=user_id,
            type=NotificationType.IN_APP,
            channel="in_app",
            recipient=recipient or user_id,
            subject=subject,
            message=message,
            # status=pending == QUEUED. Channel adapters are stubs (print-only);
            # nothing here is marked 'sent' — see module docstring (OR-12).
            status=NotificationStatus.PENDING,
        )
        db.add(row)
        db.flush()
        db.add(
            NotificationDeliveryAttempt(
                notification_id=row.id,
                channel="event-intake",
                status="queued",
                provider_response={"source_topic": topic, "event_id": event_id},
            )
        )
        db.commit()
        return "queued"
    finally:
        db.close()


async def _handle(request: Request, topic: str, build) -> JSONResponse:
    """Shared handler: parse, map, persist. ACK duplicates and bad payloads
    (no poison-message loops); NACK (500) only on persistence failure so Dapr
    retries."""
    try:
        payload = await request.json()
    except Exception:
        logger.warning("event intake: non-JSON body topic=%s", topic)
        return JSONResponse({"status": "SUCCESS"})  # ACK: undeliverable anyway
    data = _unwrap(payload)
    if not data:
        logger.warning("event intake: empty payload topic=%s", topic)
        return JSONResponse({"status": "SUCCESS"})

    spec = build(data)
    if spec is None:
        logger.warning("event intake: unmappable payload topic=%s keys=%s", topic, sorted(data.keys())[:12])
        return JSONResponse({"status": "SUCCESS"})

    try:
        result = _persist_notification(topic=topic, **spec)
    except Exception as exc:
        logger.error("event intake: persist failed topic=%s: %s", topic, exc)
        return JSONResponse({"status": "RETRY"}, status_code=500)
    logger.info("event intake: %s topic=%s tenant=%s", result, topic, spec["tenant_id"])
    return JSONResponse({"status": "SUCCESS"})


# ── topic → notification mapping ─────────────────────────────────────────────
# Each builder returns kwargs for _persist_notification or None if the payload
# lacks the minimum fields (tenant + someone to notify).


def _ops_notification(data: Dict[str, Any], subject: str) -> Optional[Dict[str, Any]]:
    tenant_id = _first(data, "tenantId", "tenant_id") or "platform"
    return {
        "tenant_id": tenant_id,
        "user_id": _first(data, "opsUserId", "ops_user_id") or "compliance-ops",
        "subject": subject,
        "message": json.dumps(data, default=str)[:4000],
        "event_id": _first(data, "event_id", "eventId", "id", "reference", "transactionId", "transaction_id"),
    }


def _customer_notification(data: Dict[str, Any], subject: str) -> Optional[Dict[str, Any]]:
    tenant_id = _first(data, "tenantId", "tenant_id")
    user_id = _first(data, "userId", "user_id", "customerId", "customer_id")
    if not tenant_id or not user_id:
        return None
    return {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "subject": subject,
        "message": json.dumps(data, default=str)[:4000],
        "event_id": _first(data, "event_id", "eventId", "id", "reference", "transactionId", "transaction_id"),
        "recipient": _first(data, "email", "phone", "recipient"),
    }


@router.post(SUBSCRIPTIONS["sanctions.match-blocked"])
async def on_sanctions_match_blocked(request: Request):
    return await _handle(request, "sanctions.match-blocked", lambda d: _ops_notification(d, "Transfer blocked by sanctions screening"))


@router.post(SUBSCRIPTIONS["transactions.high-value"])
async def on_transactions_high_value(request: Request):
    return await _handle(request, "transactions.high-value", lambda d: _ops_notification(d, "High-value transaction alert"))


@router.post(SUBSCRIPTIONS["payment.completed"])
async def on_payment_completed(request: Request):
    return await _handle(request, "payment.completed", lambda d: _customer_notification(d, "Payment completed"))


@router.post(SUBSCRIPTIONS["payment.inflow.received"])
async def on_payment_inflow_received(request: Request):
    return await _handle(request, "payment.inflow.received", lambda d: _customer_notification(d, "Inflow payment received"))


@router.post(SUBSCRIPTIONS["approval.requested"])
async def on_approval_requested(request: Request):
    return await _handle(
        request,
        "approval.requested",
        lambda d: _ops_notification(d, "Approval requested") and {
            **_ops_notification(d, "Approval requested"),
            "user_id": _first(d, "approverId", "approver_id") or "approvers",
        },
    )


@router.post(SUBSCRIPTIONS["approval.completed"])
async def on_approval_completed(request: Request):
    return await _handle(
        request,
        "approval.completed",
        lambda d: _customer_notification(d, "Approval completed") or _ops_notification(d, "Approval completed"),
    )


@router.post(SUBSCRIPTIONS["escrow.contract.created"])
async def on_escrow_contract_created(request: Request):
    return await _handle(request, "escrow.contract.created", lambda d: _customer_notification(d, "Escrow contract created"))


@router.post(SUBSCRIPTIONS["standing_orders.failed"])
async def on_standing_orders_failed(request: Request):
    return await _handle(request, "standing_orders.failed", lambda d: _customer_notification(d, "Standing order failed"))


@router.post(SUBSCRIPTIONS["nfiu.sla-breach"])
async def on_nfiu_sla_breach(request: Request):
    return await _handle(request, "nfiu.sla-breach", lambda d: _ops_notification(d, "CRITICAL: NFIU regulatory filing SLA breach"))


@router.post(SUBSCRIPTIONS["nfiu.filing-failed"])
async def on_nfiu_filing_failed(request: Request):
    return await _handle(request, "nfiu.filing-failed", lambda d: _ops_notification(d, "NFIU regulatory filing failed"))
