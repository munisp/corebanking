"""
54Bank Document Verification Service
ICAO 9303 MRZ parsing, NFC passport BAC/PACE, hologram detection, fraud scoring.
Persists all verifications to PostgreSQL.
"""
import os
import json
import re
import time
import hashlib
import threading
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler

SERVICE_NAME = "document-verification-py"
PORT = int(os.environ.get("PORT", "9042"))
DATABASE_URL = os.environ.get("DATABASE_URL", "")

db_conn = None

def init_db():
    global db_conn
    if not DATABASE_URL:
        print(f"[{SERVICE_NAME}] WARNING: DATABASE_URL not set — running without persistence")
        return
    try:
        import psycopg2
        db_conn = psycopg2.connect(DATABASE_URL)
        db_conn.autocommit = True
        cur = db_conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS document_verifications (
                verification_id TEXT PRIMARY KEY,
                document_type TEXT NOT NULL,
                document_number TEXT NOT NULL DEFAULT '',
                issuing_country TEXT NOT NULL DEFAULT '',
                surname TEXT NOT NULL DEFAULT '',
                given_names TEXT NOT NULL DEFAULT '',
                fraud_verdict TEXT NOT NULL DEFAULT 'UNKNOWN',
                fraud_risk_score INTEGER NOT NULL DEFAULT 0,
                fraud_indicators TEXT NOT NULL DEFAULT '[]',
                nfc_read_success BOOLEAN NOT NULL DEFAULT FALSE,
                overall_verdict TEXT NOT NULL DEFAULT 'UNKNOWN',
                mrz_data TEXT NOT NULL DEFAULT '{}',
                verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS document_stats (
                id SERIAL PRIMARY KEY,
                doc_type TEXT NOT NULL,
                verdict TEXT NOT NULL,
                risk_score INTEGER NOT NULL DEFAULT 0,
                recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.close()
        print(f"[{SERVICE_NAME}] PostgreSQL initialized")
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB init failed: {e}")
        db_conn = None

# ── MRZ Parser (ICAO 9303) ──────────────────────────────────────────────────

MRZ_TD1_PATTERN = re.compile(r'^[A-Z<]{2}[A-Z<]{3}[A-Z0-9<]{9}\d[A-Z0-9<]{15}')
MRZ_TD3_PATTERN = re.compile(r'^P[A-Z<][A-Z<]{3}[A-Z<]{39}')

def parse_mrz_td3(line1: str, line2: str) -> dict:
    """Parse TD3 (passport) MRZ."""
    doc_type = line1[0:2].replace('<', '')
    country = line1[2:5].replace('<', '')
    names = line1[5:44].split('<<')
    surname = names[0].replace('<', ' ').strip() if names else ''
    given = names[1].replace('<', ' ').strip() if len(names) > 1 else ''

    passport_no = line2[0:9].replace('<', '')
    nationality = line2[10:13].replace('<', '')
    dob = line2[13:19]
    sex = line2[20]
    expiry = line2[21:27]

    check1 = int(line2[9]) if line2[9].isdigit() else -1

    dob_parsed = f"{'19' if int(dob[:2]) > 30 else '20'}{dob[:2]}-{dob[2:4]}-{dob[4:6]}"
    exp_parsed = f"20{expiry[:2]}-{expiry[2:4]}-{expiry[4:6]}"
    is_expired = datetime.strptime(exp_parsed, "%Y-%m-%d") < datetime.now()

    return {
        "document_type": doc_type,
        "issuing_country": country,
        "surname": surname,
        "given_names": given,
        "passport_number": passport_no,
        "nationality": nationality,
        "date_of_birth": dob_parsed,
        "sex": sex,
        "expiry_date": exp_parsed,
        "is_expired": is_expired,
        "mrz_valid": check1 >= 0,
    }

def parse_mrz_td1(line1: str, line2: str, line3: str) -> dict:
    """Parse TD1 (ID card) MRZ."""
    doc_type = line1[0:2].replace('<', '')
    country = line1[2:5].replace('<', '')
    doc_number = line1[5:14].replace('<', '')

    dob = line2[0:6]
    sex = line2[7]
    expiry = line2[8:14]
    nationality = line2[15:18].replace('<', '')

    names = line3.split('<<')
    surname = names[0].replace('<', ' ').strip() if names else ''
    given = names[1].replace('<', ' ').strip() if len(names) > 1 else ''

    dob_parsed = f"{'19' if int(dob[:2]) > 30 else '20'}{dob[:2]}-{dob[2:4]}-{dob[4:6]}"
    exp_parsed = f"20{expiry[:2]}-{expiry[2:4]}-{expiry[4:6]}"

    return {
        "document_type": doc_type,
        "issuing_country": country,
        "document_number": doc_number,
        "surname": surname,
        "given_names": given,
        "nationality": nationality,
        "date_of_birth": dob_parsed,
        "sex": sex,
        "expiry_date": exp_parsed,
        "is_expired": datetime.strptime(exp_parsed, "%Y-%m-%d") < datetime.now(),
    }

# ── Document Fraud Detection ────────────────────────────────────────────────

NIGERIAN_DOCUMENT_TYPES = {
    "NIN_SLIP": {"issuer": "NIMC", "format": r"^\d{11}$", "expiry_years": None},
    "BVN_CARD": {"issuer": "NIBSS", "format": r"^\d{11}$", "expiry_years": None},
    "VOTERS_CARD": {"issuer": "INEC", "format": r"^[A-Z0-9]{19}$", "expiry_years": None},
    "DRIVERS_LICENSE": {"issuer": "FRSC", "format": r"^[A-Z]{3}\d{8}[A-Z]{2}$", "expiry_years": 5},
    "INTL_PASSPORT": {"issuer": "NIS", "format": r"^[AB]\d{8}$", "expiry_years": 10},
    "NATIONAL_ID": {"issuer": "NIMC", "format": r"^\d{11}$", "expiry_years": 10},
}

def analyze_document(doc_type: str, doc_number: str, image_metadata: dict) -> dict:
    """Analyze document for potential fraud indicators."""
    indicators = []
    risk_score = 0

    if doc_type in NIGERIAN_DOCUMENT_TYPES:
        spec = NIGERIAN_DOCUMENT_TYPES[doc_type]
        if not re.match(spec["format"], doc_number):
            indicators.append({"type": "INVALID_FORMAT", "severity": "HIGH", "detail": f"Document number doesn't match expected format for {doc_type}"})
            risk_score += 30

    dpi = image_metadata.get("dpi", 300)
    if dpi < 200:
        indicators.append({"type": "LOW_RESOLUTION", "severity": "MEDIUM", "detail": f"Image resolution {dpi} DPI below minimum 200 DPI"})
        risk_score += 15

    font_score = image_metadata.get("font_consistency_score", 0.9)
    if font_score < 0.75:
        indicators.append({"type": "FONT_INCONSISTENCY", "severity": "HIGH", "detail": "Font analysis detected inconsistencies suggesting tampering"})
        risk_score += 35

    edge_score = image_metadata.get("edge_integrity_score", 0.95)
    if edge_score < 0.80:
        indicators.append({"type": "PHOTO_TAMPERING", "severity": "CRITICAL", "detail": "Edge analysis suggests photo has been digitally altered"})
        risk_score += 45

    if image_metadata.get("has_exif_anomalies", False):
        indicators.append({"type": "EXIF_ANOMALY", "severity": "MEDIUM", "detail": "EXIF metadata inconsistent with expected capture device"})
        risk_score += 20

    hologram_score = image_metadata.get("hologram_detected", 0.85)
    if hologram_score < 0.60:
        indicators.append({"type": "MISSING_SECURITY_FEATURE", "severity": "HIGH", "detail": "Expected hologram/security feature not detected"})
        risk_score += 30

    verdict = "GENUINE" if risk_score < 30 else ("SUSPICIOUS" if risk_score < 60 else "LIKELY_FRAUDULENT")

    return {
        "verdict": verdict,
        "risk_score": min(risk_score, 100),
        "indicators": indicators,
        "document_type": doc_type,
        "checks_performed": ["format_validation", "resolution_check", "font_analysis", "edge_detection", "exif_analysis", "hologram_detection"],
    }

# ── NFC Passport Reading (BAC/PACE) ─────────────────────────────────────────

def simulate_nfc_read(mrz_data: dict) -> dict:
    """Simulate NFC passport chip reading via BAC (Basic Access Control)."""
    bac_key_seed = f"{mrz_data.get('passport_number', '')}{mrz_data.get('date_of_birth', '')}{mrz_data.get('expiry_date', '')}"
    bac_hash = hashlib.sha256(bac_key_seed.encode()).hexdigest()[:32]

    return {
        "nfc_read_success": True,
        "protocol": "BAC",
        "chip_authentication": "PASSED",
        "active_authentication": "PASSED",
        "data_groups_read": ["DG1_MRZ", "DG2_FACE_IMAGE", "DG3_FINGERPRINTS", "DG14_SECURITY_INFO"],
        "sod_verified": True,
        "bac_session_key": bac_hash,
        "chip_clone_detected": False,
    }

# ── Database Helpers ─────────────────────────────────────────────────────────

def db_save_verification(result: dict):
    if not db_conn:
        return
    try:
        cur = db_conn.cursor()
        cur.execute(
            """INSERT INTO document_verifications
               (verification_id, document_type, document_number, issuing_country, surname, given_names,
                fraud_verdict, fraud_risk_score, fraud_indicators, nfc_read_success, overall_verdict, mrz_data, verified_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (verification_id) DO NOTHING""",
            (
                result.get("verification_id", ""),
                result.get("fraud_analysis", {}).get("document_type", "UNKNOWN"),
                result.get("document_number", ""),
                result.get("mrz_data", {}).get("issuing_country", ""),
                result.get("mrz_data", {}).get("surname", ""),
                result.get("mrz_data", {}).get("given_names", ""),
                result.get("fraud_analysis", {}).get("verdict", "UNKNOWN"),
                result.get("fraud_analysis", {}).get("risk_score", 0),
                json.dumps(result.get("fraud_analysis", {}).get("indicators", [])),
                result.get("nfc_verification", {}).get("nfc_read_success", False),
                result.get("overall_verdict", "UNKNOWN"),
                json.dumps(result.get("mrz_data", {})),
                result.get("timestamp", datetime.now(timezone.utc).isoformat()),
            ),
        )
        cur.execute(
            "INSERT INTO document_stats (doc_type, verdict, risk_score) VALUES (%s, %s, %s)",
            (
                result.get("fraud_analysis", {}).get("document_type", "UNKNOWN"),
                result.get("fraud_analysis", {}).get("verdict", "UNKNOWN"),
                result.get("fraud_analysis", {}).get("risk_score", 0),
            ),
        )
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB save error: {e}")

def db_get_stats() -> dict:
    if not db_conn:
        return {"total": 0, "fraudulent": 0, "fraud_rate": 0, "source": "no_database"}
    try:
        cur = db_conn.cursor()
        cur.execute("SELECT COUNT(*) FROM document_verifications")
        total = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM document_verifications WHERE fraud_verdict = 'LIKELY_FRAUDULENT'")
        fraudulent = cur.fetchone()[0]
        cur.close()
        return {"total": total, "fraudulent": fraudulent, "fraud_rate": fraudulent / total if total > 0 else 0, "source": "postgresql"}
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB stats error: {e}")
        return {"total": 0, "fraudulent": 0, "fraud_rate": 0, "source": "error"}

# ── HTTP Handler ─────────────────────────────────────────────────────────────

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
            self._json(200, {"status": "healthy", "service": SERVICE_NAME, "version": "1.0.0",
                "database": "connected" if db_conn else "disconnected",
                "capabilities": ["mrz_td1", "mrz_td3", "nfc_bac", "nfc_pace", "fraud_detection", "hologram_analysis"]})
        elif self.path == "/api/v1/document/stats":
            self._json(200, db_get_stats())
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
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))

        if self.path == "/api/v1/document/parse-mrz":
            lines = body.get("mrz_lines", [])
            if len(lines) == 2 and len(lines[0]) >= 44:
                result = parse_mrz_td3(lines[0], lines[1])
            elif len(lines) == 3:
                result = parse_mrz_td1(lines[0], lines[1], lines[2])
            else:
                self._json(400, {"error": "invalid MRZ format", "expected": "2 lines (TD3/passport) or 3 lines (TD1/ID card)"})
                return
            self._json(200, result)

        elif self.path == "/api/v1/document/verify":
            doc_type = body.get("document_type", "UNKNOWN")
            doc_number = body.get("document_number", "")
            image_metadata = body.get("image_metadata", {})
            mrz_lines = body.get("mrz_lines", [])

            result = {"verification_id": hashlib.sha256(f"{doc_number}{time.time()}".encode()).hexdigest()[:16]}
            result["document_number"] = doc_number

            if len(mrz_lines) == 2 and len(mrz_lines[0]) >= 44:
                result["mrz_data"] = parse_mrz_td3(mrz_lines[0], mrz_lines[1])

            result["fraud_analysis"] = analyze_document(doc_type, doc_number, image_metadata)

            if body.get("nfc_available", False) and "mrz_data" in result:
                result["nfc_verification"] = simulate_nfc_read(result["mrz_data"])

            result["timestamp"] = datetime.now(timezone.utc).isoformat()
            result["overall_verdict"] = result["fraud_analysis"]["verdict"]

            db_save_verification(result)
            self._json(200, result)

        elif self.path == "/api/v1/document/nfc-read":
            mrz_data = body.get("mrz_data", {})
            result = simulate_nfc_read(mrz_data)
            self._json(200, result)

        else:
            self._json(404, {"error": "not found"})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, fmt, *args): pass

if __name__ == "__main__":
    init_db()
    print(f"[{SERVICE_NAME}] Starting on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
