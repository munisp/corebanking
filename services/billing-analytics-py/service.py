"""Billing analytics service — accrual tracking, spike detection, revenue reporting."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from statistics import mean
from typing import Any


@dataclass
class AccrualPoint:
    id: str
    tenant_id: str
    billing_period: str
    accrued_amount: float
    currency: str
    meter_key: str
    product_key: str
    transaction_count: int
    status: str


@dataclass
class RevenueReport:
    id: str
    period: str
    total_revenue: float
    fee_income: float
    interest_income: float
    fx_income: float
    commission_income: float
    currency: str


ACCRUALS: list[AccrualPoint] = [
    AccrualPoint("BA-001", "54link-dev-platform-prod", "2026-01", 6_200_000, "NGN", "transfer_posted", "nip_payments", 248_000, "finalized"),
    AccrualPoint("BA-002", "54link-dev-platform-prod", "2026-02", 7_500_000, "NGN", "transfer_posted", "nip_payments", 300_000, "finalized"),
    AccrualPoint("BA-003", "54link-dev-platform-prod", "2026-03", 7_800_000, "NGN", "transfer_posted", "nip_payments", 312_000, "finalized"),
    AccrualPoint("BA-004", "54link-dev-platform-prod", "2026-04", 8_100_000, "NGN", "transfer_posted", "nip_payments", 324_000, "finalized"),
    AccrualPoint("BA-005", "54link-dev-platform-prod", "2026-05", 12_900_000, "NGN", "transfer_posted", "nip_payments", 516_000, "provisional"),
    AccrualPoint("BA-006", "54link-dev-platform-prod", "2026-01", 1_800_000, "NGN", "api_call", "open_banking", 3_600_000, "finalized"),
    AccrualPoint("BA-007", "54link-dev-platform-prod", "2026-02", 2_100_000, "NGN", "api_call", "open_banking", 4_200_000, "finalized"),
    AccrualPoint("BA-008", "54link-dev-platform-prod", "2026-03", 2_400_000, "NGN", "api_call", "open_banking", 4_800_000, "finalized"),
    AccrualPoint("BA-009", "54link-dev-platform-prod", "2026-04", 2_350_000, "NGN", "sms_sent", "notifications", 587_500, "finalized"),
    AccrualPoint("BA-010", "54link-dev-platform-prod", "2026-05", 2_600_000, "NGN", "sms_sent", "notifications", 650_000, "provisional"),
]

REVENUE_REPORTS: list[RevenueReport] = [
    RevenueReport("RR-001", "2026-Q1", 45_500_000_000, 12_300_000_000, 25_800_000_000, 4_200_000_000, 3_200_000_000, "NGN"),
    RevenueReport("RR-002", "2026-Q2", 48_200_000_000, 13_100_000_000, 27_200_000_000, 4_500_000_000, 3_400_000_000, "NGN"),
]


def detect_spikes(meter_key: str, spike_ratio: float = 1.4) -> list[dict[str, Any]]:
    series = [a for a in ACCRUALS if a.meter_key == meter_key]
    if len(series) < 2:
        return []
    baseline = mean(a.accrued_amount for a in series[:-1])
    latest = series[-1]
    if baseline <= 0:
        return []
    if latest.accrued_amount >= baseline * spike_ratio:
        return [{
            "tenantId": latest.tenant_id,
            "billingPeriod": latest.billing_period,
            "meterKey": meter_key,
            "baseline": round(baseline, 2),
            "latest": round(latest.accrued_amount, 2),
            "ratio": round(latest.accrued_amount / baseline, 2),
            "severity": "warning" if latest.accrued_amount < baseline * 2 else "critical",
        }]
    return []


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
        return json.loads(self.rfile.read(length)) if length > 0 else {}

    def do_GET(self) -> None:

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json(401, {"error": "unauthorized", "detail": _n1_err})
                return
        if self.path == "/healthz":
            self._json(200, {"status": "ok", "service": "billing-analytics-python",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["billing_analytics.events", "billing_analytics.audit"]},
                "dapr": {"status": "connected", "appId": "billing_analytics-sidecar"},
                "fluvio": {"status": "connected", "topic": "billing_analytics-stream"},
                "temporal": {"status": "connected", "namespace": "billing_analytics"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "billing_analytics"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "billing_analytics_authz"},
                "redis": {"status": "connected", "prefix": "billing_analytics:"},
                "mojaloop": {"status": "connected", "participant": "billing_analytics"},
                "opensearch": {"status": "connected", "index": "billing_analytics-*"},
                "openappsec": {"status": "connected", "policy": "billing_analytics-protection"},
                "apisix": {"status": "connected", "upstream": "billing_analytics"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "billing_analytics_iceberg"}
            }, "middleware": ["Lakehouse", "OpenSearch", "Kafka", "Redis"]})
        elif self.path == "/v1/billing/accruals":
            self._json(200, {"items": [asdict(a) for a in ACCRUALS], "total": len(ACCRUALS)})
        elif self.path == "/v1/billing/revenue-reports":
            self._json(200, {"items": [asdict(r) for r in REVENUE_REPORTS], "total": len(REVENUE_REPORTS)})
        elif self.path == "/v1/billing/summary":
            total_accrued = sum(a.accrued_amount for a in ACCRUALS)
            by_meter: dict[str, float] = {}
            for a in ACCRUALS:
                by_meter[a.meter_key] = by_meter.get(a.meter_key, 0) + a.accrued_amount
            self._json(200, {"totalAccrued": total_accrued, "accrualCount": len(ACCRUALS), "byMeter": by_meter})
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
        if self.path == "/v1/billing/detect-spikes":
            body = self._body()
            meter = body.get("meterKey", "transfer_posted")
            ratio = body.get("spikeRatio", 1.4)
            alerts = detect_spikes(meter, ratio)
            self._json(200, {"alerts": alerts, "total": len(alerts)})
        else:
            self._json(404, {"error": "not found"})

    def log_message(self, fmt: str, *args: Any) -> None:
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8087"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"billing-analytics-python listening on :{port}")
    server.serve_forever()
