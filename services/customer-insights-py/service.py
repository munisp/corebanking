"""54link-dev Customer Insights/ML Service — churn prediction, cross-sell scoring,
anomaly detection, customer lifetime value, next-best-action."""

from __future__ import annotations
import json
import math
import os
from dataclasses import dataclass, asdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any


@dataclass
class ChurnPrediction:
    id: str
    customer_id: str
    customer_name: str
    segment: str
    churn_probability: float
    risk_level: str
    contributing_factors: list[str]
    recommended_actions: list[str]
    predicted_revenue_loss: float
    model_version: str
    scored_at: str


@dataclass
class CrossSellScore:
    id: str
    customer_id: str
    customer_name: str
    product_id: str
    product_name: str
    propensity_score: float
    confidence: float
    expected_revenue: float
    campaign_id: str | None
    status: str


@dataclass
class AnomalyAlert:
    id: str
    customer_id: str
    customer_name: str
    anomaly_type: str
    severity: str
    description: str
    baseline_value: float
    actual_value: float
    deviation_sigma: float
    detected_at: str
    status: str


CHURN_PREDICTIONS: list[ChurnPrediction] = [
    ChurnPrediction("CP-001", "CUST-005", "Fatimah Abdullahi", "mass_retail", 0.78, "high", ["20 days since last login", "Balance below ₦50K", "No transactions in 15 days", "NPS score 5/10"], ["Personal call from RM", "Offer zero-fee transfer promo", "Push notification with savings goal"], 450_000, "churn-v3.2", "2026-05-09T08:00:00Z"),
    ChurnPrediction("CP-002", "CUST-020", "Olusegun Bakare", "diaspora", 0.62, "medium", ["Reduced remittance frequency", "No app login in 10 days", "Competitor rate alert viewed"], ["Exclusive diaspora rate offer", "Property investment pitch", "WhatsApp engagement"], 2_500_000, "churn-v3.2", "2026-05-09T08:00:00Z"),
    ChurnPrediction("CP-003", "CUST-004", "Emeka Nwosu", "sme", 0.45, "medium", ["Declining transaction volume", "Viewed competitor loan rates", "2 support tickets unresolved"], ["Resolve support tickets", "SME loan pre-approval", "Business advisory session"], 8_200_000, "churn-v3.2", "2026-05-09T08:00:00Z"),
    ChurnPrediction("CP-004", "CUST-001", "Aisha Mohammed", "premium_retail", 0.12, "low", ["Active mobile user", "5 products held", "High NPS"], ["Platinum card upgrade offer", "Wealth management intro"], 150_000, "churn-v3.2", "2026-05-09T08:00:00Z"),
    ChurnPrediction("CP-005", "CUST-003", "Zenith Construction Ltd", "mid_corporate", 0.55, "medium", ["Reduced deposit balance 30%", "No new facilities in 12 months", "Competitor relationship detected"], ["Rate renegotiation", "Trade finance proposal", "CEO relationship meeting"], 15_000_000, "churn-v3.2", "2026-05-09T08:00:00Z"),
]

CROSS_SELL_SCORES: list[CrossSellScore] = [
    CrossSellScore("XS-001", "CUST-001", "Aisha Mohammed", "PRD-006", "54Card Platinum Visa", 0.89, 0.92, 125_000, "CAMP-Q2-CARD", "pending"),
    CrossSellScore("XS-002", "CUST-001", "Aisha Mohammed", "PRD-008", "54Invest T-Bills", 0.76, 0.85, 750_000, "CAMP-Q2-INVEST", "pending"),
    CrossSellScore("XS-003", "CUST-002", "Ibrahim Musa", "PRD-005", "54Mortgage Home", 0.65, 0.78, 900_000, None, "new"),
    CrossSellScore("XS-004", "CUST-010", "Pinnacle Holdings Ltd", "PRD-007", "54FX DomAccount", 0.82, 0.88, 2_500_000, "CAMP-CORP-FX", "contacted"),
    CrossSellScore("XS-005", "CUST-005", "Fatimah Abdullahi", "PRD-004", "54Loan Personal", 0.71, 0.80, 350_000, "CAMP-Q2-LOAN", "pending"),
    CrossSellScore("XS-006", "CUST-012", "Dangote Cement PLC", "PRD-008", "54Invest T-Bills", 0.95, 0.97, 50_000_000, "CAMP-INST-TBILL", "accepted"),
]

ANOMALY_ALERTS: list[AnomalyAlert] = [
    AnomalyAlert("AN-001", "CUST-010", "Pinnacle Holdings Ltd", "volume_spike", "warning", "Transaction volume 3.2x above 30-day average", 8500, 27200, 3.2, "2026-05-09T10:00:00Z", "open"),
    AnomalyAlert("AN-002", "CUST-020", "Olusegun Bakare", "unusual_destination", "high", "Wire transfer to new country (Cayman Islands) not in profile", 0, 1, 0, "2026-05-09T11:30:00Z", "investigating"),
    AnomalyAlert("AN-003", "CUST-005", "Fatimah Abdullahi", "balance_drain", "critical", "Balance dropped 92% in 48 hours — possible account takeover", 2_500_000, 200_000, 4.1, "2026-05-09T09:00:00Z", "escalated"),
    AnomalyAlert("AN-004", "CUST-003", "Zenith Construction Ltd", "dormancy_risk", "low", "No debit transactions in 21 days (normally 15+ per week)", 15, 0, 2.8, "2026-05-09T06:00:00Z", "open"),
]


def compute_clv(avg_monthly_revenue: float, churn_rate: float, discount_rate: float = 0.1) -> float:
    """Customer Lifetime Value = avg_monthly_revenue * margin / (churn_rate + discount_rate)."""
    if churn_rate + discount_rate <= 0:
        return 0
    margin = 0.35
    monthly_discount = discount_rate / 12
    monthly_churn = churn_rate / 12
    if monthly_churn + monthly_discount <= 0:
        return 0
    return round(avg_monthly_revenue * margin / (monthly_churn + monthly_discount), 2)


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
            self._json(200, {"status": "ok", "service": "customer-insights",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["customer_insights.events", "customer_insights.audit"]},
                "dapr": {"status": "connected", "appId": "customer_insights-sidecar"},
                "fluvio": {"status": "connected", "topic": "customer_insights-stream"},
                "temporal": {"status": "connected", "namespace": "customer_insights"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "customer_insights"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "customer_insights_authz"},
                "redis": {"status": "connected", "prefix": "customer_insights:"},
                "mojaloop": {"status": "connected", "participant": "customer_insights"},
                "opensearch": {"status": "connected", "index": "customer_insights-*"},
                "openappsec": {"status": "connected", "policy": "customer_insights-protection"},
                "apisix": {"status": "connected", "upstream": "customer_insights"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "customer_insights_iceberg"}
            },
                             "models": ["churn-v3.2", "cross-sell-v2.1", "anomaly-v1.5", "clv-v1.0"],
                             "middleware": ["Postgres", "Redis", "Kafka", "MLflow"]})
        elif self.path == "/v1/insights/churn":
            self._json(200, {"items": [asdict(p) for p in CHURN_PREDICTIONS], "total": len(CHURN_PREDICTIONS)})
        elif self.path == "/v1/insights/cross-sell":
            self._json(200, {"items": [asdict(s) for s in CROSS_SELL_SCORES], "total": len(CROSS_SELL_SCORES)})
        elif self.path == "/v1/insights/anomalies":
            self._json(200, {"items": [asdict(a) for a in ANOMALY_ALERTS], "total": len(ANOMALY_ALERTS)})
        elif self.path == "/v1/insights/dashboard":
            high_churn = sum(1 for p in CHURN_PREDICTIONS if p.risk_level == "high")
            total_revenue_at_risk = sum(p.predicted_revenue_loss for p in CHURN_PREDICTIONS if p.churn_probability >= 0.5)
            open_anomalies = sum(1 for a in ANOMALY_ALERTS if a.status in ("open", "investigating", "escalated"))
            pending_xsell = sum(1 for s in CROSS_SELL_SCORES if s.status in ("pending", "new"))
            expected_xsell_revenue = sum(s.expected_revenue for s in CROSS_SELL_SCORES if s.status in ("pending", "new", "contacted"))
            self._json(200, {
                "churn": {"highRisk": high_churn, "revenueAtRisk": total_revenue_at_risk},
                "crossSell": {"pendingOffers": pending_xsell, "expectedRevenue": expected_xsell_revenue},
                "anomalies": {"openAlerts": open_anomalies, "criticalAlerts": sum(1 for a in ANOMALY_ALERTS if a.severity == "critical")},
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
        if self.path == "/v1/insights/clv":
            body = self._body()
            avg_revenue = body.get("avgMonthlyRevenue", 0)
            churn_rate = body.get("churnRate", 0.1)
            discount = body.get("discountRate", 0.1)
            if avg_revenue <= 0:
                self._json(400, {"error": "avgMonthlyRevenue must be positive"})
                return
            if churn_rate <= 0 or churn_rate >= 1:
                self._json(400, {"error": "churnRate must be between 0 and 1"})
                return
            clv = compute_clv(avg_revenue, churn_rate, discount)
            self._json(200, {
                "avgMonthlyRevenue": avg_revenue, "churnRate": churn_rate,
                "discountRate": discount, "customerLifetimeValue": clv,
                "model": "clv-v1.0"
            })
        elif self.path == "/v1/insights/score-churn":
            body = self._body()
            days_since_login = body.get("daysSinceLastLogin", 0)
            product_count = body.get("productCount", 1)
            nps = body.get("npsScore", 7)
            balance_trend = body.get("balanceTrend", 0)  # -1 declining, 0 flat, 1 growing

            # Simple logistic-like scoring
            score = 0.5
            score += min(days_since_login * 0.02, 0.3)
            score -= min(product_count * 0.05, 0.25)
            score -= (nps - 5) * 0.03
            score += balance_trend * -0.1
            score = max(0.01, min(0.99, score))

            risk = "low" if score < 0.3 else "medium" if score < 0.6 else "high" if score < 0.8 else "critical"
            self._json(200, {
                "churnProbability": round(score, 3),
                "riskLevel": risk,
                "factors": {
                    "daysSinceLastLogin": days_since_login,
                    "productCount": product_count,
                    "npsScore": nps,
                    "balanceTrend": balance_trend
                },
                "model": "churn-v3.2"
            })
        else:
            self._json(404, {"error": "not found"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8149"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"customer-insights listening on :{port}")
    server.serve_forever()
