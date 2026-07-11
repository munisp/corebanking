"""
Middleware integration — real TigerBeetle ledger posting + Kafka event publishing.

Posts balanced double-entry transfers to the TigerBeetle HTTP gateway and
publishes domain events to the Kafka REST proxy. Uses the stdlib only (no extra
dependency) and degrades gracefully: a broker/ledger outage is logged, never
failing the request. Blocking I/O runs in a worker thread via asyncio.to_thread.
"""

import asyncio
import json
import logging
import os
import time
import urllib.request

logger = logging.getLogger("merchant-service.events")

SERVICE_NAME = "merchant-service"
KAFKA_TOPIC = "merchant.settlements"
# Merchant settlement payout: Dr merchant settlement payable, Cr cash at bank.
DEBIT_ACCOUNT = "2400"
CREDIT_ACCOUNT = "1100"
TXN_CODE = 4001


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


def _post_ledger_transfer_sync(ref: str, amount_naira: float, tenant_id: str, currency: str) -> None:
    amount_kobo = int(round(float(amount_naira) * 100))
    if amount_kobo <= 0:
        return
    payload = {
        "transfers": [
            {
                "id": ref,
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
        logger.info("ledger posted ref=%s amount=%d", ref, amount_kobo)
    except Exception as exc:  # noqa: BLE001 - non-fatal by design
        logger.warning("ledger post error (non-fatal) ref=%s: %s", ref, exc)


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
    except Exception as exc:  # noqa: BLE001 - non-fatal by design
        logger.warning("kafka publish error (non-fatal) type=%s: %s", event_type, exc)


async def post_ledger_transfer(ref: str, amount_naira: float, tenant_id: str = "", currency: str = "NGN") -> None:
    await asyncio.to_thread(_post_ledger_transfer_sync, ref, amount_naira, tenant_id, currency)


async def publish_domain_event(event_type: str, tenant_id: str, payload: dict) -> None:
    await asyncio.to_thread(_publish_domain_event_sync, event_type, tenant_id, payload)
