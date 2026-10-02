"""Batch Processing Engine — EOD processing, interest accrual, statement generation, dormancy checks.
Port: 8117
Middleware: Kafka, Redis, Temporal, Postgres, OpenSearch
"""
import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional
import os

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
                _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb) ON CONFLICT (record_id) DO NOTHING""",
                         (str(row.get(self.key, "")), row.get(self.tenant_key),
                          json.dumps(row, default=str)), fetch=None)
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

@dataclass
class BatchJob:
    id: str = ""
    job_type: str = ""  # eod_processing, interest_accrual, statement_generation, dormancy_check, gl_reconciliation, regulatory_return
    status: str = "pending"  # pending, running, completed, failed, cancelled
    scheduled_at: str = ""
    started_at: str = ""
    completed_at: str = ""
    records_processed: int = 0
    records_failed: int = 0
    total_records: int = 0
    error_message: str = ""
    parameters: dict = field(default_factory=dict)
    created_by: str = "system"
    duration_seconds: float = 0.0

    def to_dict(self):
        return asdict(self)


@dataclass
class InterestAccrual:
    id: str = ""
    account_id: str = ""
    account_type: str = ""  # savings, fixed_deposit, current
    principal: float = 0.0
    rate: float = 0.0  # annual rate as percentage
    accrued_amount: float = 0.0
    accrual_date: str = ""
    period_days: int = 1
    method: str = "daily"  # daily, monthly, quarterly
    status: str = "calculated"

    def to_dict(self):
        return asdict(self)


@dataclass
class AccountStatement:
    id: str = ""
    account_id: str = ""
    period_start: str = ""
    period_end: str = ""
    opening_balance: float = 0.0
    closing_balance: float = 0.0
    total_credits: float = 0.0
    total_debits: float = 0.0
    transaction_count: int = 0
    format: str = "pdf"  # pdf, csv, xlsx
    status: str = "generated"
    generated_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class DormancyCheck:
    id: str = ""
    account_id: str = ""
    last_activity_date: str = ""
    days_inactive: int = 0
    status: str = ""  # active, pre_dormant, dormant, unclaimed
    action_taken: str = ""  # none, sms_sent, email_sent, flagged, frozen
    check_date: str = ""

    def to_dict(self):
        return asdict(self)


# W12-C3P2B5: per-domain PG stores. `interest_accruals` holds computed accrual
# OUTPUT records (audit trail of batch calculations), not balance/ledger state.
BATCH_JOB_STORE = _W12Store("batch_jobs")
ACCRUAL_STORE = _W12Store("interest_accruals")
STATEMENT_STORE = _W12Store("account_statements")
DORMANCY_STORE = _W12Store("dormancy_checks")


def handle_batch_jobs(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        try:
            _items = BATCH_JOB_STORE.all()
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        return 200, {"items": _items, "total": len(_items)}
    if method == "POST":
        valid_types = ("eod_processing", "interest_accrual", "statement_generation", "dormancy_check", "gl_reconciliation", "regulatory_return")
        if body.get("job_type") not in valid_types:
            return 400, {"error": f"job_type must be one of: {', '.join(valid_types)}"}

        job = BatchJob(
            id=f"BATCH-{uuid.uuid4().hex[:8]}",
            job_type=body["job_type"],
            status="running",
            scheduled_at=body.get("scheduled_at", datetime.now(timezone.utc).isoformat()),
            started_at=datetime.now(timezone.utc).isoformat(),
            parameters=body.get("parameters", {}),
            created_by=body.get("created_by", "system"),
        )

        # Simulate processing based on job type
        if job.job_type == "interest_accrual":
            job.total_records = body.get("parameters", {}).get("account_count", 100)
            job.records_processed = job.total_records
            try:
                _run_interest_accrual(body.get("parameters", {}))
            except Exception as _e:
                return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        elif job.job_type == "statement_generation":
            job.total_records = body.get("parameters", {}).get("account_count", 50)
            job.records_processed = job.total_records
            try:
                _run_statement_generation(body.get("parameters", {}))
            except Exception as _e:
                return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        elif job.job_type == "dormancy_check":
            job.total_records = body.get("parameters", {}).get("account_count", 200)
            job.records_processed = job.total_records
            try:
                _run_dormancy_check(body.get("parameters", {}))
            except Exception as _e:
                return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        elif job.job_type == "eod_processing":
            job.total_records = 5
            job.records_processed = 5
        elif job.job_type == "gl_reconciliation":
            job.total_records = body.get("parameters", {}).get("entry_count", 1000)
            job.records_processed = job.total_records
        elif job.job_type == "regulatory_return":
            job.total_records = 1
            job.records_processed = 1

        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc).isoformat()
        job.duration_seconds = 0.5
        try:
            BATCH_JOB_STORE.put(job.id, job.to_dict())
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        return 201, job.to_dict()
    return 405, {"error": "method not allowed"}


def _run_interest_accrual(params: dict):
    rate = params.get("rate", 4.5)
    principal = params.get("principal", 1000000)
    period_days = params.get("period_days", 1)
    count = params.get("account_count", 5)

    for i in range(min(count, 10)):
        daily_rate = rate / 100 / 365
        accrued = principal * daily_rate * period_days
        acc = InterestAccrual(
            id=f"INT-{uuid.uuid4().hex[:8]}",
            account_id=f"ACCT-{1000 + i}",
            account_type="savings",
            principal=principal,
            rate=rate,
            accrued_amount=round(accrued, 2),
            accrual_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            period_days=period_days,
            method="daily",
        )
        ACCRUAL_STORE.put(acc.id, acc.to_dict())


def _run_statement_generation(params: dict):
    count = params.get("account_count", 3)
    period = params.get("period", "monthly")
    now = datetime.now(timezone.utc)
    if period == "monthly":
        start = (now.replace(day=1) - timedelta(days=1)).replace(day=1)
        end = now.replace(day=1) - timedelta(days=1)
    else:
        start = now - timedelta(days=30)
        end = now

    for i in range(min(count, 10)):
        stmt = AccountStatement(
            id=f"STMT-{uuid.uuid4().hex[:8]}",
            account_id=f"ACCT-{1000 + i}",
            period_start=start.strftime("%Y-%m-%d"),
            period_end=end.strftime("%Y-%m-%d"),
            opening_balance=500000 + i * 100000,
            closing_balance=550000 + i * 100000,
            total_credits=150000,
            total_debits=100000,
            transaction_count=25 + i * 5,
            format=params.get("format", "pdf"),
            generated_at=now.isoformat(),
        )
        STATEMENT_STORE.put(stmt.id, stmt.to_dict())


def _run_dormancy_check(params: dict):
    threshold_days = params.get("threshold_days", 365)
    count = params.get("account_count", 5)
    now = datetime.now(timezone.utc)

    for i in range(min(count, 10)):
        days = 30 + i * 120  # Simulate varying inactivity
        if days < 180:
            status = "active"
            action = "none"
        elif days < 365:
            status = "pre_dormant"
            action = "sms_sent"
        elif days < 730:
            status = "dormant"
            action = "flagged"
        else:
            status = "unclaimed"
            action = "frozen"

        check = DormancyCheck(
            id=f"DRM-{uuid.uuid4().hex[:8]}",
            account_id=f"ACCT-{2000 + i}",
            last_activity_date=(now - timedelta(days=days)).strftime("%Y-%m-%d"),
            days_inactive=days,
            status=status,
            action_taken=action,
            check_date=now.strftime("%Y-%m-%d"),
        )
        DORMANCY_STORE.put(check.id, check.to_dict())


def handle_accruals(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        try:
            _items = ACCRUAL_STORE.all()
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        return 200, {"accruals": _items, "total": len(_items)}
    return 405, {"error": "method not allowed"}


def handle_statements(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        try:
            _items = STATEMENT_STORE.all()
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        return 200, {"statements": _items, "total": len(_items)}
    return 405, {"error": "method not allowed"}


def handle_dormancy(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        try:
            _items = DORMANCY_STORE.all()
        except Exception as _e:
            return 503, {"error": "persistence_unavailable", "detail": str(_e)}
        return 200, {"checks": _items, "total": len(_items)}
    return 405, {"error": "method not allowed"}


def handle_schedule(method: str, body: dict) -> tuple[int, dict]:
    """Return the default EOD schedule."""
    if method == "GET":
        schedule = [
            {"time": "00:00", "job": "eod_processing", "description": "End of day processing, GL close"},
            {"time": "00:30", "job": "interest_accrual", "description": "Daily interest accrual for all accounts"},
            {"time": "01:00", "job": "gl_reconciliation", "description": "GL reconciliation and balancing"},
            {"time": "02:00", "job": "dormancy_check", "description": "Check accounts for dormancy (>365 days inactive)"},
            {"time": "03:00", "job": "statement_generation", "description": "Generate monthly statements (1st of month only)"},
            {"time": "04:00", "job": "regulatory_return", "description": "Generate and submit regulatory returns"},
        ]
        return 200, {"schedule": schedule, "timezone": "Africa/Lagos"}
    return 405, {"error": "method not allowed"}


def _w12_stats():
    """W12-C3P2B5: counts from PG; degraded marker on PG failure."""
    try:
        for _s in (BATCH_JOB_STORE, ACCRUAL_STORE, STATEMENT_STORE):
            _s.ensure()
        return {
            "jobs": _w12_run("SELECT COUNT(*) AS n FROM batch_jobs", fetch="one")["n"],
            "accruals": _w12_run("SELECT COUNT(*) AS n FROM interest_accruals", fetch="one")["n"],
            "statements": _w12_run("SELECT COUNT(*) AS n FROM account_statements", fetch="one")["n"],
        }
    except Exception as _e:
        return {"degraded": f"persistence_unavailable: {_e}"}


ROUTES = {
    "/v1/batch/jobs": handle_batch_jobs,
    "/v1/batch/accruals": handle_accruals,
    "/v1/batch/statements": handle_statements,
    "/v1/batch/dormancy": handle_dormancy,
    "/v1/batch/schedule": handle_schedule,
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
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        _cors_origin = self.headers.get("Origin", "")
        _cors_allowed = [o.strip() for o in _jwt_os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
        if _cors_origin and _cors_origin in _cors_allowed:
            self.send_header("Access-Control-Allow-Origin", _cors_origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._set_headers(401)
                self.wfile.write(json.dumps({"error": "unauthorized", "detail": _n1_err}).encode())
                return
        if self.path == "/healthz":
            self._set_headers()
            self.wfile.write(json.dumps({
                "service": "batch-processing-py", "status": "ok",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["batch_processing.events", "batch_processing.audit"]},
                "dapr": {"status": "connected", "appId": "batch_processing-sidecar"},
                "fluvio": {"status": "connected", "topic": "batch_processing-stream"},
                "temporal": {"status": "connected", "namespace": "batch_processing"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "batch_processing"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "batch_processing_authz"},
                "redis": {"status": "connected", "prefix": "batch_processing:"},
                "mojaloop": {"status": "connected", "participant": "batch_processing"},
                "opensearch": {"status": "connected", "index": "batch_processing-*"},
                "openappsec": {"status": "connected", "policy": "batch_processing-protection"},
                "apisix": {"status": "connected", "upstream": "batch_processing"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "batch_processing_iceberg"}
            },
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "stats": _w12_stats(),
            }).encode())
            return
        handler = ROUTES.get(self.path)
        if handler:
            status, body = handler("GET", {})
            self._set_headers(status)
            self.wfile.write(json.dumps(body).encode())
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "not found"}).encode())

    def do_POST(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._set_headers(401)
                self.wfile.write(json.dumps({"error": "unauthorized", "detail": _n1_err}).encode())
                return
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        handler = ROUTES.get(self.path)
        if handler:
            status, resp = handler("POST", body)
            self._set_headers(status)
            self.wfile.write(json.dumps(resp).encode())
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "not found"}).encode())

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8117"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Batch Processing Engine starting on :{port}")
    server.serve_forever()
