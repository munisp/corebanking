#!/usr/bin/env python3
"""Ndpr Compliance — Domain-specific Python microservice
Middleware: Kafka, Postgres, Redis, Temporal, TigerBeetle, Permify, OpenSearch
"""
import os, json, logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='[ndpr-compliance-py] %(levelname)s %(message)s')
PORT = int(os.environ.get("PORT", "9440"))
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

# CP-08: NDPR/NDPA-2023 data-subject rights registry — REAL implementation.
# The previous hardcoded RECORDS (including a fake nfiu_ctr "auto_filed count
# 342" row) and STATS ("complianceScore": 98.5) were fiction and have been
# deleted. All DSR state now lives in Postgres (dsr_requests); every count is
# computed from the table. Erasure sets a tombstone flag and is blocked by an
# active legal hold.

import hashlib
import threading
import uuid

import psycopg2
import psycopg2.extras
import psycopg2.pool

DATABASE_URL = os.environ.get("DATABASE_URL", "")
_pool = None
_pool_lock = threading.Lock()

DSR_TYPES = ("access", "erasure", "portability")
DSR_STATUSES = ("submitted", "identity_verified", "in_progress", "fulfilled", "rejected")


def _get_pool():
    global _pool
    with _pool_lock:
        if _pool is None and DATABASE_URL:
            _pool = psycopg2.pool.ThreadedConnectionPool(1, 10, DATABASE_URL)
            conn = _pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS dsr_requests (
                            id                TEXT PRIMARY KEY,
                            tenant_id         TEXT NOT NULL,
                            subject_id        TEXT NOT NULL,
                            type              TEXT NOT NULL CHECK (type IN ('access','erasure','portability')),
                            status            TEXT NOT NULL DEFAULT 'submitted'
                                              CHECK (status IN ('submitted','identity_verified','in_progress','fulfilled','rejected')),
                            identity_proof_ref TEXT,
                            legal_hold        BOOLEAN NOT NULL DEFAULT FALSE,
                            tombstone         BOOLEAN NOT NULL DEFAULT FALSE,
                            certificate_hash  TEXT,
                            detail            JSONB,
                            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                            fulfilled_at      TIMESTAMPTZ
                        );
                        CREATE INDEX IF NOT EXISTS idx_dsr_tenant ON dsr_requests (tenant_id, created_at DESC);
                        CREATE INDEX IF NOT EXISTS idx_dsr_subject ON dsr_requests (subject_id);
                    """)
                conn.commit()
            finally:
                _pool.putconn(conn)
        return _pool


def _query(sql, params=(), fetch="all"):
    pool = _get_pool()
    if pool is None:
        return None  # caller maps to 503
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch == "one":
                row = cur.fetchone()
            elif fetch == "all":
                row = cur.fetchall()
            else:
                row = None
        conn.commit()
        return row
    finally:
        pool.putconn(conn)


def _certificate(subject_id, dsr_id):
    return hashlib.sha256(f"ndpr-erasure:{dsr_id}:{subject_id}:{datetime.utcnow().isoformat()}Z".encode()).hexdigest()


class Handler(BaseHTTPRequestHandler):
    def _auth(self):
        _path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _path in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            return True
        claims, err = validate_jwt(dict(self.headers))
        if err:
            self._json(401, {"error": "unauthorized", "detail": err})
            return False
        return True

    def do_GET(self):
        if not self._auth():
            return
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        if path in ("/healthz", "/health"):
            self._json(200, {"service": "ndpr-compliance-py", "status": "healthy",
                             "storage": "postgres" if DATABASE_URL else "NOT CONFIGURED"})
            return
        if path == "/v1/ndpr/stats" or path == "/v1/ndpr-compliance/stats":
            # CP-08: computed from the real table — never hardcoded.
            rows = _query("SELECT type, status, COUNT(*) AS n FROM dsr_requests GROUP BY type, status")
            if rows is None:
                self._json(503, {"error": "database unavailable"})
                return
            stats = {"byType": {}, "byStatus": {}, "total": 0}
            for r in rows:
                stats["byType"][r["type"]] = stats["byType"].get(r["type"], 0) + r["n"]
                stats["byStatus"][r["status"]] = stats["byStatus"].get(r["status"], 0) + r["n"]
                stats["total"] += r["n"]
            self._json(200, stats)
            return
        if path.startswith("/v1/ndpr/dsr/"):
            dsr_id = path.rsplit("/", 1)[-1]
            row = _query("SELECT * FROM dsr_requests WHERE id=%s", (dsr_id,), fetch="one")
            if row is None:
                self._json(503, {"error": "database unavailable"})
                return
            if not row:
                self._json(404, {"error": "dsr not found"})
                return
            row = dict(row)
            for k in ("created_at", "fulfilled_at"):
                if row.get(k):
                    row[k] = row[k].isoformat()
            self._json(200, row)
            return
        if path == "/v1/ndpr/dsr" or path == "/v1/ndpr-compliance/list":
            from urllib.parse import parse_qs
            qs = parse_qs(parsed.query)
            tenant = (qs.get("tenant_id") or [None])[0]
            if tenant:
                rows = _query("SELECT * FROM dsr_requests WHERE tenant_id=%s ORDER BY created_at DESC LIMIT 200", (tenant,))
            else:
                rows = _query("SELECT * FROM dsr_requests ORDER BY created_at DESC LIMIT 200")
            if rows is None:
                self._json(503, {"error": "database unavailable"})
                return
            out = []
            for r in rows:
                r = dict(r)
                for k in ("created_at", "fulfilled_at"):
                    if r.get(k):
                        r[k] = r[k].isoformat()
                out.append(r)
            self._json(200, {"records": out, "total": len(out)})
            return
        self._json(404, {"error": "Not found"})

    def do_POST(self):
        if not self._auth():
            return
        path = urlparse(self.path).path.rstrip("/")
        content_len = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}
        except Exception:
            self._json(400, {"error": "invalid json"})
            return

        if path == "/v1/ndpr/dsr/submit":
            dsr_type = body.get("type")
            tenant = body.get("tenant_id")
            subject = body.get("subject_id")
            if dsr_type not in DSR_TYPES or not tenant or not subject:
                self._json(400, {"error": "type (access|erasure|portability), tenant_id and subject_id are required"})
                return
            dsr_id = "DSR-" + uuid.uuid4().hex[:12].upper()
            row = _query(
                """INSERT INTO dsr_requests (id, tenant_id, subject_id, type, identity_proof_ref, detail)
                   VALUES (%s,%s,%s,%s,%s,%s) RETURNING id, status, created_at""",
                (dsr_id, tenant, subject, dsr_type, body.get("identity_proof_ref"),
                 json.dumps({"note": body.get("note", "")})),
                fetch="one")
            if row is None:
                self._json(503, {"error": "database unavailable"})
                return
            self._json(201, {"id": row["id"], "status": row["status"],
                             "created_at": row["created_at"].isoformat()})
            return

        if path.endswith("/verify-identity"):
            dsr_id = path.split("/")[-2]
            proof = body.get("identity_proof_ref")
            if not proof:
                self._json(400, {"error": "identity_proof_ref required"})
                return
            row = _query(
                """UPDATE dsr_requests SET status='identity_verified', identity_proof_ref=%s
                   WHERE id=%s AND status='submitted' RETURNING id""",
                (proof, dsr_id), fetch="one")
            if row is None:
                self._json(503, {"error": "database unavailable"})
                return
            if not row:
                self._json(409, {"error": "dsr not found or not awaiting identity verification"})
                return
            self._json(200, {"id": dsr_id, "status": "identity_verified"})
            return

        if path.endswith("/fulfil"):
            dsr_id = path.split("/")[-2]
            row = _query("SELECT * FROM dsr_requests WHERE id=%s", (dsr_id,), fetch="one")
            if row is None:
                self._json(503, {"error": "database unavailable"})
                return
            if not row:
                self._json(404, {"error": "dsr not found"})
                return
            if row["status"] in ("fulfilled", "rejected"):
                self._json(409, {"error": f"dsr already {row['status']}"})
                return
            if not row["identity_proof_ref"]:
                self._json(409, {"error": "identity proof required before fulfilment (NDPA 2023)"})
                return
            # CP-08: erasure = tombstone flag; an active legal hold blocks it.
            if row["type"] == "erasure":
                if row["legal_hold"]:
                    self._json(409, {"error": "erasure blocked by active legal hold"})
                    return
                cert = _certificate(row["subject_id"], dsr_id)
                _query(
                    """UPDATE dsr_requests SET status='fulfilled', tombstone=TRUE,
                       certificate_hash=%s, fulfilled_at=now() WHERE id=%s""",
                    (cert, dsr_id), fetch="none")
                self._json(200, {"id": dsr_id, "status": "fulfilled", "tombstone": True,
                                 "certificate_hash": cert,
                                 "note": "Subject PII tombstoned; per-service anonymization runbooks apply. Ledger records are immutable by design."})
                return
            cert = _certificate(row["subject_id"], dsr_id)
            _query(
                """UPDATE dsr_requests SET status='fulfilled', certificate_hash=%s,
                   fulfilled_at=now() WHERE id=%s""",
                (cert, dsr_id), fetch="none")
            self._json(200, {"id": dsr_id, "status": "fulfilled", "certificate_hash": cert})
            return

        if path.endswith("/legal-hold"):
            dsr_id = path.split("/")[-2]
            held = bool(body.get("held", True))
            row = _query("UPDATE dsr_requests SET legal_hold=%s WHERE id=%s RETURNING id",
                         (held, dsr_id), fetch="one")
            if row is None:
                self._json(503, {"error": "database unavailable"})
                return
            if not row:
                self._json(404, {"error": "dsr not found"})
                return
            self._json(200, {"id": dsr_id, "legal_hold": held})
            return

        # CP-08: the old /v1/ndpr-compliance/create (in-memory echo into a
        # hardcoded list) was deleted — it fabricated records.
        self._json(404, {"error": "Not found"})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args): pass

if __name__ == "__main__":
    logging.info(f"Ndpr Compliance (Python) on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
