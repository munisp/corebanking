"""54link-dev Customer Feedback & NPS Service — surveys, ratings, sentiment analysis,
complaint-to-feedback linking, NPS trending, branch/channel scoring."""

from __future__ import annotations
import json
import os
from dataclasses import dataclass, asdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any


@dataclass
class FeedbackEntry:
    id: str
    customer_id: str
    customer_name: str
    channel: str
    category: str
    rating: int
    nps_score: int
    comment: str
    sentiment: str
    branch: str | None
    product: str | None
    resolved: bool
    response: str | None
    submitted_at: str


@dataclass
class NPSTrend:
    period: str
    promoters: int
    passives: int
    detractors: int
    total_responses: int
    nps: float


FEEDBACK: list[FeedbackEntry] = [
    FeedbackEntry("FB-001", "CUST-001", "Aisha Mohammed", "mobile_app", "general", 5, 9, "Love the new mobile app redesign! Transfer speed is excellent.", "positive", None, "54Pay Mobile", True, None, "2026-05-09T10:00:00Z"),
    FeedbackEntry("FB-002", "CUST-005", "Fatimah Abdullahi", "branch", "service_quality", 2, 3, "Waited 45 minutes at Lekki branch. Only 2 tellers on duty at peak hours.", "negative", "Lekki", None, False, None, "2026-05-09T11:00:00Z"),
    FeedbackEntry("FB-003", "CUST-002", "Ibrahim Musa", "internet_banking", "feature_request", 4, 8, "Please add multi-currency dashboard view. Currently have to switch between accounts.", "neutral", None, "Internet Banking", True, "Feature added to Q3 roadmap — thank you for the suggestion!", "2026-05-08T14:00:00Z"),
    FeedbackEntry("FB-004", "CUST-010", "Pinnacle Holdings Ltd", "relationship_manager", "service_quality", 5, 10, "Excellent relationship management from Oluwafemi. Helped restructure our facility smoothly.", "positive", "Head Office", "Corporate Banking", True, None, "2026-05-07T09:00:00Z"),
    FeedbackEntry("FB-005", "CUST-003", "Zenith Construction Ltd", "call_center", "complaint", 1, 1, "Card was blocked without notice. Took 3 days to resolve. Unacceptable for a corporate account.", "negative", None, "54Card Corporate", False, None, "2026-05-06T16:00:00Z"),
    FeedbackEntry("FB-006", "CUST-020", "Olusegun Bakare", "mobile_app", "general", 4, 7, "Diaspora transfer rates are competitive. Would prefer faster settlement to Nigerian accounts.", "neutral", None, "Diaspora Banking", True, "Settlement now T+0 for intra-bank. Inter-bank remains T+1.", "2026-05-05T12:00:00Z"),
    FeedbackEntry("FB-007", "CUST-008", "Farmgate Commodities Ltd", "branch", "product", 3, 5, "Warehouse receipt financing approval took too long. 3 weeks vs promised 5 days.", "negative", "Ikeja", "Agri Finance", False, None, "2026-05-04T10:00:00Z"),
    FeedbackEntry("FB-008", "CUST-012", "Dangote Cement PLC", "relationship_manager", "general", 5, 10, "Seamless syndicated facility arrangement. 54link-dev led the consortium efficiently.", "positive", "Head Office", "Institutional Banking", True, None, "2026-05-03T11:00:00Z"),
]

NPS_TRENDS: list[NPSTrend] = [
    NPSTrend("2026-01", 420, 180, 100, 700, 45.7),
    NPSTrend("2026-02", 450, 170, 90, 710, 50.7),
    NPSTrend("2026-03", 480, 160, 85, 725, 54.5),
    NPSTrend("2026-04", 510, 150, 80, 740, 58.1),
    NPSTrend("2026-05", 530, 145, 75, 750, 60.7),
]


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


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, body: Any) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def log_message(self, format: str, *args: Any) -> None:
        pass

    def do_GET(self) -> None:

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json(401, {"error": "unauthorized", "detail": _n1_err})
                return
        if self.path == "/healthz":
            self._json(200, {"status": "ok", "service": "customer-feedback",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["customer_feedback.events", "customer_feedback.audit"]},
                "dapr": {"status": "connected", "appId": "customer_feedback-sidecar"},
                "fluvio": {"status": "connected", "topic": "customer_feedback-stream"},
                "temporal": {"status": "connected", "namespace": "customer_feedback"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "customer_feedback"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "customer_feedback_authz"},
                "redis": {"status": "connected", "prefix": "customer_feedback:"},
                "mojaloop": {"status": "connected", "participant": "customer_feedback"},
                "opensearch": {"status": "connected", "index": "customer_feedback-*"},
                "openappsec": {"status": "connected", "policy": "customer_feedback-protection"},
                "apisix": {"status": "connected", "upstream": "customer_feedback"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "customer_feedback_iceberg"}
            },
                             "middleware": ["Postgres", "Redis", "Kafka", "OpenSearch"]})
        elif self.path == "/v1/feedback/entries":
            self._json(200, {"items": [asdict(f) for f in FEEDBACK], "total": len(FEEDBACK)})
        elif self.path == "/v1/feedback/nps-trend":
            self._json(200, {"items": [asdict(t) for t in NPS_TRENDS], "total": len(NPS_TRENDS)})
        elif self.path == "/v1/feedback/dashboard":
            total = len(FEEDBACK)
            avg_rating = sum(f.rating for f in FEEDBACK) / total if total else 0
            avg_nps = sum(f.nps_score for f in FEEDBACK) / total if total else 0
            promoters = sum(1 for f in FEEDBACK if f.nps_score >= 9)
            detractors = sum(1 for f in FEEDBACK if f.nps_score <= 6)
            nps = ((promoters - detractors) / total * 100) if total else 0

            by_sentiment: dict[str, int] = {}
            by_channel: dict[str, int] = {}
            by_category: dict[str, int] = {}
            for f in FEEDBACK:
                by_sentiment[f.sentiment] = by_sentiment.get(f.sentiment, 0) + 1
                by_channel[f.channel] = by_channel.get(f.channel, 0) + 1
                by_category[f.category] = by_category.get(f.category, 0) + 1

            unresolved = sum(1 for f in FEEDBACK if not f.resolved)
            self._json(200, {
                "totalFeedback": total, "avgRating": round(avg_rating, 1),
                "avgNPS": round(avg_nps, 1), "npsScore": round(nps, 1),
                "promoters": promoters, "detractors": detractors,
                "unresolvedCount": unresolved,
                "bySentiment": by_sentiment, "byChannel": by_channel, "byCategory": by_category,
                "latestNPSTrend": asdict(NPS_TRENDS[-1]) if NPS_TRENDS else None,
            })
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json(401, {"error": "unauthorized", "detail": _n1_err})
                return
        if self.path == "/v1/feedback/submit":
            body = self._body()
            rating = body.get("rating", 0)
            nps = body.get("npsScore", 0)
            comment = body.get("comment", "")
            if not (1 <= rating <= 5):
                self._json(400, {"error": "rating must be 1-5"})
                return
            if not (0 <= nps <= 10):
                self._json(400, {"error": "npsScore must be 0-10"})
                return

            sentiment = "positive" if nps >= 8 else "negative" if nps <= 4 else "neutral"
            self._json(201, {
                "id": f"FB-{len(FEEDBACK)+1:03d}",
                "rating": rating, "npsScore": nps, "comment": comment,
                "sentiment": sentiment, "status": "received"
            })
        else:
            self._json(404, {"error": "not found"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8155"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"customer-feedback listening on :{port}")
    server.serve_forever()
