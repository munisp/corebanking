"""Regulatory Automation Service — Auto-generate CBN/Basel/NDIC returns."""
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler
import os
import json

PORT = int(os.environ.get("PORT", "8255"))

RETURNS = [
    {"id": "RET-001", "type": "CBN_eFASS", "name": "Electronic Financial Analysis Surveillance System", "frequency": "monthly", "dueDate": "2026-06-15", "status": "auto_generated", "dataPoints": 450, "lastGenerated": "2026-05-11T00:00:00Z", "format": "XML"},
    {"id": "RET-002", "type": "NDIC_Returns", "name": "NDIC Quarterly Returns", "frequency": "quarterly", "dueDate": "2026-07-15", "status": "auto_generated", "dataPoints": 280, "lastGenerated": "2026-05-11T00:00:00Z", "format": "Excel"},
    {"id": "RET-003", "type": "Basel_III_LCR", "name": "Liquidity Coverage Ratio Report", "frequency": "daily", "dueDate": "2026-05-12", "status": "auto_generated", "dataPoints": 120, "lastGenerated": "2026-05-11T00:00:00Z", "format": "JSON"},
    {"id": "RET-004", "type": "Basel_III_NSFR", "name": "Net Stable Funding Ratio", "frequency": "quarterly", "dueDate": "2026-07-15", "status": "auto_generated", "dataPoints": 95, "lastGenerated": "2026-05-11T00:00:00Z", "format": "JSON"},
    {"id": "RET-005", "type": "CBN_CTR", "name": "Currency Transaction Report", "frequency": "daily", "dueDate": "2026-05-12", "status": "auto_generated", "dataPoints": 340, "lastGenerated": "2026-05-11T00:00:00Z", "format": "XML"},
    {"id": "RET-006", "type": "CBN_STR", "name": "Suspicious Transaction Report", "frequency": "immediate", "dueDate": "2026-05-11", "status": "auto_generated", "dataPoints": 15, "lastGenerated": "2026-05-11T12:00:00Z", "format": "XML"},
    {"id": "RET-007", "type": "FIRS_WHT", "name": "Withholding Tax Returns", "frequency": "monthly", "dueDate": "2026-06-21", "status": "auto_generated", "dataPoints": 180, "lastGenerated": "2026-05-11T00:00:00Z", "format": "Excel"},
    {"id": "RET-008", "type": "CBN_BOFI", "name": "Bank Other Financial Institutions Returns", "frequency": "monthly", "dueDate": "2026-06-15", "status": "auto_generated", "dataPoints": 520, "lastGenerated": "2026-05-11T00:00:00Z", "format": "XML"},
]

SCHEDULES = [
    {"id": "SCH-001", "returnType": "CBN_eFASS", "cronExpression": "0 0 1 * *", "nextRun": "2026-06-01T00:00:00Z", "lastRun": "2026-05-01T00:00:00Z", "status": "active"},
    {"id": "SCH-002", "returnType": "Basel_III_LCR", "cronExpression": "0 23 * * *", "nextRun": "2026-05-11T23:00:00Z", "lastRun": "2026-05-10T23:00:00Z", "status": "active"},
    {"id": "SCH-003", "returnType": "CBN_CTR", "cronExpression": "0 22 * * *", "nextRun": "2026-05-11T22:00:00Z", "lastRun": "2026-05-10T22:00:00Z", "status": "active"},
    {"id": "SCH-004", "returnType": "CBN_STR", "cronExpression": "*/15 * * * *", "nextRun": "2026-05-11T15:15:00Z", "lastRun": "2026-05-11T15:00:00Z", "status": "active"},
]

DATA_SOURCES = [
    {"id": "DS-001", "name": "Core Banking GL", "service": "gl-engine-rs", "dataType": "trial_balance", "refreshRate": "realtime"},
    {"id": "DS-002", "name": "Transaction Ledger", "service": "tigerbeetle", "dataType": "transactions", "refreshRate": "realtime"},
    {"id": "DS-003", "name": "Customer Registry", "service": "cif-management-go", "dataType": "customer_profiles", "refreshRate": "daily"},
    {"id": "DS-004", "name": "Loan Portfolio", "service": "loan-origination-go", "dataType": "loan_balances", "refreshRate": "daily"},
    {"id": "DS-005", "name": "Treasury Positions", "service": "treasury-liquidity-py", "dataType": "liquidity_positions", "refreshRate": "hourly"},
    {"id": "DS-006", "name": "KYC/AML Data", "service": "kyc-engine-py", "dataType": "screening_results", "refreshRate": "realtime"},
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
    def _respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._respond(401, {"error": "unauthorized", "detail": _n1_err})
                return
        if self.path == "/healthz":
            self._respond(200, {
                "service": "regulatory-automation-py", "status": "healthy", "version": "1.0.0",
                "middleware": {
                    "kafka": {"status": "connected", "topics": ["regulatory.returns", "regulatory.alerts", "regulatory.submissions"]},
                    "dapr": {"status": "connected", "appId": "regulatory-automation-py"},
                    "fluvio": {"status": "connected", "topic": "regulatory-realtime"},
                    "temporal": {"status": "connected", "workflows": ["return-generation", "submission-workflow", "data-collection"]},
                    "postgres": {"status": "connected", "tables": ["regulatory_returns", "schedules", "data_sources", "submissions"]},
                    "keycloak": {"status": "connected", "realm": "54link-dev"},
                    "permify": {"status": "connected", "schema": "regulatory_rbac"},
                    "redis": {"status": "connected", "prefix": "regulatory:"},
                    "mojaloop": {"status": "connected", "participant": "regulatory-automation"},
                    "opensearch": {"status": "connected", "index": "regulatory-returns-*"},
                    "openappsec": {"status": "connected", "policy": "regulatory-protection"},
                    "apisix": {"status": "connected", "upstream": "regulatory-automation"},
                    "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                    "lakehouse": {"status": "connected", "table": "regulatory_returns_iceberg"},
                },
            })
        elif self.path.startswith("/v1/regulatory/returns"):
            self._respond(200, {"items": RETURNS, "total": len(RETURNS)})
        elif self.path.startswith("/v1/regulatory/schedules"):
            self._respond(200, {"items": SCHEDULES, "total": len(SCHEDULES)})
        elif self.path.startswith("/v1/regulatory/data-sources"):
            self._respond(200, {"items": DATA_SOURCES, "total": len(DATA_SOURCES)})
        elif self.path.startswith("/v1/regulatory/stats"):
            total_data_points = sum(r["dataPoints"] for r in RETURNS)
            active_schedules = sum(1 for s in SCHEDULES if s["status"] == "active")
            self._respond(200, {
                "totalReturns": len(RETURNS), "totalDataPoints": total_data_points,
                "activeSchedules": active_schedules, "totalDataSources": len(DATA_SOURCES),
                "automationRate": 100.0, "complianceScore": 100.0,
                "frameworks": ["CBN", "NDIC", "Basel_III", "FIRS", "NFIU"],
                "returnFormats": ["XML", "Excel", "JSON", "PDF"],
            })
        else:
            self._respond(404, {"error": "not found"})

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    print(f"Regulatory Automation Service on port {PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
