"""W12 B5-P1-F: real OpenSearch screening client for pep-enhanced-dd-py.

Replaces the `ILIKE '%'||name||'%'` person-level PEP match (formerly
main.py:828-829) with a real OpenSearch query over the shared `pep-names`
index:

  - Mapping: config/opensearch/pep-names.json — SHARED byte-identical with
    kyc-aml-screening-py's copy (single consolidated pep-names index; see the
    `_readme` field in the JSON). This service only queries/writes docs with
    an `entry_id` (curated pep_entries rows), preserving the original
    pep_entries-only screening semantics.
  - Matching: `term` boost on `name_normalized` + `match` with
    fuzziness=AUTO over the edge_ngram-analyzed `name` field. The compose
    image (opensearchproject/opensearch:2.19.0, docker-compose.yml:58-66) has
    no phonetic plugin — stock analyzers only.
  - Score threshold configurable via SCREENING_MIN_SCORE (OpenSearch
    min_score for candidate retrieval).
  - FAIL-CLOSED: OpenSearch unavailability raises OpenSearchUnavailable;
    main.py maps that to HTTP 503 (same as the previous DB-failure contract).

Stdlib-only (urllib) — no new pip dependencies, no hardcoded credentials
(optional OPENSEARCH_USERNAME/OPENSEARCH_PASSWORD honored when set).
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

PEP_INDEX = os.environ.get("PEP_INDEX", "pep-names")
SCREENING_MIN_SCORE = float(os.environ.get("SCREENING_MIN_SCORE", "1.5"))
HTTP_TIMEOUT = float(os.environ.get("SCREENING_OS_TIMEOUT_SECONDS", "6"))
CANDIDATE_LIMIT = int(os.environ.get("SCREENING_OS_CANDIDATE_LIMIT", "5"))

_CONFIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config", "opensearch")

# Preserve pep_entries-only screening semantics on the shared index: only
# curated, active entries written by THIS service are candidates.
PEP_ENTRY_FILTER = {
    "bool": {
        "filter": [
            {"exists": {"field": "entry_id"}},
            {"term": {"active": True}},
        ]
    }
}


class OpenSearchUnavailable(Exception):
    """Raised when the OpenSearch cluster or pep-names index cannot be used."""


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


def ensure_index(index_name: str = PEP_INDEX) -> None:
    """Create pep-names with the shipped mapping when missing (idempotent)."""
    status, _ = _request("HEAD", f"/{index_name}")
    if status == 200:
        return
    body = json.dumps(load_mapping(index_name)).encode()
    status, raw = _request("PUT", f"/{index_name}", body=body)
    if status >= 300:
        raise OpenSearchUnavailable(
            f"failed to create index {index_name}: http_{status} {raw[:300]!r}")


def entry_doc(entry_id, full_name: str, name_normalized: str, position: str,
              tier: str, country: str, source: str, active: bool = True,
              created_at=None) -> tuple[str, dict]:
    """Build an OpenSearch doc from a real pep_entries row.

    Natural _id = entry-{uuid} — idempotent dual-write and resync."""
    return f"entry-{entry_id}", {
        "entry_id": str(entry_id),
        "name": full_name,
        "name_normalized": name_normalized,
        "position": position,
        "tier": tier,
        "country": country or "",
        "source": source or "",
        "active": bool(active),
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else None,
    }


def bulk_index(docs: list[tuple[str, dict]], index_name: str = PEP_INDEX) -> int:
    """Bulk-index (idempotent by natural _id). Raises on any item error —
    partial silent ingestion is unacceptable for a screening list."""
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


def index_entry(doc_id: str, doc: dict, index_name: str = PEP_INDEX) -> None:
    status, raw = _request(
        "PUT", f"/{index_name}/_doc/{urllib.parse.quote(doc_id, safe='')}?refresh=true",
        body=json.dumps(doc, default=str).encode())
    if status >= 300:
        raise OpenSearchUnavailable(f"index doc http_{status}: {raw[:300]!r}")


def search_pep_candidates(name: str, name_normalized: str,
                          size: int = CANDIDATE_LIMIT,
                          min_score: float | None = None) -> list[dict]:
    """Real PEP candidate query: exact-term boost + fuzzy match, restricted to
    curated active pep_entries docs. Returns hits ordered by score desc.
    Raises OpenSearchUnavailable on any failure (fail closed)."""
    if not name_normalized:
        return []
    body = {
        "size": size,
        "min_score": SCREENING_MIN_SCORE if min_score is None else min_score,
        "track_scores": True,
        "sort": ["_score"],
        "query": {
            "bool": {
                "should": [
                    {"term": {"name_normalized": {"value": name_normalized, "boost": 5.0}}},
                    {"match": {"name": {"query": name_normalized, "fuzziness": "AUTO",
                                        "prefix_length": 1, "boost": 2.0}}},
                    {"match_phrase": {"name.std": {"query": name_normalized, "boost": 3.0}}},
                ],
                "minimum_should_match": 1,
                "filter": PEP_ENTRY_FILTER,
            }
        },
    }
    status, raw = _request("POST", f"/{PEP_INDEX}/_search", body=json.dumps(body).encode())
    if status == 404:
        raise OpenSearchUnavailable(
            f"screening index {PEP_INDEX} missing — run the pep_entries sync")
    if status >= 300:
        raise OpenSearchUnavailable(f"search http_{status}: {raw[:300]!r}")
    result = json.loads(raw.decode())
    return result.get("hits", {}).get("hits", [])


def hit_to_entry(hit: dict) -> dict:
    """Map a hit to the pep_entries row contract
    ({id, full_name, position, tier, country, source}) used by /api/v1/pep/screen."""
    src = hit.get("_source", {})
    return {
        "id": src.get("entry_id"),
        "full_name": src.get("name", ""),
        "position": src.get("position", ""),
        "tier": src.get("tier", ""),
        "country": src.get("country", ""),
        "source": src.get("source", ""),
        "match_score": hit.get("_score"),
    }
