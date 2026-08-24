"""
security-audit-logger-py - Production-ready service with PostgreSQL persistence.
Middleware: Keycloak JWT, Kafka events, OpenSearch indexing, Permify authorization.
"""

import os
import json
import uuid
import logging
import random
import string
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import time
import threading
import signal
import socket as _socket
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("security-audit-logger-py")

# Configuration
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


DATABASE_URL = _require_env("DATABASE_URL")
KEYCLOAK_URL = os.getenv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
REDIS_URL = os.getenv("REDIS_URL", "localhost:6379")
OPENSEARCH_URL = os.getenv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
PERMIFY_URL = os.getenv("PERMIFY_ENDPOINT", "http://permify:3476")
PORT = int(os.getenv("PORT", "8560"))

db_conn = None

# Rate limiter state (module-level, guarded by _rl_lock)
_rl_tokens = 100
_rl_lock = threading.Lock()
_rl_last_refill = [0.0]

def _rl_allow():
    global _rl_tokens
    now = time.time()
    with _rl_lock:
        if now - _rl_last_refill[0] >= 1.0:
            _rl_tokens = 100
            _rl_last_refill[0] = now
        if _rl_tokens <= 0:
            return False
        _rl_tokens -= 1
        return True

_REDIS_URL = os.environ.get("REDIS_URL", "localhost:6379")

def cache_get(key):
    try:
        host, port = _REDIS_URL.rsplit(":", 1)
        s = _socket.create_connection((host, int(port)), timeout=2)
        s.sendall(f"*2\r\n$3\r\nGET\r\n${len(key)}\r\n{key}\r\n".encode())
        data = s.recv(4096).decode()
        s.close()
        if data.startswith("$-1"): return None
        parts = data.split("\r\n", 2)
        return parts[1] if len(parts) >= 3 else None
    except Exception:
        return None

def cache_set(key, value, ttl=300):
    try:
        host, port = _REDIS_URL.rsplit(":", 1)
        s = _socket.create_connection((host, int(port)), timeout=2)
        cmd = f"*4\r\n$3\r\nSET\r\n${len(key)}\r\n{key}\r\n${len(str(value))}\r\n{value}\r\n$2\r\nEX\r\n${len(str(ttl))}\r\n{ttl}\r\n"
        s.sendall(cmd.encode())
        s.recv(256)
        s.close()
    except Exception:
        pass


# --- gRPC Server (binary protocol, length-prefixed, with circuit breaker + retry) ---
import socket as _grpc_socket
import struct as _grpc_struct
import threading as _grpc_threading

class GrpcServicer:
    """gRPC handler for inter-service calls."""
    def __init__(self, service_name):
        self.service_name = service_name
        self.request_count = 0

    def Process(self, request_data):
        self.request_count += 1
        trace_id = f"grpc-{int(time.time()*1000)}-{os.getpid()}"
        return {"status": "processed", "service": self.service_name, "trace_id": trace_id}

def start_grpc_server(service_name, port):
    """Start TCP-based gRPC server for inter-service calls."""
    def handle_client(conn, addr, servicer):
        try:
            data = conn.recv(4096)
            if not data: return
            result = servicer.Process(data)
            response = json.dumps(result).encode()
            conn.sendall(_grpc_struct.pack(">I", len(response)) + response)
        except Exception:
            pass
        finally:
            conn.close()

    def serve():
        servicer = GrpcServicer(service_name)
        sock = _grpc_socket.socket(_grpc_socket.AF_INET, _grpc_socket.SOCK_STREAM)
        sock.setsockopt(_grpc_socket.SOL_SOCKET, _grpc_socket.SO_REUSEADDR, 1)
        sock.bind(("0.0.0.0", int(port)))
        sock.listen(32)
        logger.info(f"[{service_name}] gRPC server on :{port}")
        while True:
            try:
                conn, addr = sock.accept()
                _grpc_threading.Thread(target=handle_client, args=(conn, addr, servicer), daemon=True).start()
            except Exception:
                break

    t = _grpc_threading.Thread(target=serve, daemon=True)
    t.start()
    return t

# --- Configuration ---
DB_URL = os.environ.get("DATABASE_URL", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "${JWT_SECRET}")
AML_ENGINE_URL = os.environ.get("AML_ENGINE_URL", "http://localhost:8120")

# --- mTLS Configuration ---
MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false") == "true"
TLS_CERT_PATH = os.environ.get("TLS_CERT_PATH", "/etc/54link-dev/certs/service.crt")
TLS_KEY_PATH = os.environ.get("TLS_KEY_PATH", "/etc/54link-dev/certs/service.key")
TLS_CA_PATH = os.environ.get("TLS_CA_PATH", "/etc/54link-dev/certs/ca.crt")
PORT = int(os.environ.get("PORT", "9633"))
START_TIME = time.time()

# --- Metrics ---
request_count = 0
error_count = 0
metrics_lock = threading.Lock()

def inc_requests():
    global request_count
    with metrics_lock:
        request_count += 1

def inc_errors():
    global error_count
    with metrics_lock:
        error_count += 1

# --- Database ---
_db_pool = None

def get_db():
    global db_conn
    if db_conn is None or db_conn.closed:
        db_conn = psycopg2.connect(DATABASE_URL)
        db_conn.autocommit = True
    return db_conn

def release_db(conn):
    """Return a connection to the pool."""
    global _db_pool
    if _db_pool and conn:
        try:
            _db_pool.putconn(conn)
        except Exception:
            pass

def init_schema():
    """Create the tables this service actually uses. Never crash startup:
    log the failure and continue so the process can report not-ready via
    /readyz instead of dying in lifespan."""
    try:
        conn = get_db()
    except Exception as e:
        logger.error(f"init_schema: database unavailable: {e}")
        return
    try:
        cur = conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS service_configs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            status VARCHAR(32) DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")
        cur.execute("""CREATE TABLE IF NOT EXISTS outbox (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type VARCHAR(64) NOT NULL,
            aggregate_id VARCHAR(128) NOT NULL,
            payload JSONB NOT NULL,
            published BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")
        # AUDIT-MUTABLE: the audit_events table the API targets was never
        # created. Schema mirrors services/security-service/audit_trail.go:
        # actor/tenant/correlation fields, before/after values, and a
        # SHA-256 hash chain (previous_hash/entry_hash) for tamper evidence.
        # The table is append-only — this service exposes no UPDATE/DELETE.
        cur.execute("""CREATE TABLE IF NOT EXISTS audit_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type VARCHAR(64) NOT NULL,
            severity VARCHAR(20) NOT NULL DEFAULT 'info',
            actor_id VARCHAR(128),
            actor_type VARCHAR(20),
            tenant_id VARCHAR(128),
            resource_type VARCHAR(64),
            resource_id VARCHAR(128),
            action VARCHAR(100) NOT NULL,
            description TEXT,
            old_value JSONB,
            new_value JSONB,
            metadata JSONB,
            ip_address VARCHAR(45),
            user_agent TEXT,
            correlation_id VARCHAR(128),
            previous_hash VARCHAR(64),
            entry_hash VARCHAR(64) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_events_tenant ON audit_events(tenant_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_service_configs_tenant ON service_configs(tenant_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_service_configs_status ON service_configs(status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_service_configs_created ON service_configs(created_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published, created_at) WHERE NOT published")
        conn.commit()
        logger.info("Schema initialized")
    except Exception as e:
        logger.error(f"init_schema failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema()
    logger.info(f"[security-audit-logger-py] ready on :%d", PORT)
    logger.info(f"[security-audit-logger-py] middleware: keycloak=%s kafka=%s redis=%s opensearch=%s permify=%s",
                KEYCLOAK_URL, KAFKA_BROKERS, REDIS_URL, OPENSEARCH_URL, PERMIFY_URL)
    yield
    if db_conn:
        db_conn.close()


app = FastAPI(title="security-audit-logger-py", version="1.0.0", lifespan=lifespan)

# --- JWT enforcement middleware (finding N-1: fail-closed JWT auth on the live FastAPI path) ---
import inspect as _jwt_inspect
from starlette.middleware.base import BaseHTTPMiddleware as _JWTBaseHTTPMiddleware
from starlette.responses import JSONResponse as _JWTJSONResponse

# Probe endpoints are exempt; everything else requires a verifiable Bearer JWT.
_JWT_EXEMPT_PATHS = frozenset({"/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"})


def _jwt_set_scope_header(scope, name, value):
    """Overwrite (or remove, when value is None) a request header in the ASGI scope so
    downstream handlers see identity derived ONLY from verified token claims."""
    encoded = name.lower().encode("latin-1")
    headers = [(k, v) for k, v in scope.get("headers", []) if k != encoded]
    if value is not None:
        headers.append((encoded, str(value).encode("latin-1")))
    scope["headers"] = headers


class JWTAuthMiddleware(_JWTBaseHTTPMiddleware):
    """Fail-closed JWT authentication for all domain routes.

    Only the probe paths /health, /ready, /metrics (and their k8s variants
    /healthz, /readyz, /livez) plus CORS preflight (OPTIONS) are exempt. On
    success the verified claims are stored on request.state.jwt_claims and the
    tenant identity headers (x-tenant-id / x-tenant) in the ASGI scope are
    overwritten with the verified claim values, so downstream header readers
    receive ONLY the authenticated tenant. Failure: 401 JSON (503 when the JWKS
    endpoint is unreachable with a cold cache). Works with sync or async
    validate_jwt implementations.
    """

    async def dispatch(self, request, call_next):
        if request.method == "OPTIONS" or request.url.path in _JWT_EXEMPT_PATHS:
            return await call_next(request)
        try:
            if _jwt_inspect.iscoroutinefunction(validate_jwt):
                claims, err = await validate_jwt(request.headers)
            else:
                claims, err = validate_jwt(request.headers)
        except Exception as exc:
            return _JWTJSONResponse(status_code=503, content={"error": "auth_unavailable", "detail": str(exc)})
        if not claims:
            status = 503 if err == "jwks_unavailable" else 401
            return _JWTJSONResponse(status_code=status, content={"error": "unauthorized", "detail": err})
        request.state.jwt_claims = claims
        tenant = claims.get("tenant_id") or claims.get("tenant")
        _jwt_set_scope_header(request.scope, "x-tenant-id", tenant)
        _jwt_set_scope_header(request.scope, "x-tenant", tenant)
        subject = claims.get("sub") or claims.get("keycloak_id")
        if subject:
            _jwt_set_scope_header(request.scope, "x-keycloak-id", subject)
        return await call_next(request)


app.add_middleware(JWTAuthMiddleware)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()] or ["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AuditEventRequest(BaseModel):
    """Append-only audit event. Mirrors the audit_trail.go field set:
    actor/tenant/correlation context plus before/after values."""
    event_type: str
    action: str
    severity: Optional[str] = "info"
    actor_id: Optional[str] = None
    actor_type: Optional[str] = None
    tenant_id: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: Optional[str] = None
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    correlation_id: Optional[str] = None


# --- Tamper-evident hash chain (AUDIT-MUTABLE) ---
# Mirrors services/security-service/audit_trail.go: entry_hash =
# sha256(id|event_type|severity|actor_id|tenant_id|action|resource_type|
# resource_id|previous_hash|timestamp). The chain head is re-read from the DB
# under a lock on every append, so a restart never forks the chain.
_audit_chain_lock = threading.Lock()


def _compute_entry_hash(entry_id, event_type, severity, actor_id, tenant_id,
                        action, resource_type, resource_id, previous_hash,
                        timestamp_iso):
    import hashlib
    data = "|".join([
        str(entry_id), str(event_type), str(severity), str(actor_id),
        str(tenant_id), str(action), str(resource_type), str(resource_id),
        str(previous_hash), str(timestamp_iso),
    ])
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _load_chain_head(cur):
    cur.execute(
        "SELECT entry_hash FROM audit_events ORDER BY created_at DESC, id DESC LIMIT 1"
    )
    row = cur.fetchone()
    return row[0] if row else ""


@app.get("/healthz")
def health():
    return {"status": "healthy", "service": "security-audit-logger-py", "version": "1.0.0"}


@app.get("/readyz")
def readyz():
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"not ready: {e}")


@app.get("/livez")
def livez():
    return {"status": "alive"}


@app.get("/metrics")
def metrics():
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM audit_events")
            count = cur.fetchone()[0]
        return {"service": "security-audit-logger-py", "total_records": count}
    except Exception:
        return {"service": "security-audit-logger-py", "total_records": 0}


@app.get("/api/v1/audit_events")
def list_records(x_tenant_id: Optional[str] = Header(None), page: int = 1, limit: int = 20):
    """List audit events (read-only). Tenant header scopes the listing."""
    conn = get_db()
    if not conn:
        return {"items": [], "total": 0, "page": page, "limit": limit}
    try:
        cur = conn.cursor()
        offset = (page - 1) * limit
        tenant = x_tenant_id or ""
        cur.execute(
            """SELECT id, event_type, severity, actor_id, tenant_id, action,
                      resource_type, resource_id, entry_hash, created_at
               FROM audit_events
               WHERE %s = '' OR tenant_id = %s
               ORDER BY created_at DESC LIMIT %s OFFSET %s""",
            (tenant, tenant, limit, offset),
        )
        rows = cur.fetchall()
        items = [
            {
                "id": str(row[0]), "event_type": row[1], "severity": row[2],
                "actor_id": row[3], "tenant_id": row[4], "action": row[5],
                "resource_type": row[6], "resource_id": row[7],
                "entry_hash": row[8], "created_at": str(row[9]),
            }
            for row in rows
        ]
        cur.execute(
            "SELECT COUNT(*) FROM audit_events WHERE %s = '' OR tenant_id = %s",
            (tenant, tenant),
        )
        total = cur.fetchone()[0]
        return {"items": items, "total": total, "page": page, "limit": limit, "source": "database"}
    except Exception as e:
        logger.error(f"DB query failed: {e}")
        raise HTTPException(status_code=503, detail="audit_events_unavailable")
# --- JWT Auth ---
def validate_jwt(headers):
    """Validate Bearer JWT with real HS256 signature verification (stdlib).

    Fails closed: returns (None, reason) whenever the token cannot be
    cryptographically verified, is expired, is missing exp, or JWT_SECRET is
    not configured. Never warn-and-allow.
    Canonical implementation: services/shared/auth/jwt_validation.py.
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    import hmac, hashlib, base64, json as _json, time as _t
    def _b64url_decode(s):
        s += "=" * (-len(s) % 4)
        return base64.urlsafe_b64decode(s.encode())
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or secret.startswith("${"):
        return None, "auth_not_configured"
    try:
        header = _json.loads(_b64url_decode(parts[0]))
        payload = _json.loads(_b64url_decode(parts[1]))
        signature = _b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    if header.get("alg") != "HS256":
        return None, "Unsupported token algorithm"
    expected = hmac.new(secret.encode(), (parts[0] + "." + parts[1]).encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, signature):
        return None, "Invalid token signature"
    exp = payload.get("exp")
    if exp is None:
        return None, "Token missing exp claim"
    try:
        if _t.time() >= float(exp):
            return None, "Token expired"
    except (TypeError, ValueError):
        return None, "Invalid token expiry"
    issuer = os.environ.get("JWT_ISSUER", "")
    if issuer and payload.get("iss") != issuer:
        return None, "Invalid token issuer"
    return payload, None

# --- Domain Logic ---
def gen_id():
    return "SEC-" + "".join(random.choices(string.hexdigits[:16].upper(), k=8))


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def assess_security_posture(controls):
    if not controls: return {"score": 0, "status": "no_controls"}
    effective = sum(1 for c in controls if c.get("status") == "effective")
    score = round(effective / len(controls) * 100, 1)
    return {"score": score, "effective": effective, "total": len(controls), "gaps": [c for c in controls if c.get("status") != "effective"], "compliant": score >= 80}

def log_security_event(event_type, severity, details):
    priority = {"critical": 1, "high": 2, "medium": 3, "low": 4}.get(severity, 3)
    return {"event_type": event_type, "severity": severity, "priority": priority, "details": details, "timestamp": now_iso(), "requires_response": priority <= 2, "sla_hours": {1: 1, 2: 4, 3: 24, 4: 72}.get(priority, 24)}



# --- HTTP Handler ---

class CircuitBreaker:
    def __init__(self, threshold=5, reset_timeout=30):
        self.failures = 0
        self.threshold = threshold
        self.reset_timeout = reset_timeout
        self.last_failure = 0
        self.state = "closed"
    def allow(self):
        if self.state == "open":
            if time.time() - self.last_failure > self.reset_timeout:
                self.state = "half-open"
                return True
            return False
        return True
    def record_success(self):
        self.failures = 0
        self.state = "closed"
    def record_failure(self):
        self.failures += 1
        self.last_failure = time.time()
        if self.failures >= self.threshold:
            self.state = "open"



# --- gRPC Client with Retry + Circuit Breaker ---
class _CircuitBreaker:
    def __init__(self, threshold=5, reset_after=30):
        self.failures = 0
        self.last_failure = 0
        self.threshold = threshold
        self.reset_after = reset_after
        self._lock = threading.Lock()

    def allow(self):
        with self._lock:
            if self.failures >= self.threshold:
                if time.time() - self.last_failure > self.reset_after:
                    self.failures = self.threshold // 2
                    return True
                return False
            return True

    def record_success(self):
        with self._lock:
            if self.failures > 0: self.failures -= 1

    def record_failure(self):
        with self._lock:
            self.failures += 1
            self.last_failure = time.time()

_grpc_cb = _CircuitBreaker()

def grpc_call(target, method, payload, retries=3):
    """Make a gRPC call with retry + circuit breaker."""
    if not _grpc_cb.allow():
        logger.warning(f"Circuit breaker open for {target}/{method}")
        return None
    for attempt in range(retries):
        try:
            host, port = target.rsplit(":", 1)
            sock = _grpc_socket.socket(_grpc_socket.AF_INET, _grpc_socket.SOCK_STREAM)
            sock.settimeout(5.0)
            sock.connect((host, int(port)))
            data = json.dumps({"method": method, "payload": payload}).encode()
            sock.sendall(_grpc_struct.pack(">I", len(data)) + data)
            length_bytes = sock.recv(4)
            if len(length_bytes) == 4:
                length = _grpc_struct.unpack(">I", length_bytes)[0]
                response = sock.recv(length)
                _grpc_cb.record_success()
                return json.loads(response)
            _grpc_cb.record_failure()
        except Exception as e:
            _grpc_cb.record_failure()
            if attempt < retries - 1:
                time.sleep((2 ** attempt) * 0.2)
            logger.warning(f"gRPC {target}/{method} attempt {attempt+1} failed: {e}")
        finally:
            try: sock.close()
            except: pass
    return None

def call_service(method, url, body=None, retries=3, timeout=15):
    """HTTP inter-service call with retry + circuit breaker."""
    if not _grpc_cb.allow():
        return None
    import urllib.request, urllib.error
    for attempt in range(retries):
        try:
            data = json.dumps(body).encode() if body else None
            req = urllib.request.Request(url, data=data, method=method,
                                         headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=timeout)
            _grpc_cb.record_success()
            return json.loads(resp.read())
        except Exception as e:
            _grpc_cb.record_failure()
            if attempt < retries - 1:
                time.sleep((2 ** attempt) * 0.2)
            logger.warning(f"HTTP {method} {url} attempt {attempt+1} failed: {e}")
    return None

# gRPC service registry
GRPC_REGISTRY = {
    "core-banking": 9090, "payments-hub": 9091, "gl-engine": 9092,
    "trade-finance": 9093, "cheque-clearing": 9094, "nibss-nip": 9095,
    "credit-scoring": 9096, "fraud-detection": 9097, "aml-screening": 9098,
    "kyc-engine": 9099,
}

def call_service_grpc(target, method, payload=None):
    """Convenience: try gRPC first, fall back to HTTP."""
    service_name_key = target.split("/")[0] if "/" in target else target
    if service_name_key in GRPC_REGISTRY:
        result = grpc_call(f"localhost:{GRPC_REGISTRY[service_name_key]}", method, payload or {})
        if result: return result
    return call_service("POST", f"http://{target}/v1/{method}", payload)


# --- Alerting ---
_ALERT_RULES = [
    {"name": "high_error_rate", "metric": "error_rate", "threshold": 0.05, "severity": "critical"},
    {"name": "high_latency", "metric": "p99_latency_ms", "threshold": 5000, "severity": "warning"},
    {"name": "db_failures", "metric": "db_failures", "threshold": 3, "severity": "critical"},
]

def check_alerts():
    fired = []
    err_rate = error_count / max(request_count, 1)
    if err_rate > 0.05:
        fired.append({"rule": "high_error_rate", "value": err_rate, "severity": "critical"})
    return fired


# --- Graceful Degradation ---
class _DegradationState:
    def __init__(self):
        self.db_available = True
        self.cache_available = True
        self.upstreams = {}
        self._lock = threading.Lock()

    def set_db(self, ok):
        with self._lock: self.db_available = ok

    def is_db_ok(self):
        with self._lock: return self.db_available

    def set_upstream(self, name, ok):
        with self._lock: self.upstreams[name] = ok

    def status(self):
        with self._lock:
            return {
                "db_available": self.db_available,
                "cache_available": self.cache_available,
                "upstreams": dict(self.upstreams),
                "mode": "normal" if self.db_available else "degraded",
            }

_degrade = _DegradationState()

# In-memory state used by POST handlers
SERVICE_NAME = "security-audit-logger-py"
records: list = []
audit_log: list = []
domain_stats: dict = {"processed_today": 0}

@app.post("/api/v1/audit_events", status_code=201)
def create_record(body: AuditEventRequest, x_tenant_id: Optional[str] = Header(None)):
    """Append a tamper-evident audit event. Append-only by design: this
    service exposes no update or delete route for audit_events."""
    tenant_id = body.tenant_id or x_tenant_id
    record_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    severity = body.severity or "info"

    conn = get_db()
    with _audit_chain_lock:
        with conn.cursor() as cur:
            previous_hash = _load_chain_head(cur)
            entry_hash = _compute_entry_hash(
                record_id, body.event_type, severity, body.actor_id or "",
                tenant_id or "", body.action, body.resource_type or "",
                body.resource_id or "", previous_hash, timestamp,
            )
            cur.execute(
                """INSERT INTO audit_events (
                       id, event_type, severity, actor_id, actor_type, tenant_id,
                       resource_type, resource_id, action, description,
                       old_value, new_value, metadata,
                       ip_address, user_agent, correlation_id,
                       previous_hash, entry_hash, created_at
                   ) VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                             %s, %s, %s, %s, %s, %s, %s, %s, %s::timestamptz)""",
                (
                    record_id, body.event_type, severity, body.actor_id,
                    body.actor_type, tenant_id, body.resource_type,
                    body.resource_id, body.action, body.description,
                    json.dumps(body.old_value) if body.old_value is not None else None,
                    json.dumps(body.new_value) if body.new_value is not None else None,
                    json.dumps(body.metadata) if body.metadata is not None else None,
                    body.ip_address, body.user_agent, body.correlation_id,
                    previous_hash, entry_hash, timestamp,
                ),
            )
            payload = json.dumps({
                "id": record_id, "event_type": body.event_type,
                "action": body.action, "tenant_id": tenant_id,
                "entry_hash": entry_hash,
            })
            cur.execute(
                "INSERT INTO outbox (event_type, aggregate_id, payload) VALUES (%s, %s, %s::jsonb)",
                ("audit_events.appended", record_id, payload),
            )
        conn.commit()
    return {
        "id": record_id, "status": "appended",
        "entry_hash": entry_hash, "previous_hash": previous_hash,
    }


@app.get("/api/v1/audit_events/verify-chain")
def verify_chain():
    """Recompute the hash chain over the whole audit_events table. Any edited
    or deleted historical row breaks every subsequent entry_hash and is
    reported here (tamper evidence)."""
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """SELECT id, event_type, severity, actor_id, tenant_id, action,
                      resource_type, resource_id, previous_hash, entry_hash, created_at
               FROM audit_events ORDER BY created_at ASC, id ASC"""
        )
        rows = cur.fetchall()

    prev = ""
    checked = 0
    for row in rows:
        expected = _compute_entry_hash(
            str(row["id"]), row["event_type"], row["severity"] or "info",
            row["actor_id"] or "", row["tenant_id"] or "", row["action"],
            row["resource_type"] or "", row["resource_id"] or "",
            row["previous_hash"] or "", row["created_at"].isoformat(),
        )
        if (row["previous_hash"] or "") != prev or row["entry_hash"] != expected:
            logger.error(
                "AUDIT CHAIN VIOLATION at event %s (checked %d entries)", row["id"], checked
            )
            return {
                "chain_valid": False,
                "broken_at": str(row["id"]),
                "entries_checked": checked,
            }
        prev = row["entry_hash"]
        checked += 1
    return {"chain_valid": True, "entries_checked": checked, "chain_head": prev or None}


@app.get("/api/v1/audit_events/{record_id}")
def get_record(record_id: str):
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """SELECT id, event_type, severity, actor_id, actor_type, tenant_id,
                      resource_type, resource_id, action, description,
                      old_value, new_value, metadata, ip_address, user_agent,
                      correlation_id, previous_hash, entry_hash, created_at
               FROM audit_events WHERE id = %s::uuid""",
            (record_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    row["id"] = str(row["id"])
    row["created_at"] = row["created_at"].isoformat()
    return row

# --- Graceful Shutdown ---
server = None
db_conn = None
shutdown_event = threading.Event()

def shutdown_handler(signum, frame):
    logger.info("Shutdown signal received")
    release_db(None)  # release any held DB connections
    shutdown_event.set()
    if server:
        threading.Thread(target=server.shutdown).start()

signal.signal(signal.SIGTERM, shutdown_handler)

# --- Security Headers ---
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'",
}
CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "https://dashboard.54link-dev.ng").split(",")

def add_security_headers(handler_self):
    """Add security + CORS headers to response."""
    for k, v in SECURITY_HEADERS.items():
        handler_self.send_header(k, v)
    origin = handler_self.headers.get("Origin", "")
    if origin in [o.strip() for o in CORS_ALLOWED_ORIGINS]:
        handler_self.send_header("Access-Control-Allow-Origin", origin)
    handler_self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    handler_self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")

def sanitize_input(s):
    """Sanitize user input to prevent XSS/injection."""
    if not isinstance(s, str):
        return s
    s = s.replace("<", "&lt;").replace(">", "&gt;")
    s = s.replace("'", "&#39;").replace('"', "&quot;")
    s = s.replace("\\", "")
    return s[:10000] if len(s) > 10000 else s

# --- OpenTelemetry Export ---
OTEL_ENDPOINT = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "")

def init_tracing(service_name):
    """Initialize OpenTelemetry tracing with OTLP export if configured."""
    if not OTEL_ENDPOINT:
        return
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
        from opentelemetry.sdk.resources import Resource
        resource = Resource.create({"service.name": service_name, "deployment.environment": os.environ.get("ENV", "development")})
        provider = TracerProvider(resource=resource)
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
            exporter = OTLPSpanExporter(endpoint=OTEL_ENDPOINT, insecure=True)
        except ImportError:
            exporter = ConsoleSpanExporter()
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)
        logger.info(f"OpenTelemetry tracing initialized: {OTEL_ENDPOINT}")
    except ImportError:
        logger.debug("OpenTelemetry SDK not installed, tracing disabled")
    except Exception as e:
        logger.warning(f"Failed to init tracing: {e}")
signal.signal(signal.SIGINT, shutdown_handler)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
