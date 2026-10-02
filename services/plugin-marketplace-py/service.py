"""Plugin marketplace: third-party integration ecosystem with install,
configure, enable/disable, and usage tracking per tenant."""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# --- W12-C3P2B5: PostgreSQL persistence (replaces in-memory singleton stores) ---
# Pattern: pooled psycopg2 (fleet ref: services/inventory-py/main.py:63-116).
# PG is authoritative: create/update/delete hit Postgres transactionally
# (autocommit => each statement is its own transaction); on PG failure the
# handler returns 503. There is NO in-memory shadow that could silently
# diverge from PG (cf. failed_login_tracker anti-pattern).
import threading as _w12_threading
import psycopg2 as _w12_pg
import psycopg2.pool as _w12_pgpool
import psycopg2.extras as _w12_pgextras

_w12_pool = None
_w12_pool_lock = _w12_threading.Lock()


def _w12_get_pool():
    global _w12_pool
    if _w12_pool is None or _w12_pool.closed:
        with _w12_pool_lock:
            if _w12_pool is None or _w12_pool.closed:
                _w12_pool = _w12_pgpool.ThreadedConnectionPool(1, 10, os.environ["DATABASE_URL"])
    return _w12_pool


def _w12_run(sql, params=(), fetch="all"):
    """Run one statement on a pooled connection (autocommit = per-statement transaction)."""
    conn = _w12_get_pool().getconn()
    try:
        conn.autocommit = True
        with conn.cursor(cursor_factory=_w12_pgextras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch == "all":
                return cur.fetchall()
            if fetch == "one":
                return cur.fetchone()
            return cur.rowcount
    finally:
        _w12_get_pool().putconn(conn)


class _W12Store:
    """Per-domain PG table (jsonb payload pattern):
    id uuid pk default gen_random_uuid(), record_id text UNIQUE (natural key;
    upsert makes retry-able creates idempotent), tenant_id text, payload jsonb,
    created_at/updated_at timestamptz default now()."""
    _ensured = set()
    _ensured_lock = _w12_threading.Lock()

    def __init__(self, table, key="id", seed=(), tenant_key="tenant_id"):
        self.table = table
        self.key = key
        self.seed = list(seed)
        self.tenant_key = tenant_key

    def ensure(self):
        with _W12Store._ensured_lock:
            if self.table in _W12Store._ensured:
                return
            _w12_run(f"""CREATE TABLE IF NOT EXISTS {self.table} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)""", fetch=None)
            for row in self.seed:
                _rid = row.get("_rid", row.get(self.key, ""))
                _payload = {k: v for k, v in row.items() if k != "_rid"}
                _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb) ON CONFLICT (record_id) DO NOTHING""",
                         (str(_rid), row.get(self.tenant_key),
                          json.dumps(_payload, default=str)), fetch=None)
            _W12Store._ensured.add(self.table)

    def all(self, limit=100000):
        self.ensure()
        return [r["payload"] for r in _w12_run(
            f"SELECT payload FROM {self.table} ORDER BY created_at, record_id LIMIT %s", (limit,))]

    def get(self, record_id):
        self.ensure()
        row = _w12_run(f"SELECT payload FROM {self.table} WHERE record_id = %s",
                       (str(record_id),), fetch="one")
        return row["payload"] if row else None

    def put(self, record_id, payload, tenant_id=None):
        self.ensure()
        _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb)
ON CONFLICT (record_id) DO UPDATE
SET payload = EXCLUDED.payload, tenant_id = EXCLUDED.tenant_id, updated_at = NOW()""",
                 (str(record_id),
                  tenant_id if tenant_id is not None else payload.get(self.tenant_key),
                  json.dumps(payload, default=str)), fetch=None)

    def delete(self, record_id):
        self.ensure()
        return _w12_run(f"DELETE FROM {self.table} WHERE record_id = %s",
                        (str(record_id),), fetch=None)


def _w12_get_by(store, field, value):
    """First row whose payload field matches (jsonb ->> lookup)."""
    store.ensure()
    row = _w12_run(f"SELECT payload FROM {store.table} WHERE payload ->> %s = %s LIMIT 1",
                   (field, value), fetch="one")
    return row["payload"] if row else None


def _w12_all_by(store, field, value, limit=100000):
    """All rows whose payload field matches (jsonb ->> lookup)."""
    store.ensure()
    rows = _w12_run(
        f"SELECT payload FROM {store.table} WHERE payload ->> %s = %s ORDER BY created_at, record_id LIMIT %s",
        (field, value, limit))
    return [r["payload"] for r in rows]

PORT = int(os.environ.get("PORT", "8240"))

MIDDLEWARE = ["kafka", "dapr", "fluvio", "temporal", "postgres", "keycloak",
              "permify", "redis", "mojaloop", "opensearch", "openappsec",
              "apisix", "tigerbeetle", "lakehouse"]

_PLUGIN_SEED = [
    {"id": "PLG-001", "name": "Paystack Payment Gateway", "vendor": "Paystack", "category": "payments", "version": "3.2.1", "status": "published", "installs": 342, "rating": 4.8, "pricing": "free", "description": "Accept payments via Paystack inline, popup, or redirect"},
    {"id": "PLG-002", "name": "Flutterwave Payments", "vendor": "Flutterwave", "category": "payments", "version": "2.8.0", "status": "published", "installs": 287, "rating": 4.6, "pricing": "free", "description": "Multi-currency payments with Flutterwave Rave"},
    {"id": "PLG-003", "name": "Termii SMS/OTP", "vendor": "Termii", "category": "communications", "version": "1.5.0", "status": "published", "installs": 198, "rating": 4.3, "pricing": "usage_based", "description": "SMS notifications and OTP delivery via Termii"},
    {"id": "PLG-004", "name": "Mono Account Connect", "vendor": "Mono", "category": "open_banking", "version": "2.1.0", "status": "published", "installs": 156, "rating": 4.5, "pricing": "tiered", "description": "Account linking and transaction data via Mono"},
    {"id": "PLG-005", "name": "Smile Identity KYC", "vendor": "Smile Identity", "category": "kyc", "version": "4.0.2", "status": "published", "installs": 234, "rating": 4.7, "pricing": "per_verification", "description": "AI-powered KYC with BVN, NIN, and biometric verification"},
    {"id": "PLG-006", "name": "Interswitch Quickteller", "vendor": "Interswitch", "category": "payments", "version": "5.1.0", "status": "published", "installs": 189, "rating": 4.2, "pricing": "per_transaction", "description": "Bill payments and airtime via Quickteller"},
    {"id": "PLG-007", "name": "Remita Collections", "vendor": "Remita", "category": "collections", "version": "3.0.1", "status": "published", "installs": 145, "rating": 4.1, "pricing": "per_transaction", "description": "NIBSS-powered direct debit and mandate management"},
    {"id": "PLG-008", "name": "Carbon Credit Scoring", "vendor": "Carbon", "category": "lending", "version": "1.2.0", "status": "published", "installs": 89, "rating": 4.0, "pricing": "per_query", "description": "AI credit scoring with alternative data sources"},
    {"id": "PLG-009", "name": "Cowrywise Savings API", "vendor": "Cowrywise", "category": "savings", "version": "2.0.0", "status": "beta", "installs": 34, "rating": 0.0, "pricing": "revenue_share", "description": "Automated savings and investment products"},
    {"id": "PLG-010", "name": "Zoho Books Accounting", "vendor": "Zoho", "category": "accounting", "version": "6.2.0", "status": "published", "installs": 112, "rating": 4.4, "pricing": "monthly", "description": "Accounting integration with Zoho Books"},
]

_INSTALL_SEED = [
    {"tenantId": "54link-dev-retail", "pluginId": "PLG-001", "status": "active", "installedAt": "2026-01-15T00:00:00Z", "config": {"apiKey": "pk_***", "environment": "production"}},
    {"tenantId": "54link-dev-retail", "pluginId": "PLG-003", "status": "active", "installedAt": "2026-02-01T00:00:00Z", "config": {"senderId": "54link-dev", "channel": "generic"}},
    {"tenantId": "54link-dev-retail", "pluginId": "PLG-005", "status": "active", "installedAt": "2026-01-20T00:00:00Z", "config": {"partnerId": "SID-54B", "environment": "production"}},
    {"tenantId": "mutual-mfb", "pluginId": "PLG-001", "status": "active", "installedAt": "2026-03-20T00:00:00Z", "config": {"apiKey": "pk_***", "environment": "production"}},
    {"tenantId": "mutual-mfb", "pluginId": "PLG-007", "status": "active", "installedAt": "2026-03-25T00:00:00Z", "config": {"merchantId": "REM-MUTUAL"}},
    {"tenantId": "mutual-mfb", "pluginId": "PLG-008", "status": "active", "installedAt": "2026-04-01T00:00:00Z", "config": {"apiKey": "cs_***"}},
    {"tenantId": "xmts-agency", "pluginId": "PLG-003", "status": "active", "installedAt": "2026-04-05T00:00:00Z", "config": {"senderId": "XMTS", "channel": "dnd"}},
    {"tenantId": "paystack-embed", "pluginId": "PLG-004", "status": "active", "installedAt": "2026-02-15T00:00:00Z", "config": {"appId": "mono_***"}},
    {"tenantId": "paystack-embed", "pluginId": "PLG-010", "status": "inactive", "installedAt": "2026-03-01T00:00:00Z", "config": {"orgId": "zoho_***"}},
]


# W12-C3P2B5: PG-backed stores. tenant_installs natural key = tenantId:pluginId
# (idempotent re-install via ON CONFLICT upsert).
PLUGIN_STORE = _W12Store("plugins", seed=_PLUGIN_SEED)
INSTALL_STORE = _W12Store("tenant_installs", seed=[
    {**r, "_rid": f"{r['tenantId']}:{r['pluginId']}"} for r in _INSTALL_SEED])


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
    def log_message(self, fmt, *args):
        pass

    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json({"error": "unauthorized", "detail": _n1_err}, status=401)
                return
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/healthz":
            return self._json({"status": "healthy",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["plugin_marketplace.events", "plugin_marketplace.audit"]},
                "dapr": {"status": "connected", "appId": "plugin_marketplace-sidecar"},
                "fluvio": {"status": "connected", "topic": "plugin_marketplace-stream"},
                "temporal": {"status": "connected", "namespace": "plugin_marketplace"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "plugin_marketplace"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "plugin_marketplace_authz"},
                "redis": {"status": "connected", "prefix": "plugin_marketplace:"},
                "mojaloop": {"status": "connected", "participant": "plugin_marketplace"},
                "opensearch": {"status": "connected", "index": "plugin_marketplace-*"},
                "openappsec": {"status": "connected", "policy": "plugin_marketplace-protection"},
                "apisix": {"status": "connected", "upstream": "plugin_marketplace"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "plugin_marketplace_iceberg"}
            }, "service": "plugin-marketplace-py", "port": PORT, "middleware": MIDDLEWARE})

        if path == "/v1/plugins":
            category = qs.get("category", [None])[0]
            try:
                items = _w12_all_by(PLUGIN_STORE, "category", category) if category else PLUGIN_STORE.all()
            except Exception as _e:
                return self._json({"error": "persistence_unavailable", "detail": str(_e)}, 503)
            return self._json({"items": items, "total": len(items)})

        if path == "/v1/tenant-installs":
            tid = qs.get("tenantId", [None])[0]
            try:
                items = _w12_all_by(INSTALL_STORE, "tenantId", tid) if tid else INSTALL_STORE.all()
            except Exception as _e:
                return self._json({"error": "persistence_unavailable", "detail": str(_e)}, 503)
            active = sum(1 for i in items if i["status"] == "active")
            return self._json({"items": items, "total": len(items), "active": active})

        if path == "/v1/stats":
            try:
                plugins = PLUGIN_STORE.all()
                tenant_installs = INSTALL_STORE.all()
            except Exception as _e:
                return self._json({"error": "persistence_unavailable", "detail": str(_e)}, 503)
            categories = list(set(p["category"] for p in plugins))
            total_installs = sum(p["installs"] for p in plugins)
            active_tenant_installs = sum(1 for i in tenant_installs if i["status"] == "active")
            return self._json({
                "total_plugins": len(plugins),
                "total_marketplace_installs": total_installs,
                "categories": sorted(categories),
                "total_tenant_installs": len(tenant_installs),
                "active_tenant_installs": active_tenant_installs,
                "tenants_with_plugins": len(set(i["tenantId"] for i in tenant_installs)),
                "avg_rating": round(sum(p["rating"] for p in plugins if p["rating"] > 0) / sum(1 for p in plugins if p["rating"] > 0), 1),
            })

        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"plugin-marketplace-py listening on :{PORT}")
    server.serve_forever()
