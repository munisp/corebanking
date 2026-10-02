"""
A6: Customer 360 — unified customer relationship view
Aggregates all accounts, cards, loans, transactions, disputes, engagement, KYC, risk
Port: 8133
"""

import json
import os
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

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

_SEED_CUSTOMERS = {
    "CUST-001": {
        "customerId": "CUST-001",
        "name": "Fatima Abdullahi",
        "email": "fatima@example.ng",
        "phone": "+2348012345678",
        "bvn": "22001234567",
        "segment": "Retail",
        "tier": "Tier 1",
        "kycLevel": 2,
        "riskScore": 0.25,
        "riskBand": "Low",
        "relationshipManager": "Adamu Yusuf",
        "location": "Kaduna",
        "status": "Active",
        "since": "2024-03-15",
        "accounts": [
            {"number": "0012345678", "type": "savings", "currency": "NGN", "balance": 5250000, "status": "active"},
            {"number": "0012345679", "type": "current", "currency": "NGN", "balance": 1200000, "status": "active"},
        ],
        "cards": [
            {"type": "debit", "scheme": "verve", "last4": "4567", "status": "active", "dailyLimit": 200000},
        ],
        "loans": [
            {"type": "personal_loan", "amount": 3500000, "outstanding": 2100000, "status": "repaying", "monthlyPayment": 145000},
        ],
        "recentTransactions": [
            {"date": "2026-01-15", "type": "credit", "amount": 250000, "narration": "Salary credit", "channel": "nip"},
            {"date": "2026-01-14", "type": "debit", "amount": 50000, "narration": "POS purchase", "channel": "card"},
            {"date": "2026-01-12", "type": "debit", "amount": 15000, "narration": "DSTV subscription", "channel": "bill_pay"},
        ],
        "disputes": [],
        "engagementScore": 78,
        "lastLogin": "2026-01-15T09:30:00Z",
        "preferredChannel": "mobile",
        "totalRelationshipValue": 8550000,
        "crossSellOpportunities": ["credit_card", "fixed_deposit", "insurance"],
    },
    "CUST-002": {
        "customerId": "CUST-002",
        "name": "Ibrahim Musa",
        "email": "ibrahim.musa@corporate.ng",
        "phone": "+2348098765432",
        "bvn": "22009876543",
        "segment": "Corporate",
        "tier": "Tier 3",
        "kycLevel": 3,
        "riskScore": 0.12,
        "riskBand": "Low",
        "relationshipManager": "Bisi Afolabi",
        "location": "Lagos",
        "status": "Active",
        "since": "2023-06-01",
        "accounts": [
            {"number": "3034567890", "type": "current", "currency": "NGN", "balance": 45000000, "status": "active"},
            {"number": "3034567891", "type": "domiciliary", "currency": "USD", "balance": 125000, "status": "active"},
        ],
        "cards": [
            {"type": "credit", "scheme": "mastercard", "last4": "8901", "status": "active", "creditLimit": 5000000},
            {"type": "debit", "scheme": "visa", "last4": "2345", "status": "active", "dailyLimit": 2000000},
        ],
        "loans": [
            {"type": "mortgage", "amount": 120000000, "outstanding": 115000000, "status": "repaying", "monthlyPayment": 1850000},
            {"type": "trade_finance_lc", "amount": 25000000, "outstanding": 25000000, "status": "active"},
        ],
        "recentTransactions": [
            {"date": "2026-01-15", "type": "debit", "amount": 15000000, "narration": "Supplier payment", "channel": "rtgs"},
            {"date": "2026-01-14", "type": "credit", "amount": 28000000, "narration": "Customer collection", "channel": "nip"},
            {"date": "2026-01-13", "type": "debit", "amount": 1850000, "narration": "Mortgage installment", "channel": "standing_order"},
        ],
        "disputes": [
            {"id": "DSP-001", "amount": 2500000, "category": "service_not_rendered", "status": "investigating"},
        ],
        "engagementScore": 92,
        "lastLogin": "2026-01-15T14:22:00Z",
        "preferredChannel": "internet_banking",
        "totalRelationshipValue": 190125000,
        "crossSellOpportunities": ["treasury_products", "fx_forward", "trade_insurance"],
    },
    "CUST-003": {
        "customerId": "CUST-003",
        "name": "Jumoke Adeyemi",
        "email": "jumoke.a@trade.ng",
        "phone": "+2348055512345",
        "bvn": "22005551234",
        "segment": "Trade",
        "tier": "Tier 2",
        "kycLevel": 2,
        "riskScore": 0.35,
        "riskBand": "Medium",
        "relationshipManager": "Charles Obi",
        "location": "Lagos",
        "status": "Active",
        "since": "2024-09-20",
        "accounts": [
            {"number": "2098765432", "type": "current", "currency": "NGN", "balance": 8500000, "status": "active"},
        ],
        "cards": [
            {"type": "debit", "scheme": "visa", "last4": "6789", "status": "active", "dailyLimit": 1000000},
        ],
        "loans": [],
        "recentTransactions": [
            {"date": "2026-01-15", "type": "credit", "amount": 5000000, "narration": "Export proceeds", "channel": "swift"},
        ],
        "disputes": [],
        "engagementScore": 65,
        "lastLogin": "2026-01-14T16:45:00Z",
        "preferredChannel": "mobile",
        "totalRelationshipValue": 8500000,
        "crossSellOpportunities": ["trade_finance_lc", "fx_forward", "domiciliary_account"],
    },
}



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


# W12-C3P2B5: customer 360 profiles persisted in PG (natural key = customerId;
# idempotent upsert makes profile-create retries safe).
CUSTOMER_STORE = _W12Store("customer_profiles", key="customerId",
                           seed=list(_SEED_CUSTOMERS.values()))


MIDDLEWARE_CONFIG = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092")},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379")},
    "postgres": {"url": _require_env("DATABASE_URL")},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200")},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54link-dev"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476")},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500")},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003")},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233")},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:3002")},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000")},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8181")},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080")},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:4000")},
}

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
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json({"error": "unauthorized", "detail": _n1_err}, status=401)
                return
        if self.path == "/healthz":
            return self._json({"status": "ok", "service": "customer-360", "middleware": MIDDLEWARE_CONFIG, "port": "8133"})

        if self.path == "/v1/customer-360/profiles":
            try:
                items = CUSTOMER_STORE.all()
            except Exception as _e:
                return self._json({"error": "persistence_unavailable", "detail": str(_e)}, 503)
            return self._json({"items": items, "total": len(items)})

        if self.path.startswith("/v1/customer-360/profiles/"):
            cid = self.path.split("/")[-1]
            try:
                _row = CUSTOMER_STORE.get(cid)
            except Exception as _e:
                return self._json({"error": "persistence_unavailable", "detail": str(_e)}, 503)
            if _row:
                return self._json(_row)
            return self._json({"error": "customer not found"}, 404)

        if self.path == "/v1/customer-360/segments":
            try:
                SEED_CUSTOMERS = {r["customerId"]: r for r in CUSTOMER_STORE.all()}
            except Exception as _e:
                return self._json({"error": "persistence_unavailable", "detail": str(_e)}, 503)
            segments = {}
            for c in SEED_CUSTOMERS.values():
                seg = c["segment"]
                if seg not in segments:
                    segments[seg] = {"segment": seg, "count": 0, "totalValue": 0}
                segments[seg]["count"] += 1
                segments[seg]["totalValue"] += c["totalRelationshipValue"]
            return self._json(list(segments.values()))

        if self.path == "/v1/customer-360/cross-sell":
            try:
                SEED_CUSTOMERS = {r["customerId"]: r for r in CUSTOMER_STORE.all()}
            except Exception as _e:
                return self._json({"error": "persistence_unavailable", "detail": str(_e)}, 503)
            opportunities = []
            for c in SEED_CUSTOMERS.values():
                for opp in c.get("crossSellOpportunities", []):
                    opportunities.append({
                        "customerId": c["customerId"],
                        "customerName": c["name"],
                        "product": opp,
                        "segment": c["segment"],
                        "relationshipValue": c["totalRelationshipValue"],
                    })
            return self._json(opportunities)

        self._json({"error": "not found"}, 404)

    def do_POST(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json({"error": "unauthorized", "detail": _n1_err}, status=401)
                return
        content_len = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}

        if self.path == "/v1/customer-360/profiles":
            try:
                CUSTOMER_STORE.ensure()
                _n = _w12_run("SELECT COUNT(*) AS n FROM customer_profiles", fetch="one")["n"]
            except Exception as _e:
                return self._json({"error": "persistence_unavailable", "detail": str(_e)}, 503)
            cid = body.get("customerId", f"CUST-{_n+1:03d}")
            profile = {
                "customerId": cid,
                "name": body.get("name", ""),
                "email": body.get("email", ""),
                "phone": body.get("phone", ""),
                "segment": body.get("segment", "Retail"),
                "tier": body.get("tier", "Tier 1"),
                "kycLevel": body.get("kycLevel", 1),
                "riskScore": body.get("riskScore", 0.5),
                "riskBand": body.get("riskBand", "Medium"),
                "status": "Active",
                "accounts": [],
                "cards": [],
                "loans": [],
                "recentTransactions": [],
                "disputes": [],
                "engagementScore": 50,
                "totalRelationshipValue": 0,
                "crossSellOpportunities": ["savings", "debit_card"],
            }
            try:
                CUSTOMER_STORE.put(cid, profile)
            except Exception as _e:
                return self._json({"error": "persistence_unavailable", "detail": str(_e)}, 503)
            return self._json(profile, 201)

        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "8133"))
    print(f"Customer 360 Service listening on :{port}")
    HTTPServer(("", port), Handler).serve_forever()
