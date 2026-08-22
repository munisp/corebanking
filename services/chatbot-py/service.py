import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8179"))
MW = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092"), "topics": ["chatbot.conversations", "chatbot.intents", "chatbot.escalations"]},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379"), "cache_keys": ["chatbot:sessions", "chatbot:faqs", "chatbot:context"]},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": ["chatbot_conversations", "chatbot_intents", "chatbot_training", "escalation_log"]},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200"), "indices": ["chatbot-conversations", "chatbot-analytics"]},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54link-dev", "client": "chatbot"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476"), "resources": ["chatbot_session"]},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "app_id": "chatbot", "pubsub": "chatbot-pubsub"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003"), "topics": ["chatbot-event-stream"]},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233"), "workflows": ["ConversationWorkflow", "EscalationWorkflow"]},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:3002"), "usage": "chatbot-initiated payments"},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000"), "ledgers": ["chatbot_transactions"]},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8181"), "tables": ["chatbot_analytics_history"]},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080"), "routes": ["/v1/chatbot/*"]},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "chatbot-waf"},
}

INTENTS = [
    {"id": "INT-001", "intent": "check_balance", "category": "account_inquiry", "confidence_threshold": 0.85, "sample_utterances": ["What is my balance?", "How much do I have?", "Check my account"], "responses": 4500, "avg_confidence": 0.94, "escalation_rate": 0.02, "status": "active"},
    {"id": "INT-002", "intent": "transfer_funds", "category": "payments", "confidence_threshold": 0.90, "sample_utterances": ["Send money to", "Transfer to account", "Pay someone"], "responses": 3200, "avg_confidence": 0.91, "escalation_rate": 0.08, "status": "active"},
    {"id": "INT-003", "intent": "loan_inquiry", "category": "lending", "confidence_threshold": 0.80, "sample_utterances": ["I need a loan", "Loan options", "Interest rates for loans"], "responses": 1800, "avg_confidence": 0.87, "escalation_rate": 0.15, "status": "active"},
    {"id": "INT-004", "intent": "card_block", "category": "card_services", "confidence_threshold": 0.95, "sample_utterances": ["Block my card", "Card stolen", "Freeze card"], "responses": 800, "avg_confidence": 0.97, "escalation_rate": 0.05, "status": "active"},
    {"id": "INT-005", "intent": "branch_locator", "category": "general", "confidence_threshold": 0.80, "sample_utterances": ["Nearest branch", "Where is the closest ATM", "Branch hours"], "responses": 2100, "avg_confidence": 0.92, "escalation_rate": 0.01, "status": "active"},
    {"id": "INT-006", "intent": "complaint", "category": "service_recovery", "confidence_threshold": 0.75, "sample_utterances": ["I want to complain", "Bad service", "Report an issue"], "responses": 950, "avg_confidence": 0.83, "escalation_rate": 0.45, "status": "active"},
    {"id": "INT-007", "intent": "fx_rate_inquiry", "category": "treasury", "confidence_threshold": 0.85, "sample_utterances": ["Dollar rate today", "Exchange rate", "Convert naira to dollar"], "responses": 2800, "avg_confidence": 0.93, "escalation_rate": 0.03, "status": "active"},
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
            self._json(200, {"service": "chatbot-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/chatbot/intents"):
            self._json(200, {"items": INTENTS, "total": len(INTENTS)})
        elif self.path.startswith("/v1/chatbot/stats"):
            total_resp = sum(i["responses"] for i in INTENTS)
            avg_conf = sum(i["avg_confidence"] for i in INTENTS) / len(INTENTS)
            avg_esc = sum(i["escalation_rate"] for i in INTENTS) / len(INTENTS)
            self._json(200, {"total_intents": len(INTENTS), "total_responses": total_resp, "avg_confidence": round(avg_conf, 3), "avg_escalation_rate": round(avg_esc, 3)})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json(401, {"error": "unauthorized", "detail": _n1_err})
                return
        if self.path.startswith("/v1/chatbot/message"):
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length > 0 else {}
            message = body.get("message", "").lower()
            if "balance" in message:
                intent, confidence = "check_balance", 0.95
            elif "transfer" in message or "send" in message:
                intent, confidence = "transfer_funds", 0.92
            elif "loan" in message:
                intent, confidence = "loan_inquiry", 0.88
            elif "card" in message and ("block" in message or "stolen" in message):
                intent, confidence = "card_block", 0.97
            elif "branch" in message or "atm" in message:
                intent, confidence = "branch_locator", 0.90
            elif "complain" in message or "issue" in message:
                intent, confidence = "complaint", 0.85
            elif "rate" in message or "dollar" in message or "exchange" in message:
                intent, confidence = "fx_rate_inquiry", 0.93
            else:
                intent, confidence = "unknown", 0.0
            self._json(200, {"intent": intent, "confidence": confidence, "response": f"I understand you're asking about {intent.replace('_', ' ')}. Let me help you with that.", "session_id": body.get("session_id", "new")})
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
    print(f"Chatbot Service running on port {PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
