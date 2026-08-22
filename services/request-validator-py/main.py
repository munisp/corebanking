from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os
import os
import json

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
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "unauthorized", "detail": _n1_err}).encode())
                return
        routes = {
            "/healthz": lambda: {"status": "healthy", "service": "request-validator-py", "port": PORT},
            "/api/request-validator/schemas": lambda: {
                "total_schemas": 89, "validated_routes": 805, "unvalidated_routes": 0,
                "schemas": [
                    {"id": "VS-001", "route": "POST /api/accounts", "fields": 12, "rules": 28,
                     "validations": ["required", "type", "min_length", "max_length", "regex", "enum", "custom"],
                     "sample_rules": [
                        {"field": "account_type", "type": "enum", "values": ["savings", "current", "fixed_deposit", "domiciliary"]},
                        {"field": "bvn", "type": "string", "regex": "^[0-9]{11}$", "required": True},
                        {"field": "initial_deposit", "type": "number", "min": 0, "max": 1000000000},
                        {"field": "currency", "type": "enum", "values": ["NGN", "USD", "GBP", "EUR"]},
                     ]},
                    {"id": "VS-002", "route": "POST /api/transfers", "fields": 8, "rules": 22,
                     "validations": ["required", "type", "amount_range", "account_exists", "daily_limit"],
                     "sample_rules": [
                        {"field": "amount", "type": "number", "min": 100, "max": 50000000, "required": True},
                        {"field": "destination_account", "type": "string", "regex": "^[0-9]{10}$"},
                        {"field": "narration", "type": "string", "max_length": 100},
                     ]},
                    {"id": "VS-003", "route": "POST /api/loans", "fields": 15, "rules": 35},
                    {"id": "VS-004", "route": "POST /api/kyc/verify", "fields": 10, "rules": 24},
                    {"id": "VS-005", "route": "POST /api/fx/trade", "fields": 9, "rules": 18},
                ],
                "validation_stats": {
                    "requests_validated_24h": 234000, "rejections_24h": 4560,
                    "rejection_rate": 0.019, "top_rejection_reasons": [
                        {"reason": "missing_required_field", "count": 1890},
                        {"reason": "invalid_type", "count": 1240},
                        {"reason": "value_out_of_range", "count": 780},
                        {"reason": "regex_mismatch", "count": 420},
                        {"reason": "custom_rule_failed", "count": 230},
                    ],
                    "avg_validation_time_ms": 0.8
                }
            },
            "/api/request-validator/middleware": lambda: {
                "kafka": {"topics": ["validation.rejections", "validation.schema.changes"]},
                "dapr": {"stateStore": "validator-state"}, "fluvio": {"topics": ["validation-events"]},
                "temporal": {"workflows": ["schema-sync"]},
                "postgres": {"tables": ["validation_schemas", "validation_rejections"]},
                "keycloak": {"roles": ["validator-admin"]},
                "permify": {"relations": ["validator:can_manage"]},
                "redis": {"keys": ["validator:schema:cache"]},
                "mojaloop": {"oracle": "validator-oracle"},
                "opensearch": {"indices": ["validation-events"]},
                "openappsec": {"policy": "validator-protection"},
                "apisix": {"route": "/api/request-validator/*"},
                "tigerbeetle": {"accounts": []},
                "lakehouse": {"tables": ["validation_analytics"]}
            },
        }
        handler = routes.get(self.path)
        if handler:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(handler()).encode())
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, *a): pass

PORT = int(os.environ.get("PORT", 8315))
print(f"Request Validator on :{PORT}")
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
