import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8168"))
def _require_env(name):
    """Fail-fast required environment variable (finding R3-NEW-3).

    No credential-bearing or otherwise insecure defaults: refuse to start when
    the variable is unset or left as an unexpanded '${...}' placeholder."""
    val = os.environ.get(name, "").strip()
    if not val or val.startswith("${"):
        raise RuntimeError(
            f"FATAL: required environment variable {name} is not set; "
            "refusing to start with an insecure default"
        )
    return val


MW = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092"), "topics": ["wealth.portfolios", "wealth.transactions", "wealth.rebalancing"]},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379"), "cache_keys": ["wealth:nav", "wealth:clients", "wealth:models"]},
    "postgres": {"url": _require_env("DATABASE_URL"), "tables": ["wealth_clients", "wealth_portfolios", "wealth_transactions", "investment_models"]},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200"), "indices": ["wealth-transactions", "wealth-audit"]},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54link-dev", "client": "wealth-mgmt"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476"), "resources": ["wealth_client", "wealth_portfolio"]},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "app_id": "wealth-mgmt", "pubsub": "wealth-pubsub"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003"), "topics": ["wealth-market-stream"]},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233"), "workflows": ["RebalancingWorkflow", "TaxOptimizationWorkflow"]},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:3002"), "usage": "wealth transfers"},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000"), "ledgers": ["wealth_cash", "wealth_investments"]},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8181"), "tables": ["wealth_performance_history"]},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080"), "routes": ["/v1/wealth/*"]},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "wealth-waf"},
}

CLIENTS = [
    {"id": "WC-001", "client_name": "Aliko Dangote", "client_type": "uhnw", "relationship_manager": "RM-001", "total_wealth": 12500000000.0, "currency": "USD", "risk_profile": "moderate", "investment_mandate": "balanced_growth", "portfolios": ["equities", "fixed_income", "real_estate", "alternatives"], "annual_review_date": "2026-06-15", "status": "active"},
    {"id": "WC-002", "client_name": "Mike Adenuga Jr", "client_type": "uhnw", "relationship_manager": "RM-002", "total_wealth": 6800000000.0, "currency": "USD", "risk_profile": "aggressive", "investment_mandate": "growth", "portfolios": ["equities", "private_equity", "telecom_ventures"], "annual_review_date": "2026-07-01", "status": "active"},
    {"id": "WC-003", "client_name": "Abdul Samad Rabiu", "client_type": "uhnw", "relationship_manager": "RM-001", "total_wealth": 5200000000.0, "currency": "USD", "risk_profile": "moderate", "investment_mandate": "income_plus_growth", "portfolios": ["fixed_income", "real_estate", "cement_industry"], "annual_review_date": "2026-08-15", "status": "active"},
    {"id": "WC-004", "client_name": "Folorunso Alakija", "client_type": "hnw", "relationship_manager": "RM-003", "total_wealth": 1100000000.0, "currency": "USD", "risk_profile": "conservative", "investment_mandate": "capital_preservation", "portfolios": ["fixed_income", "real_estate"], "annual_review_date": "2026-05-30", "status": "active"},
    {"id": "WC-005", "client_name": "Tony Elumelu", "client_type": "uhnw", "relationship_manager": "RM-002", "total_wealth": 3500000000.0, "currency": "USD", "risk_profile": "aggressive", "investment_mandate": "pan_african_growth", "portfolios": ["equities", "banking_ventures", "energy", "agriculture"], "annual_review_date": "2026-09-01", "status": "active"},
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
    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json(401, {"error": "unauthorized", "detail": _n1_err})
                return
        if self.path == "/healthz":
            self._json(200, {"service": "wealth-mgmt-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/wealth/clients"):
            self._json(200, {"items": CLIENTS, "total": len(CLIENTS)})
        elif self.path.startswith("/v1/wealth/stats"):
            total = sum(c["total_wealth"] for c in CLIENTS)
            self._json(200, {"total_clients": len(CLIENTS), "total_auw": total, "currency": "USD"})
        else:
            self._json(404, {"error": "not found"})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    print(f"Wealth Management Service running on port {PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
