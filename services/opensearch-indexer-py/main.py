"""
opensearch-indexer-py — Consumes transaction events via Dapr pub/sub and indexes them into OpenSearch.

Subscribes to:
  - transaction_initiated
  - transaction_failed
  - transaction_success

Published by payment-processing-service using TransactionEventSchema.
"""

import os
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, Any

from fastapi import FastAPI, Depends, HTTPException, Request
from permify_guard import require_permify  # W12-B5P1DF
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from opensearchpy import OpenSearch, RequestsHttpConnection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("opensearch-indexer-py")

OPENSEARCH_URL      = os.environ.get("OPENSEARCH_URL", "http://opensearch:9200")
OPENSEARCH_USERNAME = os.environ.get("OPENSEARCH_USERNAME", "")
OPENSEARCH_PASSWORD = os.environ.get("OPENSEARCH_PASSWORD", "")
DAPR_PUBSUB         = os.environ.get("DAPR_PUBSUB_NAME", os.environ.get("DAPR_PUBSUB", "pubsub"))
INDEX_NAME          = "transactions"

app = FastAPI(title="opensearch-indexer-py", version="1.0.0")

app.add_middleware(GZipMiddleware, minimum_size=1024)
# ---------------------------------------------------------------------------
# OpenSearch client
# ---------------------------------------------------------------------------

def _build_client() -> OpenSearch:
    url = OPENSEARCH_URL.rstrip("/")
    scheme, rest = url.split("://", 1)
    host, *port_part = rest.rsplit(":", 1)
    port = int(port_part[0]) if port_part else (443 if scheme == "https" else 9200)
    kwargs = dict(
        hosts=[{"host": host, "port": port}],
        http_compress=True,
        use_ssl=(scheme == "https"),
        verify_certs=False,
        connection_class=RequestsHttpConnection,
        timeout=10,
    )
    if OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD:
        kwargs["http_auth"] = (OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD)
    return OpenSearch(**kwargs)

_client: Optional[OpenSearch] = None

def get_client() -> OpenSearch:
    global _client
    if _client is None:
        _client = _build_client()
    return _client


INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "transaction_id": {"type": "keyword"},
            "payer":          {"type": "keyword"},
            "payee":          {"type": "keyword"},
            "amount":         {"type": "float"},
            "status":         {"type": "keyword"},
            "currency":       {"type": "keyword"},
            "completed_at":   {"type": "date"},
            "@timestamp":     {"type": "date"},
            "note":           {"type": "text"},
            "tag":            {"type": "keyword"},
            "tenant_id":      {"type": "keyword"},
            "ledger_id":      {"type": "keyword"},
            "topic":          {"type": "keyword"},
        }
    },
    "settings": {
        "number_of_shards": 2,
        "number_of_replicas": 1,
    },
}


@app.on_event("startup")
async def startup():
    try:
        client = get_client()
        if not client.indices.exists(index=INDEX_NAME):
            client.indices.create(index=INDEX_NAME, body=INDEX_MAPPING)
            logger.info("Created index '%s'", INDEX_NAME)
        else:
            logger.info("Index '%s' already exists", INDEX_NAME)
    except Exception as e:
        logger.warning("OpenSearch not ready at startup (will retry on first event): %s", e)
        global _client
        _client = None


# ---------------------------------------------------------------------------
# Dapr event model
# ---------------------------------------------------------------------------

class DaprEvent(BaseModel):
    id: str = ""
    source: str = ""
    type: str = ""
    specversion: str = "1.0"
    datacontenttype: str = "application/json"
    data: dict[str, Any] = {}


def _index(event: DaprEvent, topic: str) -> None:
    data = event.data.copy()
    data["topic"]      = topic
    data["@timestamp"] = datetime.now(timezone.utc).isoformat()

    if "amount" in data:
        try:
            data["amount"] = float(data["amount"])
        except (ValueError, TypeError):
            pass

    get_client().index(
        index=INDEX_NAME,
        id=data.get("transaction_id"),
        body=data,
    )
    logger.info("Indexed %s [%s]", data.get("transaction_id"), topic)


# ---------------------------------------------------------------------------
# Dapr pub/sub subscription declaration
# ---------------------------------------------------------------------------

@app.get("/dapr/subscribe")
def dapr_subscribe():
    return [
        {"pubsubname": DAPR_PUBSUB, "topic": "transaction_initiated", "route": "/transaction_initiated"},
        {"pubsubname": DAPR_PUBSUB, "topic": "transaction_failed",    "route": "/transaction_failed"},
        {"pubsubname": DAPR_PUBSUB, "topic": "transaction_success",   "route": "/transaction_success"},
    ]


# ---------------------------------------------------------------------------
# Event-callback authentication (W12-B5-P0-A, fail-closed)
#
# The /transaction_* POST routes are Dapr pub/sub push callbacks: server-to-
# server deliveries with no end-user JWT, i.e. webhook semantics. They are
# therefore authenticated with a shared-secret HMAC-SHA256 signature over the
# raw request body (X-Event-Signature hex header, "sha256=" prefix tolerated),
# mirroring the webhook HMAC pattern in services/telegram-service/main.go:194.
# TRANSACTION_EVENTS_HMAC_SECRET has NO default: when it is unset every event
# delivery is rejected (401) — fail closed, never warn-and-allow.
# Publishers (payment-processing-service et al.) MUST sign the raw cloud-event
# body with the same secret; see w12 fix-dispositions b5-fixes.md (B5-P0-A).
# ---------------------------------------------------------------------------

EVENTS_HMAC_SECRET = os.environ.get("TRANSACTION_EVENTS_HMAC_SECRET", "")


async def verify_event_signature(request: Request) -> None:
    """FastAPI dependency enforcing HMAC-SHA256 body signatures on the Dapr
    event-delivery callbacks."""
    if not EVENTS_HMAC_SECRET or EVENTS_HMAC_SECRET.startswith("${"):
        logger.error("TRANSACTION_EVENTS_HMAC_SECRET unset — rejecting event delivery (fail-closed)")
        raise HTTPException(status_code=401, detail="event authentication not configured")
    body = await request.body()
    sig = request.headers.get("x-event-signature", "")
    if sig.startswith("sha256="):
        sig = sig[len("sha256="):]
    try:
        provided = bytes.fromhex(sig)
    except ValueError:
        raise HTTPException(status_code=401, detail="invalid event signature encoding")
    expected = hmac.new(EVENTS_HMAC_SECRET.encode(), body, hashlib.sha256).digest()
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="invalid event signature")


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------

@app.post("/transaction_initiated")
def on_initiated(event: DaprEvent, _: None = Depends(verify_event_signature), _p: None = Depends(require_permify("search_index", "transaction_initiated"))):
    try:
        _index(event, "transaction_initiated")
        return {"status": "SUCCESS"}
    except Exception as e:
        logger.error("Index failed [transaction_initiated]: %s", e)
        return {"status": "RETRY"}


@app.post("/transaction_failed")
def on_failed(event: DaprEvent, _: None = Depends(verify_event_signature), _p: None = Depends(require_permify("search_index", "transaction_failed"))):
    try:
        _index(event, "transaction_failed")
        return {"status": "SUCCESS"}
    except Exception as e:
        logger.error("Index failed [transaction_failed]: %s", e)
        return {"status": "RETRY"}


@app.post("/transaction_success")
def on_success(event: DaprEvent, _: None = Depends(verify_event_signature), _p: None = Depends(require_permify("search_index", "transaction_success"))):
    try:
        _index(event, "transaction_success")
        return {"status": "SUCCESS"}
    except Exception as e:
        logger.error("Index failed [transaction_success]: %s", e)
        return {"status": "RETRY"}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/healthz")
def healthz():
    os_ok = False
    try:
        os_ok = get_client().ping()
    except Exception:
        pass
    return {"status": "healthy", "service": "opensearch-indexer-py", "opensearch": os_ok}


@app.get("/readyz")
def readyz():
    return {"ready": True}
