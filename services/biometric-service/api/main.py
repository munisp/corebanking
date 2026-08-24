"""biometric-service — API handlers."""
import json
from http.server import BaseHTTPRequestHandler

_FACE_MATCHES = [
    {"id": "FM-001", "sessionId": "SES-A001", "customerId": "CUST-001", "customerName": "Fatima Abdullahi", "similarityScore": 0.942, "threshold": 0.65, "matched": True, "model": "arcface-r100", "embeddingDim": 512, "faceQualityScore": 0.96, "glassesDetected": False, "maskDetected": False, "landmarksDetected": 68, "processingTimeMs": 145, "createdAt": "2026-05-09T10:30:00Z"},
    {"id": "FM-002", "sessionId": "SES-A002", "customerId": "CUST-002", "customerName": "Ibrahim Musa", "similarityScore": 0.871, "threshold": 0.65, "matched": True, "model": "arcface-r100", "embeddingDim": 512, "faceQualityScore": 0.91, "glassesDetected": True, "maskDetected": False, "landmarksDetected": 68, "processingTimeMs": 158, "createdAt": "2026-05-09T11:00:00Z"},
    {"id": "FM-003", "sessionId": "SES-A003", "customerId": "CUST-003", "customerName": "Grace Okafor", "similarityScore": 0.412, "threshold": 0.65, "matched": False, "model": "arcface-r100", "embeddingDim": 512, "faceQualityScore": 0.78, "glassesDetected": False, "maskDetected": False, "landmarksDetected": 68, "processingTimeMs": 142, "createdAt": "2026-05-09T12:00:00Z"},
]

_LIVENESS_CHECKS = [
    {"id": "LIV-001", "sessionId": "SES-L001", "customerId": "CUST-001", "method": "challenge_response", "overallScore": 0.96, "passed": True, "challengeType": "blink_left_eye", "challengeResponseCorrect": True, "deepfakeProbability": 0.02, "spoofTypeDetected": None, "processingTimeMs": 2145, "createdAt": "2026-05-09T10:29:00Z"},
    {"id": "LIV-002", "sessionId": "SES-L002", "customerId": "CUST-003", "method": "passive_3d", "overallScore": 0.28, "passed": False, "challengeType": "smile", "challengeResponseCorrect": False, "deepfakeProbability": 0.0, "spoofTypeDetected": "printed_photo", "processingTimeMs": 512, "createdAt": "2026-05-09T12:05:00Z"},
]

_LIVENESS_METHODS = [
    {"name": "passive_3d", "weight": 0.25, "latencyMs": 45, "description": "Single-frame micro-texture and monocular depth analysis."},
    {"name": "texture_analysis", "weight": 0.20, "latencyMs": 35, "description": "Fourier transform + wavelet decomposition to detect Moiré patterns."},
    {"name": "depth_estimation", "weight": 0.15, "latencyMs": 55, "description": "MiDaS-based monocular depth estimation."},
    {"name": "challenge_response", "weight": 0.20, "latencyMs": 2000, "description": "Interactive prompts — blink, smile, head turn, nod."},
    {"name": "deepfake_detection", "weight": 0.20, "latencyMs": 65, "description": "GAN artifact detection, face-swap boundary detection."},
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
    def _send_json(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._send_json(401, {"error": "unauthorized", "detail": _n1_err})
                return
        path = self.path.split("?")[0]

        if path == "/healthz":
            self._send_json(200, {"status": "ok", "service": "biometric-service", "capabilities": ["face-match", "liveness-detection"]})

        elif path == "/v1/face/matches":
            self._send_json(200, {"items": _FACE_MATCHES, "total": len(_FACE_MATCHES)})

        elif path.startswith("/v1/face/matches/"):
            mid = path[len("/v1/face/matches/"):]
            item = next((m for m in _FACE_MATCHES if m["id"] == mid), None)
            if item:
                self._send_json(200, item)
            else:
                self._send_json(404, {"error": "not found"})

        elif path == "/v1/face/stats":
            total = len(_FACE_MATCHES)
            matched = sum(1 for m in _FACE_MATCHES if m["matched"])
            avg_sim = sum(m["similarityScore"] for m in _FACE_MATCHES) / total if total else 0
            self._send_json(200, {
                "totalComparisons": total, "matched": matched, "mismatched": total - matched,
                "matchRatePct": round(matched / total * 100, 1) if total else 0,
                "avgSimilarityScore": round(avg_sim, 3),
                "model": "arcface-r100", "threshold": 0.65,
            })

        elif path == "/v1/liveness/checks":
            self._send_json(200, {"items": _LIVENESS_CHECKS, "total": len(_LIVENESS_CHECKS)})

        elif path.startswith("/v1/liveness/checks/"):
            cid = path[len("/v1/liveness/checks/"):]
            item = next((c for c in _LIVENESS_CHECKS if c["id"] == cid), None)
            if item:
                self._send_json(200, item)
            else:
                self._send_json(404, {"error": "not found"})

        elif path == "/v1/liveness/methods":
            self._send_json(200, {"methods": _LIVENESS_METHODS, "ensembleThreshold": 0.85, "ibetaCompliance": "Level 2"})

        elif path == "/v1/liveness/stats":
            total = len(_LIVENESS_CHECKS)
            passed = sum(1 for c in _LIVENESS_CHECKS if c["passed"])
            avg_score = sum(c["overallScore"] for c in _LIVENESS_CHECKS) / total if total else 0
            avg_deepfake = sum(c["deepfakeProbability"] for c in _LIVENESS_CHECKS) / total if total else 0
            self._send_json(200, {
                "totalChecks": total, "passed": passed, "failed": total - passed,
                "passRatePct": round(passed / total * 100, 1) if total else 0,
                "avgLivenessScore": round(avg_score, 3),
                "avgDeepfakeProbability": round(avg_deepfake, 3),
            })

        else:
            self._send_json(404, {"error": "not found"})

    def do_OPTIONS(self):
        self.send_response(204)
        _cors_origin = self.headers.get("Origin", "")
        _cors_allowed = [o.strip() for o in _jwt_os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
        if _cors_origin and _cors_origin in _cors_allowed:
            self.send_header("Access-Control-Allow-Origin", _cors_origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def log_message(self, fmt, *args):
        pass
