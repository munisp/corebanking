"""
Middleware integration — real TigerBeetle ledger posting + Kafka event publishing.

Posts balanced double-entry transfers to the TigerBeetle HTTP gateway and
publishes domain events to the Kafka REST proxy. Uses the stdlib only (no extra
dependency).

Failure semantics (fail closed):
- Ledger postings (post_ledger_transfer) are MONEY MOVEMENT. Any failure raises
  LedgerPostError — callers must roll back / mark the settlement failed and must
  never mark a payout complete when the ledger post failed.
- Event publishing (publish_domain_event) is non-fatal by design: a broker
  outage is logged, never failing the request.

Money is handled in integer minor units (kobo) only. Ledger transfer IDs are
deterministic idempotency keys derived from natural/business keys via SHA-256
(never timestamps alone), so retries are deduplicated by the ledger.

Blocking I/O runs in a worker thread via asyncio.to_thread.
"""

import asyncio
import hashlib
import json
import logging
import os
import time
import urllib.request
from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger("merchant-service.events")

SERVICE_NAME = "merchant-service"
KAFKA_TOPIC = "merchant.settlements"
# Merchant settlement payout: Dr merchant settlement payable, Cr cash at bank.
DEBIT_ACCOUNT = "2400"
CREDIT_ACCOUNT = "1100"
TXN_CODE = 4001


class LedgerPostError(Exception):
    """Raised when a ledger transfer cannot be posted. Always fail closed."""


def ledger_transfer_id(settlement_id: str, nature: str = "payout") -> str:
    """Deterministic idempotency key for a ledger transfer.

    SHA-256 over the natural/business keys (settlement id + attempt nature) —
    never a timestamp — so redeliveries/retries collapse to the same transfer.
    """
    natural_key = f"merchant-settlement:{settlement_id}:{nature}"
    return hashlib.sha256(natural_key.encode("utf-8")).hexdigest()


def to_kobo(amount) -> int:
    """Convert a Decimal/str amount in Naira to integer kobo.

    No float math on money. Raises LedgerPostError on invalid/non-positive
    amounts so a bad payout can never be posted.
    """
    try:
        d = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception as exc:
        raise LedgerPostError(f"Invalid payout amount: {exc.__class__.__name__}") from exc
    kobo = int(d * 100)
    if kobo <= 0:
        raise LedgerPostError("Payout amount must be positive")
    return kobo


def _tigerbeetle_url() -> str:
    return os.getenv("TIGERBEETLE_URL", "http://tigerbeetle-adapter:3000")


def _kafka_url() -> str:
    return os.getenv("KAFKA_REST_URL") or os.getenv("KAFKA_BROKER_URL") or "http://kafka-rest-proxy:8082"


def _post(url: str, body: dict, tenant_id: str = "") -> None:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if tenant_id:
        req.add_header("X-Tenant-ID", tenant_id)
    with urllib.request.urlopen(req, timeout=5) as resp:
        resp.read()


def _post_ledger_transfer_sync(transfer_id: str, amount_kobo: int, tenant_id: str, currency: str) -> None:
    if amount_kobo <= 0:
        raise LedgerPostError("Payout amount must be positive")
    payload = {
        "transfers": [
            {
                "id": transfer_id,
                "debitAccount": DEBIT_ACCOUNT,
                "creditAccount": CREDIT_ACCOUNT,
                "amount": amount_kobo,
                "currency": currency or "NGN",
                "ledger": 1,
                "code": TXN_CODE,
                "flags": 0,
                "timestamp": time.time_ns(),
            }
        ]
    }
    try:
        _post(_tigerbeetle_url() + "/transfers", payload, tenant_id)
        logger.info("ledger posted ref=%s amount=%d", transfer_id, amount_kobo)
    except LedgerPostError:
        raise
    except Exception as exc:
        # Money movement must fail closed: propagate, never swallow.
        logger.error("ledger post FAILED ref=%s: %s", transfer_id, exc)
        raise LedgerPostError("Ledger posting failed") from exc


def _publish_domain_event_sync(event_type: str, tenant_id: str, payload: dict) -> None:
    body = {
        "eventType": event_type,
        "tenantID": tenant_id,
        "service": SERVICE_NAME,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "payload": payload,
    }
    try:
        _post(_kafka_url() + "/topics/" + KAFKA_TOPIC, body, tenant_id)
    except Exception as exc:  # noqa: BLE001 - events are non-fatal by design
        logger.warning("kafka publish error (non-fatal) type=%s: %s", event_type, exc)


async def post_ledger_transfer(transfer_id: str, amount, tenant_id: str = "", currency: str = "NGN") -> None:
    """Post a settlement payout transfer to the ledger.

    ``transfer_id`` MUST be a deterministic idempotency key (see
    ``ledger_transfer_id``). ``amount`` is in Naira (Decimal/str) and is
    converted to integer kobo without float math.

    Raises LedgerPostError on any failure — callers must not mark the
    settlement complete unless this returns without raising.
    """
    amount_kobo = to_kobo(amount)
    await asyncio.to_thread(_post_ledger_transfer_sync, transfer_id, amount_kobo, tenant_id, currency)


async def publish_domain_event(event_type: str, tenant_id: str, payload: dict) -> None:
    await asyncio.to_thread(_publish_domain_event_sync, event_type, tenant_id, payload)
