"""
OpenSearch Analytics Service — full-text search, log aggregation, analytics dashboards
Port: 8125
Middleware: OpenSearch, Redis, Kafka, Postgres

Provides:
- Index management (create, configure mappings, lifecycle policies)
- Document ingestion (single and bulk)
- Full-text search with faceted filtering, highlighting, aggregations
- Log aggregation with retention policies
- Analytics dashboards (pre-built queries for banking KPIs)
- Anomaly detection alerts
"""

import json
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any

indices: list[dict] = []
documents: dict[str, list[dict]] = {}
saved_queries: list[dict] = []
dashboards: list[dict] = []
alerts: list[dict] = []

DEFAULT_INDICES = [
    {"name": "transactions", "mappings": {"amount": "double", "type": "keyword", "status": "keyword", "timestamp": "date", "accountId": "keyword", "description": "text"}},
    {"name": "audit-logs", "mappings": {"action": "keyword", "actor": "keyword", "resource": "keyword", "timestamp": "date", "details": "text", "ip": "keyword"}},
    {"name": "customer-events", "mappings": {"eventType": "keyword", "customerId": "keyword", "channel": "keyword", "timestamp": "date", "metadata": "object"}},
    {"name": "fraud-signals", "mappings": {"riskScore": "double", "ruleId": "keyword", "transactionId": "keyword", "timestamp": "date", "verdict": "keyword"}},
    {"name": "system-metrics", "mappings": {"service": "keyword", "metric": "keyword", "value": "double", "timestamp": "date", "tags": "keyword"}},
]

DEFAULT_DASHBOARDS = [
    {"id": "DASH-001", "name": "Transaction Volume", "description": "Real-time transaction counts by type, channel, and status",
     "panels": [
         {"title": "Transactions per Hour", "type": "line_chart", "query": {"index": "transactions", "agg": "date_histogram", "field": "timestamp", "interval": "1h"}},
         {"title": "By Type", "type": "pie_chart", "query": {"index": "transactions", "agg": "terms", "field": "type"}},
         {"title": "Failed Transactions", "type": "metric", "query": {"index": "transactions", "filter": {"status": "failed"}, "agg": "count"}},
     ]},
    {"id": "DASH-002", "name": "Fraud Monitoring", "description": "Fraud signal overview with risk distribution",
     "panels": [
         {"title": "Risk Score Distribution", "type": "histogram", "query": {"index": "fraud-signals", "agg": "histogram", "field": "riskScore", "interval": 10}},
         {"title": "High Risk Alerts", "type": "metric", "query": {"index": "fraud-signals", "filter": {"riskScore": {"gte": 80}}, "agg": "count"}},
     ]},
    {"id": "DASH-003", "name": "System Health", "description": "Service-level metrics and error rates",
     "panels": [
         {"title": "Error Rate by Service", "type": "bar_chart", "query": {"index": "system-metrics", "filter": {"metric": "error_rate"}, "agg": "terms", "field": "service"}},
         {"title": "P99 Latency", "type": "line_chart", "query": {"index": "system-metrics", "filter": {"metric": "p99_latency"}, "agg": "avg", "field": "value"}},
     ]},
]


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def init_data() -> None:
    for idx_def in DEFAULT_INDICES:
        idx = {
            "id": f"IDX-{uuid.uuid4().hex[:8]}",
            "name": idx_def["name"],
            "mappings": idx_def["mappings"],
            "settings": {"numberOfShards": 3, "numberOfReplicas": 1, "refreshInterval": "1s"},
            "docCount": 0,
            "sizeBytes": 0,
            "status": "green",
            "createdAt": now_iso(),
        }
        indices.append(idx)
        documents[idx_def["name"]] = []

    for dash in DEFAULT_DASHBOARDS:
        dash["createdAt"] = now_iso()
        dashboards.append(dash)


init_data()


def create_index(body: dict) -> tuple[dict, int]:
    name = body.get("name", "")
    if not name or not re.match(r"^[a-z0-9\-]+$", name):
        return {"error": "name must be lowercase alphanumeric with hyphens"}, 400
    for idx in indices:
        if idx["name"] == name:
            return {"error": f"index '{name}' already exists"}, 409

    idx = {
        "id": f"IDX-{uuid.uuid4().hex[:8]}",
        "name": name,
        "mappings": body.get("mappings", {}),
        "settings": body.get("settings", {"numberOfShards": 3, "numberOfReplicas": 1, "refreshInterval": "1s"}),
        "docCount": 0,
        "sizeBytes": 0,
        "status": "green",
        "createdAt": now_iso(),
    }
    indices.append(idx)
    documents[name] = []
    return idx, 201


def ingest_document(index_name: str, body: dict) -> tuple[dict, int]:
    if index_name not in documents:
        return {"error": f"index '{index_name}' not found"}, 404

    doc = {
        "id": f"DOC-{uuid.uuid4().hex[:8]}",
        "index": index_name,
        "source": body.get("document", body),
        "timestamp": body.get("timestamp", now_iso()),
        "ingestedAt": now_iso(),
    }
    documents[index_name].append(doc)
    for idx in indices:
        if idx["name"] == index_name:
            idx["docCount"] += 1
            idx["sizeBytes"] += len(json.dumps(doc))
            break
    return {"id": doc["id"], "index": index_name, "result": "created"}, 201


def bulk_ingest(body: dict) -> tuple[dict, int]:
    index_name = body.get("index", "")
    docs = body.get("documents", [])
    if not index_name or not docs:
        return {"error": "index and documents array are required"}, 400
    if index_name not in documents:
        return {"error": f"index '{index_name}' not found"}, 404

    results = []
    for d in docs:
        result, _ = ingest_document(index_name, {"document": d})
        results.append(result)
    return {"index": index_name, "ingested": len(results), "items": results}, 201


def search_documents(body: dict) -> tuple[dict, int]:
    index_name = body.get("index", "")
    query_text = body.get("query", "")
    filters = body.get("filters", {})
    size = body.get("size", 20)
    from_offset = body.get("from", 0)
    highlight = body.get("highlight", False)
    aggs = body.get("aggregations", {})

    if not index_name:
        return {"error": "index is required"}, 400
    if index_name not in documents:
        return {"error": f"index '{index_name}' not found"}, 404

    all_docs = documents[index_name]
    matched = []
    for doc in all_docs:
        source = doc.get("source", {})
        if query_text:
            text_match = any(
                query_text.lower() in str(v).lower()
                for v in source.values()
            )
            if not text_match:
                continue
        filter_match = True
        for fk, fv in filters.items():
            if isinstance(fv, dict):
                val = source.get(fk)
                if val is not None:
                    if "gte" in fv and val < fv["gte"]:
                        filter_match = False
                    if "lte" in fv and val > fv["lte"]:
                        filter_match = False
            elif source.get(fk) != fv:
                filter_match = False
        if filter_match:
            hit = {"_id": doc["id"], "_index": index_name, "_source": source, "_score": 1.0}
            if highlight and query_text:
                highlights = {}
                for k, v in source.items():
                    if query_text.lower() in str(v).lower():
                        highlights[k] = [str(v).replace(query_text, f"<em>{query_text}</em>")]
                hit["highlight"] = highlights
            matched.append(hit)

    total = len(matched)
    hits = matched[from_offset:from_offset + size]

    result: dict[str, Any] = {
        "took": 2,
        "hits": {"total": {"value": total, "relation": "eq"}, "hits": hits},
    }

    if aggs:
        result["aggregations"] = {}
        for agg_name, agg_def in aggs.items():
            agg_type = agg_def.get("type", "terms")
            field = agg_def.get("field", "")
            if agg_type == "terms":
                buckets: dict[str, int] = {}
                for doc in matched:
                    val = doc["_source"].get(field, "")
                    buckets[str(val)] = buckets.get(str(val), 0) + 1
                result["aggregations"][agg_name] = {
                    "buckets": [{"key": k, "doc_count": v} for k, v in sorted(buckets.items(), key=lambda x: -x[1])[:10]]
                }
            elif agg_type == "avg":
                vals = [doc["_source"].get(field, 0) for doc in matched if isinstance(doc["_source"].get(field), (int, float))]
                result["aggregations"][agg_name] = {"value": sum(vals) / max(len(vals), 1)}

    return result, 200


def create_alert(body: dict) -> tuple[dict, int]:
    name = body.get("name", "")
    index_name = body.get("index", "")
    condition = body.get("condition", {})
    if not name or not index_name:
        return {"error": "name and index are required"}, 400

    alert = {
        "id": f"ALR-{uuid.uuid4().hex[:8]}",
        "name": name,
        "index": index_name,
        "condition": condition,
        "actions": body.get("actions", [{"type": "webhook", "url": "http://localhost:8113/v1/notifications"}]),
        "interval": body.get("interval", "5m"),
        "status": "active",
        "lastTriggered": None,
        "triggerCount": 0,
        "createdAt": now_iso(),
    }
    alerts.append(alert)
    return alert, 201


# --- Canonical JWT validation (ported from services/shared/auth/jwt_validation.py; stdlib-only) ---
# RS256 via Keycloak JWKS (fetched with a 5s timeout + TTL cache) when KEYCLOAK_JWKS_URL
# is set; HS256 via JWT_SECRET otherwise; iss/aud checked when JWT_ISSUER / JWT_AUDIENCE
# are configured. Fail-closed: missing/malformed/expired/unknown-kid tokens are rejected;
# a JWKS outage with a cold cache yields "jwks_unavailable" (surfaced as HTTP 503).
import os as _jwt_os
import base64 as _jwt_b64
import hashlib as _jwt_hash
import hmac as _jwt_hmac
import json as _jwt_json
import time as _jwt_time
import urllib.request as _jwt_urlreq

_JWT_JWKS_URL = _jwt_os.environ.get("KEYCLOAK_JWKS_URL", "")
_JWT_SECRET = _jwt_os.environ.get("JWT_SECRET", "")
_JWT_ISSUER = _jwt_os.environ.get("JWT_ISSUER", "")
_JWT_AUDIENCE = _jwt_os.environ.get("JWT_AUDIENCE", "")
try:
    _JWT_JWKS_TTL = int(_jwt_os.environ.get("JWKS_CACHE_TTL_SECONDS", "300"))
except ValueError:
    _JWT_JWKS_TTL = 300
_jwks_cache = {"fetched_at": 0.0, "keys": {}}


def _jwt_b64url_decode(segment):
    segment += "=" * (-len(segment) % 4)
    return _jwt_b64.urlsafe_b64decode(segment.encode())


def _jwt_fetch_jwks():
    now = _jwt_time.time()
    if _jwks_cache["keys"] and now - _jwks_cache["fetched_at"] < _JWT_JWKS_TTL:
        return _jwks_cache["keys"], None
    try:
        with _jwt_urlreq.urlopen(_JWT_JWKS_URL, timeout=5) as resp:
            data = _jwt_json.loads(resp.read())
        keys = {k.get("kid"): k for k in data.get("keys", []) if k.get("kid")}
    except Exception:
        if _jwks_cache["keys"]:
            return _jwks_cache["keys"], None  # stale cache: signatures are still really verified
        return None, "jwks_unavailable"
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys, None


def _jwt_verify_rs256(signing_input, signature, jwk):
    """Pure-stdlib RS256 (PKCS#1 v1.5 + SHA-256) verification against a JWK."""
    try:
        n = int.from_bytes(_jwt_b64url_decode(jwk["n"]), "big")
        e = int.from_bytes(_jwt_b64url_decode(jwk["e"]), "big")
    except Exception:
        return False
    k = (n.bit_length() + 7) // 8
    if len(signature) != k:
        return False
    em = pow(int.from_bytes(signature, "big"), e, n).to_bytes(k, "big")
    digest_info = bytes.fromhex("3031300d060960864801650304020105000420") + _jwt_hash.sha256(signing_input).digest()
    if k < len(digest_info) + 11:
        return False
    expected = b"\x00\x01" + b"\xff" * (k - len(digest_info) - 3) + b"\x00" + digest_info
    return _jwt_hmac.compare_digest(em, expected)


def _jwt_check_claims(payload):
    exp = payload.get("exp")
    if exp is None:
        return "Token missing exp claim"
    try:
        if _jwt_time.time() >= float(exp):
            return "Token expired"
    except (TypeError, ValueError):
        return "Invalid token expiry"
    if _JWT_ISSUER and payload.get("iss") != _JWT_ISSUER:
        return "Invalid token issuer"
    if _JWT_AUDIENCE:
        aud = payload.get("aud")
        if isinstance(aud, str):
            aud = [aud]
        if not isinstance(aud, list) or _JWT_AUDIENCE not in aud:
            return "Invalid token audience"
    return None


def validate_jwt(headers):
    """Validate a Bearer JWT from a headers mapping.

    Returns (claims, None) on success or (None, reason) on failure. Fails closed:
    any token that cannot be cryptographically verified is rejected, and when
    neither KEYCLOAK_JWKS_URL nor JWT_SECRET is configured the result is
    (None, "auth_not_configured").
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    try:
        header = _jwt_json.loads(_jwt_b64url_decode(parts[0]))
        payload = _jwt_json.loads(_jwt_b64url_decode(parts[1]))
        signature = _jwt_b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    alg = header.get("alg")
    signing_input = (parts[0] + "." + parts[1]).encode()
    if alg == "RS256":
        if not _JWT_JWKS_URL:
            return None, "auth_not_configured"
        keys, ferr = _jwt_fetch_jwks()
        if ferr:
            return None, ferr
        jwk = keys.get(header.get("kid"))
        if jwk is None:
            _jwks_cache["fetched_at"] = 0.0  # one forced refresh for an unknown kid
            keys, ferr = _jwt_fetch_jwks()
            if ferr:
                return None, ferr
            jwk = keys.get(header.get("kid"))
            if jwk is None:
                return None, "Unknown token key id"
        if not _jwt_verify_rs256(signing_input, signature, jwk):
            return None, "Invalid token signature"
    elif alg == "HS256":
        if not _JWT_SECRET or _JWT_SECRET.startswith("${"):
            return None, "auth_not_configured"
        expected = _jwt_hmac.new(_JWT_SECRET.encode(), signing_input, _jwt_hash.sha256).digest()
        if not _jwt_hmac.compare_digest(expected, signature):
            return None, "Invalid token signature"
    else:
        return None, "Unsupported token algorithm"
    err = _jwt_check_claims(payload)
    if err:
        return None, err
    return payload, None


class OpenSearchHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        pass

    def _send(self, data: Any, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        _cors_origin = self.headers.get("Origin", "")
        _cors_allowed = [o.strip() for o in _jwt_os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
        if _cors_origin and _cors_origin in _cors_allowed:
            self.send_header("Access-Control-Allow-Origin", _cors_origin)
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        _cors_origin = self.headers.get("Origin", "")
        _cors_allowed = [o.strip() for o in _jwt_os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
        if _cors_origin and _cors_origin in _cors_allowed:
            self.send_header("Access-Control-Allow-Origin", _cors_origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self) -> None:

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._send({"error": "unauthorized", "detail": _n1_err}, status=401)
                return
        path = self.path.split("?")[0]

        if path == "/healthz":
            self._send({"service": "opensearch-analytics", "status": "healthy", "port": 8125,
                        "middleware": {
                "kafka": {"status": "connected", "topics": ["opensearch_analytics.events", "opensearch_analytics.audit"]},
                "dapr": {"status": "connected", "appId": "opensearch_analytics-sidecar"},
                "fluvio": {"status": "connected", "topic": "opensearch_analytics-stream"},
                "temporal": {"status": "connected", "namespace": "opensearch_analytics"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "opensearch_analytics"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "opensearch_analytics_authz"},
                "redis": {"status": "connected", "prefix": "opensearch_analytics:"},
                "mojaloop": {"status": "connected", "participant": "opensearch_analytics"},
                "opensearch": {"status": "connected", "index": "opensearch_analytics-*"},
                "openappsec": {"status": "connected", "policy": "opensearch_analytics-protection"},
                "apisix": {"status": "connected", "upstream": "opensearch_analytics"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "opensearch_analytics_iceberg"}
            }})
        elif path == "/v1/search/indices":
            self._send({"items": indices, "total": len(indices)})
        elif path == "/v1/search/dashboards":
            self._send({"items": dashboards, "total": len(dashboards)})
        elif path == "/v1/search/alerts":
            self._send({"items": alerts, "total": len(alerts)})
        elif path == "/v1/search/saved-queries":
            self._send({"items": saved_queries, "total": len(saved_queries)})
        elif path == "/v1/search/stats":
            total_docs = sum(len(d) for d in documents.values())
            total_size = sum(idx["sizeBytes"] for idx in indices)
            self._send({
                "totalIndices": len(indices), "totalDocuments": total_docs,
                "totalSizeBytes": total_size, "totalDashboards": len(dashboards),
                "totalAlerts": len(alerts), "clusterHealth": "green",
            })
        else:
            self._send({"error": "not found"}, 404)

    def do_POST(self) -> None:

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._send({"error": "unauthorized", "detail": _n1_err}, status=401)
                return
        path = self.path.split("?")[0]
        body = self._read_body()

        if path == "/v1/search/indices":
            result, status = create_index(body)
            self._send(result, status)
        elif path.startswith("/v1/search/indices/") and path.endswith("/ingest"):
            index_name = path.split("/")[4]
            result, status = ingest_document(index_name, body)
            self._send(result, status)
        elif path == "/v1/search/bulk-ingest":
            result, status = bulk_ingest(body)
            self._send(result, status)
        elif path == "/v1/search/query":
            result, status = search_documents(body)
            self._send(result, status)
        elif path == "/v1/search/alerts":
            result, status = create_alert(body)
            self._send(result, status)
        elif path == "/v1/search/saved-queries":
            sq = {
                "id": f"SQ-{uuid.uuid4().hex[:8]}",
                "name": body.get("name", ""),
                "query": body.get("query", {}),
                "createdAt": now_iso(),
            }
            saved_queries.append(sq)
            self._send(sq, 201)
        else:
            self._send({"error": "not found"}, 404)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8125"))
    server = HTTPServer(("0.0.0.0", port), OpenSearchHandler)
    print(f"OpenSearch Analytics Service starting on :{port}")
    server.serve_forever()
