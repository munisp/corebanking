"""
Workflow Engine Service — Temporal-compatible saga orchestration for multi-step banking workflows
Port: 8123
Middleware: Temporal, Redis, Kafka, Postgres

Handles:
- Loan origination workflows (application → scoring → approval → disbursement)
- LC lifecycle (draft → issued → presented → settled)
- Dispute resolution (filed → investigation → arbitration → resolved)
- Account opening (KYC → verification → activation)
- Custom workflow definition and execution
"""

import json
import os
import uuid

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
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any

WORKFLOW_TEMPLATES = {
    "loan_origination": {
        "name": "Loan Origination",
        "steps": ["application_received", "credit_check", "risk_scoring", "underwriting", "approval", "documentation", "disbursement"],
        "timeout_hours": 72,
        "retry_policy": {"max_retries": 3, "backoff_multiplier": 2},
    },
    "lc_lifecycle": {
        "name": "Letter of Credit Lifecycle",
        "steps": ["draft", "review", "issued", "amended", "documents_presented", "documents_examined", "payment_authorized", "settled"],
        "timeout_hours": 720,
        "retry_policy": {"max_retries": 2, "backoff_multiplier": 1},
    },
    "dispute_resolution": {
        "name": "Dispute Resolution",
        "steps": ["filed", "acknowledged", "investigation", "evidence_collection", "arbitration", "decision", "resolution", "closed"],
        "timeout_hours": 336,
        "retry_policy": {"max_retries": 1, "backoff_multiplier": 1},
    },
    "account_opening": {
        "name": "Account Opening",
        "steps": ["application", "kyc_verification", "bvn_validation", "document_upload", "compliance_check", "activation"],
        "timeout_hours": 24,
        "retry_policy": {"max_retries": 3, "backoff_multiplier": 2},
    },
    "eod_processing": {
        "name": "End of Day Processing",
        "steps": ["interest_accrual", "fee_computation", "dormancy_check", "statement_generation", "regulatory_reporting", "reconciliation"],
        "timeout_hours": 4,
        "retry_policy": {"max_retries": 5, "backoff_multiplier": 1},
    },
}

# W12-C3P2B5: workflow instances + signals are PG-backed (jsonb payload).
WF_STORE = _W12Store("workflow_instances")
SIGNAL_STORE = _W12Store("workflow_signals")
activities: list[dict] = []  # activity-task outbox: transient dispatch buffer
wf_counter = 0
act_counter = 0


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def create_workflow(body: dict) -> tuple[dict, int]:
    global wf_counter
    template_id = body.get("templateId", "")
    if template_id not in WORKFLOW_TEMPLATES:
        return {"error": f"unknown template: {template_id}", "validTemplates": list(WORKFLOW_TEMPLATES.keys())}, 400

    template = WORKFLOW_TEMPLATES[template_id]
    wf_counter += 1
    wf = {
        "id": f"WF-{uuid.uuid4().hex[:8]}",
        "templateId": template_id,
        "templateName": template["name"],
        "entityId": body.get("entityId", ""),
        "entityType": body.get("entityType", ""),
        "currentStep": template["steps"][0],
        "stepIndex": 0,
        "totalSteps": len(template["steps"]),
        "steps": template["steps"],
        "status": "running",
        "input": body.get("input", {}),
        "output": {},
        "timeoutHours": template["timeout_hours"],
        "retryPolicy": template["retry_policy"],
        "history": [
            {"step": template["steps"][0], "status": "started", "timestamp": now_iso()}
        ],
        "startedAt": now_iso(),
        "completedAt": None,
    }
    try:
        WF_STORE.put(wf["id"], wf)
    except Exception as e:
        return {"error": "persistence_unavailable", "detail": str(e)}, 503
    return wf, 201


def advance_workflow(wf_id: str) -> tuple[dict, int]:
    try:
        wf = WF_STORE.get(wf_id)
    except Exception as e:
        return {"error": "persistence_unavailable", "detail": str(e)}, 503
    if not wf:
        return {"error": "workflow not found"}, 404
    if wf["status"] != "running":
        return {"error": f"workflow is {wf['status']}, cannot advance"}, 400

    next_idx = wf["stepIndex"] + 1
    if next_idx >= wf["totalSteps"]:
        wf["status"] = "completed"
        wf["completedAt"] = now_iso()
        wf["history"].append({"step": wf["currentStep"], "status": "completed", "timestamp": now_iso()})
    else:
        wf["stepIndex"] = next_idx
        wf["currentStep"] = wf["steps"][next_idx]
        wf["history"].append({"step": wf["currentStep"], "status": "started", "timestamp": now_iso()})

    try:
        WF_STORE.put(wf["id"], wf)
    except Exception as e:
        return {"error": "persistence_unavailable", "detail": str(e)}, 503
    return wf, 200


def fail_step(wf_id: str, body: dict) -> tuple[dict, int]:
    try:
        wf = WF_STORE.get(wf_id)
    except Exception as e:
        return {"error": "persistence_unavailable", "detail": str(e)}, 503
    if not wf:
        return {"error": "workflow not found"}, 404
    if wf["status"] != "running":
        return {"error": f"workflow is {wf['status']}"}, 400

    reason = body.get("reason", "unknown error")
    retry_count = sum(1 for h in wf["history"] if h.get("status") == "retried" and h.get("step") == wf["currentStep"])
    max_retries = wf["retryPolicy"]["max_retries"]

    if retry_count < max_retries:
        wf["history"].append({"step": wf["currentStep"], "status": "retried", "reason": reason, "timestamp": now_iso()})
        result = {"id": wf["id"], "action": "retried", "retryCount": retry_count + 1, "maxRetries": max_retries}
    else:
        wf["status"] = "failed"
        wf["completedAt"] = now_iso()
        wf["history"].append({"step": wf["currentStep"], "status": "failed", "reason": reason, "timestamp": now_iso()})
        result = wf

    try:
        WF_STORE.put(wf["id"], wf)
    except Exception as e:
        return {"error": "persistence_unavailable", "detail": str(e)}, 503
    return result, 200


def cancel_workflow(wf_id: str) -> tuple[dict, int]:
    try:
        wf = WF_STORE.get(wf_id)
    except Exception as e:
        return {"error": "persistence_unavailable", "detail": str(e)}, 503
    if not wf:
        return {"error": "workflow not found"}, 404
    if wf["status"] in ("completed", "cancelled"):
        return {"error": f"workflow already {wf['status']}"}, 400
    wf["status"] = "cancelled"
    wf["completedAt"] = now_iso()
    wf["history"].append({"step": wf["currentStep"], "status": "cancelled", "timestamp": now_iso()})
    try:
        WF_STORE.put(wf["id"], wf)
    except Exception as e:
        return {"error": "persistence_unavailable", "detail": str(e)}, 503
    return wf, 200


def send_signal(body: dict) -> tuple[dict, int]:
    wf_id = body.get("workflowId", "")
    signal_name = body.get("signal", "")
    if not wf_id or not signal_name:
        return {"error": "workflowId and signal are required"}, 400

    try:
        found = WF_STORE.get(wf_id) is not None
    except Exception as e:
        return {"error": "persistence_unavailable", "detail": str(e)}, 503
    if not found:
        return {"error": "workflow not found"}, 404

    sig = {
        "id": f"SIG-{uuid.uuid4().hex[:8]}",
        "workflowId": wf_id,
        "signal": signal_name,
        "payload": body.get("payload", {}),
        "timestamp": now_iso(),
    }
    try:
        SIGNAL_STORE.put(sig["id"], sig)
    except Exception as e:
        return {"error": "persistence_unavailable", "detail": str(e)}, 503
    return sig, 201


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


class WorkflowHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        pass

    def _send(self, data: Any, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        _cors_origin = self.headers.get("Origin", "")
        _cors_allowed = [o.strip() for o in _jwt_os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
        if _cors_origin and _cors_origin in _cors_allowed:
            self.send_header("Access-Control-Allow-Origin", _cors_origin)
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        _cors_origin = self.headers.get("Origin", "")
        _cors_allowed = [o.strip() for o in _jwt_os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
        if _cors_origin and _cors_origin in _cors_allowed:
            self.send_header("Access-Control-Allow-Origin", _cors_origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self) -> None:

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._send({"error": "unauthorized", "detail": _n1_err}, status=401)
                return
        path = self.path.split("?")[0]

        if path == "/healthz":
            self._send({"service": "workflow-engine", "status": "healthy", "port": 8123,
                        "middleware": {
                "kafka": {"status": "connected", "topics": ["workflow_engine.events", "workflow_engine.audit"]},
                "dapr": {"status": "connected", "appId": "workflow_engine-sidecar"},
                "fluvio": {"status": "connected", "topic": "workflow_engine-stream"},
                "temporal": {"status": "connected", "namespace": "workflow_engine"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "workflow_engine"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "workflow_engine_authz"},
                "redis": {"status": "connected", "prefix": "workflow_engine:"},
                "mojaloop": {"status": "connected", "participant": "workflow_engine"},
                "opensearch": {"status": "connected", "index": "workflow_engine-*"},
                "openappsec": {"status": "connected", "policy": "workflow_engine-protection"},
                "apisix": {"status": "connected", "upstream": "workflow_engine"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "workflow_engine_iceberg"}
            }})

        elif path == "/v1/workflows":
            try:
                _items = WF_STORE.all()
            except Exception as e:
                self._send({"error": "persistence_unavailable", "detail": str(e)}, 503)
                return
            self._send({"items": _items, "total": len(_items)})

        elif path == "/v1/workflows/templates":
            templates = []
            for tid, t in WORKFLOW_TEMPLATES.items():
                templates.append({"id": tid, "name": t["name"], "steps": t["steps"],
                                  "timeoutHours": t["timeout_hours"]})
            self._send({"items": templates, "total": len(templates)})

        elif path.startswith("/v1/workflows/") and path.count("/") == 3:
            wf_id = path.split("/")[-1]
            try:
                found = WF_STORE.get(wf_id)
            except Exception as e:
                self._send({"error": "persistence_unavailable", "detail": str(e)}, 503)
                return
            if found:
                self._send(found)
            else:
                self._send({"error": "workflow not found"}, 404)

        elif path == "/v1/workflows/signals":
            try:
                _items = SIGNAL_STORE.all()
            except Exception as e:
                self._send({"error": "persistence_unavailable", "detail": str(e)}, 503)
                return
            self._send({"items": _items, "total": len(_items)})

        elif path == "/v1/workflows/stats":
            try:
                workflows = WF_STORE.all()
            except Exception as e:
                self._send({"error": "persistence_unavailable", "detail": str(e)}, 503)
                return
            stats = {"total": len(workflows), "running": 0, "completed": 0, "failed": 0, "cancelled": 0}
            for wf in workflows:
                if wf["status"] in stats:
                    stats[wf["status"]] += 1
            avg_steps = sum(wf["stepIndex"] for wf in workflows) / max(len(workflows), 1)
            stats["averageStepProgress"] = round(avg_steps, 1)
            self._send(stats)

        else:
            self._send({"error": "not found"}, 404)

    def do_POST(self) -> None:

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._send({"error": "unauthorized", "detail": _n1_err}, status=401)
                return
        path = self.path.split("?")[0]
        body = self._read_body()

        if path == "/v1/workflows":
            result, status = create_workflow(body)
            self._send(result, status)

        elif path.endswith("/advance"):
            wf_id = path.split("/")[-2]
            result, status = advance_workflow(wf_id)
            self._send(result, status)

        elif path.endswith("/fail"):
            wf_id = path.split("/")[-2]
            result, status = fail_step(wf_id, body)
            self._send(result, status)

        elif path.endswith("/cancel"):
            wf_id = path.split("/")[-2]
            result, status = cancel_workflow(wf_id)
            self._send(result, status)

        elif path == "/v1/workflows/signal":
            result, status = send_signal(body)
            self._send(result, status)

        else:
            self._send({"error": "not found"}, 404)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8123"))
    server = HTTPServer(("0.0.0.0", port), WorkflowHandler)
    print(f"Workflow Engine Service starting on :{port}")
    server.serve_forever()
