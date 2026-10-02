"""W12 B5-P1-F: real OpenSearch search client for fraud-service.

Replaces the ILIKE substring scans in main.py:
  - list_fraud_alerts  (customer_id / description / alert_type ILIKE, :1189)
  - list_blocked_entities (entity_id ILIKE, :1334)

Design:
  - Indices: fraud-alerts + fraud-blocked-entities, mappings shipped in
    config/opensearch/*.json (stock OpenSearch 2.19.0 analyzers only — the
    compose image has no phonetic plugin; edge_ngram + fuzziness=AUTO instead).
  - Ingestion: dual-write with the real Postgres INSERT/UPDATE flows
    (check_transaction, resolve_fraud_alert, block_entity, unblock_entity),
    plus an idempotent backfill from Postgres (the source of truth) on boot
    and via POST /api/v1/fraud/opensearch/reindex. Natural _ids:
    alert_id for alerts; {tenant}:{entity_type}:{entity_id} for blocked
    entities.
  - Queries: multi-field `match` with fuzziness=AUTO, tenant-filtered,
    min_score configurable via SCREENING_MIN_SCORE. Search returns ordered
    ids; main.py hydrates full rows from Postgres so the response contract
    is byte-identical to the retired SQL path.
  - FAIL-CLOSED: when a `search` parameter is supplied and OpenSearch is
    unreachable, OpenSearchUnavailable is raised and main.py answers 503 —
    never a silent unfiltered or substring-matched fallback.

Stdlib-only (urllib) so it runs cleanly inside asyncio.to_thread — no new pip
dependencies, no hardcoded credentials (optional OPENSEARCH_USERNAME /
OPENSEARCH_PASSWORD honored when set).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

# Fleet convention: OPENSEARCH_URL canonical (docker-compose.yml gateway,
# opensearch-indexer-py); OPENSEARCH_ENDPOINT kept for back-compat.
OPENSEARCH_URL = (
    os.environ.get("OPENSEARCH_URL")
    or os.environ.get("OPENSEARCH_ENDPOINT")
    or "http://opensearch:9200"
).rstrip("/")
OPENSEARCH_USERNAME = os.environ.get("OPENSEARCH_USERNAME", "")
OPENSEARCH_PASSWORD = os.environ.get("OPENSEARCH_PASSWORD", "")

ALERTS_INDEX = os.environ.get("FRAUD_ALERTS_INDEX", "fraud-alerts")
BLOCKED_INDEX = os.environ.get("FRAUD_BLOCKED_INDEX", "fraud-blocked-entities")
SCREENING_MIN_SCORE = float(os.environ.get("SCREENING_MIN_SCORE", "0.5"))
HTTP_TIMEOUT = float(os.environ.get("SCREENING_OS_TIMEOUT_SECONDS", "6"))

_CONFIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config", "opensearch")


class OpenSearchUnavailable(Exception):
    """Raised when the OpenSearch cluster or an index cannot be used."""


def _request(method: str, path: str, body: bytes | None = None,
             timeout: float = HTTP_TIMEOUT,
             content_type: str = "application/json") -> tuple[int, bytes]:
    if not OPENSEARCH_URL:
        raise OpenSearchUnavailable("OpenSearch not configured")
    req = urllib.request.Request(
        OPENSEARCH_URL + path, data=body, method=method,
        headers={"Content-Type": content_type, "Accept": "application/json"})
    if OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD:
        import base64
        token = base64.b64encode(
            f"{OPENSEARCH_USERNAME}:{OPENSEARCH_PASSWORD}".encode()).decode()
        req.add_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        raise OpenSearchUnavailable(f"OpenSearch unreachable at {OPENSEARCH_URL}: {e}")


def ping() -> tuple[bool, str]:
    """Real cluster reachability probe for the health endpoint."""
    if not OPENSEARCH_URL:
        return False, "not_configured"
    try:
        status, raw = _request("GET", "/_cluster/health", timeout=3.0)
    except OpenSearchUnavailable as e:
        return False, str(e)
    if status >= 400:
        return False, f"http_{status}"
    try:
        cluster_status = json.loads(raw.decode()).get("status", "unknown")
    except Exception:
        cluster_status = "unknown"
    ok = cluster_status in ("green", "yellow")
    return ok, f"cluster_status={cluster_status}"


def load_mapping(index_name: str) -> dict:
    path = os.path.join(_CONFIG_DIR, f"{index_name}.json")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            body = json.load(fh)
    except Exception as e:
        raise OpenSearchUnavailable(f"index mapping file unreadable: {path}: {e}")
    body.pop("_readme", None)
    return body


def ensure_index(index_name: str) -> None:
    status, _ = _request("HEAD", f"/{index_name}")
    if status == 200:
        return
    body = json.dumps(load_mapping(index_name)).encode()
    status, raw = _request("PUT", f"/{index_name}", body=body)
    if status >= 300:
        raise OpenSearchUnavailable(
            f"failed to create index {index_name}: http_{status} {raw[:300]!r}")


def _iso(value) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else (str(value) if value else None)


def alert_doc(alert_id: str, tenant_id: str, customer_id, alert_type: str,
              severity: str, description: str, related_entities,
              status: str = "open", assigned_to=None, resolution_notes=None,
              created_at=None, resolved_at=None) -> tuple[str, dict]:
    """Doc for the fraud-alerts index. Natural _id = alert_id (idempotent)."""
    if isinstance(related_entities, (dict, list)):
        related_entities = json.dumps(related_entities, default=str)
    return alert_id, {
        "alert_id": alert_id,
        "tenant_id": tenant_id,
        "customer_id": customer_id or "",
        "alert_type": alert_type,
        "severity": severity,
        "status": status,
        "description": description or "",
        "related_entities": related_entities or "",
        "assigned_to": assigned_to or "",
        "resolution_notes": resolution_notes or "",
        "created_at": _iso(created_at),
        "resolved_at": _iso(resolved_at),
    }


def blocked_doc(entity_id: str, entity_type: str, tenant_id: str, reason: str,
                blocked_by=None, blocked_until=None, is_permanent: bool = False,
                created_at=None) -> tuple[str, dict]:
    """Doc for the fraud-blocked-entities index. Natural _id is the composite
    business key (idempotent re-indexing of the same entity)."""
    doc_id = f"{tenant_id}:{entity_type}:{entity_id}"
    return doc_id, {
        "entity_id": entity_id,
        "entity_type": entity_type,
        "tenant_id": tenant_id,
        "reason": reason or "",
        "blocked_by": blocked_by or "",
        "blocked_until": _iso(blocked_until),
        "is_permanent": bool(is_permanent),
        "created_at": _iso(created_at),
    }


def index_doc(index_name: str, doc_id: str, doc: dict) -> None:
    status, raw = _request(
        "PUT", f"/{index_name}/_doc/{urllib.parse.quote(doc_id, safe='')}?refresh=true",
        body=json.dumps(doc, default=str).encode())
    if status >= 300:
        raise OpenSearchUnavailable(f"index doc http_{status}: {raw[:300]!r}")


def bulk_index(index_name: str, docs: list[tuple[str, dict]]) -> int:
    """Bulk-index (idempotent by natural _id). Raises on any item error."""
    if not docs:
        return 0
    lines = []
    for doc_id, doc in docs:
        lines.append(json.dumps({"index": {"_index": index_name, "_id": doc_id}}))
        lines.append(json.dumps(doc, default=str))
    payload = ("\n".join(lines) + "\n").encode()
    status, raw = _request(
        "POST", "/_bulk?refresh=true", body=payload,
        timeout=max(HTTP_TIMEOUT, 30), content_type="application/x-ndjson")
    if status >= 300:
        raise OpenSearchUnavailable(f"bulk index http_{status}: {raw[:300]!r}")
    result = json.loads(raw.decode())
    if result.get("errors"):
        first = next(
            (item["index"] for item in result.get("items", [])
             if item.get("index", {}).get("error")), {})
        raise OpenSearchUnavailable(f"bulk item error: {json.dumps(first)[:300]}")
    return len(docs)


def search_alert_ids(tenant_id: str, search: str, size: int = 200) -> list[str]:
    """Real alert search: multi-field match + fuzziness=AUTO, tenant-filtered.
    Returns alert_ids ordered by relevance score desc. Fail closed."""
    body = {
        "size": size,
        "min_score": SCREENING_MIN_SCORE,
        "_source": False,
        "sort": ["_score"],
        "query": {
            "bool": {
                "filter": [{"term": {"tenant_id": tenant_id}}],
                "should": [
                    {"match": {"customer_id": {"query": search, "fuzziness": "AUTO",
                                               "prefix_length": 1, "boost": 2.0}}},
                    {"match": {"description": {"query": search, "fuzziness": "AUTO",
                                               "prefix_length": 1}}},
                    {"match": {"alert_type": {"query": search, "fuzziness": "AUTO",
                                              "prefix_length": 1, "boost": 2.0}}},
                    {"term": {"customer_id.raw": {"value": search, "boost": 5.0}}},
                    {"term": {"alert_id": {"value": search, "boost": 5.0}}},
                ],
                "minimum_should_match": 1,
            }
        },
    }
    status, raw = _request("POST", f"/{ALERTS_INDEX}/_search", body=json.dumps(body).encode())
    if status == 404:
        raise OpenSearchUnavailable(
            f"index {ALERTS_INDEX} missing — run the fraud-alerts sync")
    if status >= 300:
        raise OpenSearchUnavailable(f"search http_{status}: {raw[:300]!r}")
    hits = json.loads(raw.decode()).get("hits", {}).get("hits", [])
    return [h["_id"] for h in hits]


def search_blocked_entity_keys(tenant_id: str, search: str, size: int = 500) -> list[tuple[str, str]]:
    """Real blocked-entity search on entity_id (fuzzy). Returns ordered
    (entity_type, entity_id) pairs for hydration. Fail closed."""
    body = {
        "size": size,
        "min_score": SCREENING_MIN_SCORE,
        "sort": ["_score"],
        "query": {
            "bool": {
                "filter": [{"term": {"tenant_id": tenant_id}}],
                "should": [
                    {"match": {"entity_id": {"query": search, "fuzziness": "AUTO",
                                             "prefix_length": 1, "boost": 2.0}}},
                    {"term": {"entity_id.raw": {"value": search, "boost": 5.0}}},
                    {"match": {"reason": {"query": search, "fuzziness": "AUTO",
                                          "prefix_length": 1}}},
                ],
                "minimum_should_match": 1,
            }
        },
    }
    status, raw = _request("POST", f"/{BLOCKED_INDEX}/_search", body=json.dumps(body).encode())
    if status == 404:
        raise OpenSearchUnavailable(
            f"index {BLOCKED_INDEX} missing — run the blocked-entities sync")
    if status >= 300:
        raise OpenSearchUnavailable(f"search http_{status}: {raw[:300]!r}")
    hits = json.loads(raw.decode()).get("hits", {}).get("hits", [])
    return [(h["_source"]["entity_type"], h["_source"]["entity_id"]) for h in hits]
