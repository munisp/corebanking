"""W12 B5-P1-F: real OpenSearch screening client for kyc-aml-screening-py.

Replaces the SQL `name ILIKE ANY(...)` candidate narrowing (formerly
service.py:374) with real OpenSearch queries over the `sanctions-names` and
`pep-names` indices:

  - Index mappings live in config/opensearch/{sanctions-names,pep-names}.json
    (loaded from disk; the same JSON is the source of truth for index
    creation — see the `_readme` field in each file).
  - Matching: `match` on the edge_ngram-analyzed `name` field with
    `fuzziness: AUTO` (built-in edit-distance) + an exact `term` boost on
    `name_normalized`. The cluster image (opensearchproject/opensearch:2.19.0,
    docker-compose.yml:58-66) ships no phonetic plugin, so phonetic matching
    is intentionally NOT used; edge_ngram + AUTO fuzziness cover prefix and
    typo tolerance with stock analyzers only.
  - Score threshold is configurable via SCREENING_MIN_SCORE (OpenSearch
    min_score for candidate retrieval); the Python-side SCREENING_MATCH_THRESHOLD
    re-scoring contract in service.py is unchanged.
  - FAIL-CLOSED: any OpenSearch unavailability raises OpenSearchUnavailable,
    which service.py maps to ScreeningUnavailable -> HTTP 503. A screening
    service that cannot reach its screening index must never silently pass
    traffic.

Stdlib-only (urllib) — no new pip dependencies, no hardcoded credentials
(optional OPENSEARCH_USERNAME/OPENSEARCH_PASSWORD envs are honored when the
cluster security plugin is enabled; compose runs DISABLE_SECURITY_PLUGIN=true).
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

# Fleet convention (docker-compose.yml gateway + opensearch-indexer-py):
# OPENSEARCH_URL is canonical; OPENSEARCH_ENDPOINT kept for back-compat with
# this service's existing deployments.
OPENSEARCH_URL = (
    os.environ.get("OPENSEARCH_URL")
    or os.environ.get("OPENSEARCH_ENDPOINT")
    or ""
).rstrip("/")
OPENSEARCH_USERNAME = os.environ.get("OPENSEARCH_USERNAME", "")
OPENSEARCH_PASSWORD = os.environ.get("OPENSEARCH_PASSWORD", "")

SANCTIONS_INDEX = os.environ.get("SANCTIONS_INDEX", "sanctions-names")
PEP_INDEX = os.environ.get("PEP_INDEX", "pep-names")

# OpenSearch min_score for candidate retrieval (NOT the screening decision
# threshold — that stays SCREENING_MATCH_THRESHOLD in service.py).
SCREENING_MIN_SCORE = float(os.environ.get("SCREENING_MIN_SCORE", "1.5"))
HTTP_TIMEOUT = float(os.environ.get("SCREENING_OS_TIMEOUT_SECONDS", "6"))
CANDIDATE_LIMIT = int(os.environ.get("SCREENING_OS_CANDIDATE_LIMIT", "50"))

_CONFIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config", "opensearch")


class OpenSearchUnavailable(Exception):
    """Raised when the OpenSearch cluster or screening index cannot be used."""


def _request(method: str, path: str, body: bytes | None = None,
             timeout: float = HTTP_TIMEOUT,
             content_type: str = "application/json") -> tuple[int, bytes]:
    if not OPENSEARCH_URL:
        raise OpenSearchUnavailable(
            "OpenSearch not configured (set OPENSEARCH_URL or OPENSEARCH_ENDPOINT)")
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
    # red means primaries unassigned — not usable for screening.
    ok = cluster_status in ("green", "yellow")
    return ok, f"cluster_status={cluster_status}"


def load_mapping(index_name: str) -> dict:
    """Load the index creation body from config/opensearch/<index>.json."""
    path = os.path.join(_CONFIG_DIR, f"{index_name}.json")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            body = json.load(fh)
    except Exception as e:
        raise OpenSearchUnavailable(f"index mapping file unreadable: {path}: {e}")
    body.pop("_readme", None)
    return body


def ensure_index(index_name: str) -> None:
    """Create the index with its shipped mapping when missing (idempotent)."""
    status, _ = _request("HEAD", f"/{index_name}")
    if status == 200:
        return
    body = json.dumps(load_mapping(index_name)).encode()
    status, raw = _request("PUT", f"/{index_name}", body=body)
    if status >= 300:
        raise OpenSearchUnavailable(
            f"failed to create index {index_name}: http_{status} {raw[:300]!r}")


def bulk_index(index_name: str, docs: list[tuple[str, dict]]) -> int:
    """Bulk-index (idempotently, by natural _id). Returns doc count.

    Raises OpenSearchUnavailable on transport failure or per-item errors —
    partial silent ingestion is unacceptable for a screening list.
    """
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


def index_doc(index_name: str, doc_id: str, doc: dict) -> None:
    status, raw = _request(
        "PUT", f"/{index_name}/_doc/{urllib.parse.quote(doc_id, safe='')}?refresh=true",
        body=json.dumps(doc, default=str).encode())
    if status >= 300:
        raise OpenSearchUnavailable(f"index doc http_{status}: {raw[:300]!r}")


def delete_doc(index_name: str, doc_id: str) -> None:
    status, raw = _request(
        "DELETE", f"/{index_name}/_doc/{urllib.parse.quote(doc_id, safe='')}?refresh=true")
    if status >= 300 and status != 404:
        raise OpenSearchUnavailable(f"delete doc http_{status}: {raw[:300]!r}")


def normalize_name(name: str) -> str:
    """Same normalization contract as service.py _normalize_name."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", (name or "").lower())).strip()


def search_name_candidates(index_name: str, name: str,
                           size: int = CANDIDATE_LIMIT,
                           min_score: float | None = None,
                           extra_filter: dict | None = None) -> list[dict]:
    """Run the real screening query: exact-term boost + fuzzy match.

    Returns a list of hit dicts {"_id", "_score", "_source": {...}} ordered by
    score desc. Raises OpenSearchUnavailable on any failure (fail closed).
    """
    norm = normalize_name(name)
    if not norm:
        return []
    should = [
        {"term": {"name_normalized": {"value": norm, "boost": 5.0}}},
        {"match": {"name": {"query": norm, "fuzziness": "AUTO",
                            "prefix_length": 1, "boost": 2.0}}},
        {"match_phrase": {"name.std": {"query": norm, "boost": 3.0}}},
    ]
    query: dict = {
        "bool": {"should": should, "minimum_should_match": 1}
    }
    if extra_filter:
        query["bool"]["filter"] = extra_filter
    body = {
        "size": size,
        "min_score": SCREENING_MIN_SCORE if min_score is None else min_score,
        "track_scores": True,
        "sort": ["_score"],
        "query": query,
    }
    status, raw = _request(
        "POST", f"/{index_name}/_search", body=json.dumps(body).encode())
    if status == 404:
        raise OpenSearchUnavailable(
            f"screening index {index_name} missing — run the watchlist sync")
    if status >= 300:
        raise OpenSearchUnavailable(f"search http_{status}: {raw[:300]!r}")
    result = json.loads(raw.decode())
    return result.get("hits", {}).get("hits", [])


def count_docs(index_name: str) -> int:
    status, raw = _request("GET", f"/{index_name}/_count")
    if status >= 300:
        raise OpenSearchUnavailable(f"count http_{status}: {raw[:300]!r}")
    return int(json.loads(raw.decode()).get("count", 0))
