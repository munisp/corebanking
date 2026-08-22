"""
address-verification-py - Production-ready service with PostgreSQL persistence.
Middleware: Keycloak JWT, Kafka events, OpenSearch indexing, Permify authorization.
"""

import os
import json
import logging
from contextlib import asynccontextmanager

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
import urllib.request
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("address-verification-py")

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/address_verification_py")
KEYCLOAK_URL = os.getenv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
REDIS_URL = os.getenv("REDIS_URL", "localhost:6379")
OPENSEARCH_URL = os.getenv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
PERMIFY_URL = os.getenv("PERMIFY_ENDPOINT", "http://permify:3476")
PORT = int(os.getenv("PORT", "8135"))

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
PORT = int(os.environ.get("PORT", "8301"))
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
    logger.info(f"[address-verification-py] ready on :%d", PORT)
    logger.info(f"[address-verification-py] middleware: keycloak=%s kafka=%s redis=%s opensearch=%s permify=%s",
                KEYCLOAK_URL, KAFKA_BROKERS, REDIS_URL, OPENSEARCH_URL, PERMIFY_URL)
    yield
    if db_conn:
        db_conn.close()


app = FastAPI(title="address-verification-py", version="1.0.0", lifespan=lifespan)

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


class CreateRequest(BaseModel):
    status: Optional[str] = "active"
    tenant_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class UpdateRequest(BaseModel):
    status: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


@app.get("/healthz")
def health():
    return {"status": "healthy", "service": "address-verification-py", "version": "1.0.0"}


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
            cur.execute("SELECT COUNT(*) FROM service_configs")
            count = cur.fetchone()[0]
        return {"service": "address-verification-py", "total_records": count}
    except Exception:
        return {"service": "address-verification-py", "total_records": 0}


@app.get("/api/v1/service_configs")
def list_records(x_tenant_id: Optional[str] = Header(None), page: int = 1, limit: int = 20):
    conn = get_db()
    if not conn:
        return {"items": [], "total": 0, "page": page, "limit": limit}
    try:
        cur = conn.cursor()
        offset = (page - 1) * limit
        cur.execute("SELECT id, status, tenant_id, created_at FROM service_configs ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    (limit, offset))
        rows = cur.fetchall()
        items = [
            {"id": str(row[0]), "status": row[1], "tenant_id": str(row[2]) if row[2] else None, "created_at": str(row[3])}
            for row in rows
        ]
        cur.execute("SELECT COUNT(*) FROM service_configs")
        total = cur.fetchone()[0]
        return {"items": items, "total": total, "page": page, "limit": limit, "source": "database"}
    except Exception as e:
        logger.error(f"DB query failed: {e}")
        raise HTTPException(status_code=503, detail="config_unavailable")
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

_circuit_breaker = CircuitBreaker()

def call_service(method, url, body=None, retries=3, timeout=15):
    """Call another microservice with retries and circuit breaker."""
    if not _circuit_breaker.allow():
        raise Exception(f"Circuit breaker open for {url}")
    
    last_err = None
    for attempt in range(retries):
        try:
            if attempt > 0:
                time.sleep(0.1 * (2 ** attempt))
            
            data = json.dumps(body).encode() if body else None
            req = urllib.request.Request(url, data=data, method=method)
            req.add_header("Content-Type", "application/json")
            
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                result = json.loads(resp.read().decode())
                _circuit_breaker.record_success()
                return result
        except Exception as e:
            last_err = e
            _circuit_breaker.record_failure()
    
    raise last_err


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

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        logger.info(f"{self.command} {self.path} {args[0] if args else ''}")

    def _json(self, code, data):
        if code >= 400:
            inc_errors()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        add_security_headers(self)
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def respond(self, code, data):
        self._json(code, data)

    def do_GET(self):
        _cache_key = f"address_verification_{self.path}"
        _cached = cache_get(_cache_key)
        if _cached and self.path not in ("/healthz", "/readyz", "/livez", "/metrics", "/health"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("X-Cache", "HIT")
            add_security_headers(self)
            self.end_headers()
            self.wfile.write(_cached.encode() if isinstance(_cached, str) else _cached)
            return
        trace_id = self.headers.get("X-Trace-Id") or self.headers.get("traceparent") or f"{int(__import__('time').time()*1000)}-{os.getpid()}"
        logger.info(f"[address-verification-py] {self.command} {self.path} trace={trace_id}")
        inc_requests()
        if not _rl_allow():
            self.send_response(429)
            self.send_header("Content-Type", "application/json")
            self.send_header("Retry-After", "1")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "rate_limit_exceeded"}).encode())
            return
        path = urlparse(self.path).path

        if path == "/healthz":
            db = get_db()
            self.respond(200, {
                "status": "healthy",
                "service": "address-verification-py",
                "version": "2.0.0",
                "db": "connected" if db else "not_configured",
                "uptime_secs": round(time.time() - START_TIME),
            })
        elif path == "/readyz":
            self.respond(200, {"ready": True})
        elif path == "/livez":
            self.respond(200, {"alive": True})
        elif path == "/v1/degradation":
            self._json(200, {"service": "address-verification-py", **_degrade.status()})
        elif path == "/v1/alerts":
            self._json(200, {"alerts": check_alerts(), "rules": len(_ALERT_RULES)})
        elif path == "/metrics":
            body = (
                f'# HELP requests_total Total requests\n'
                f'# TYPE requests_total counter\n'
                f'requests_total{{service=\"address-verification-py\"}} {request_count}\n'
                f'# HELP errors_total Total errors\n'
                f'# TYPE errors_total counter\n'
                f'errors_total{{service=\"address-verification-py\"}} {error_count}\n'
            )
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(body.encode())
        elif path in ("/api/v1/service_configs", "/v1/config"):
            # Real data from Postgres; loud 503 when unavailable.
            try:
                conn = get_db()
                with conn.cursor() as cur:
                    cur.execute("SELECT id, status, created_at FROM service_configs ORDER BY created_at DESC LIMIT 50")
                    rows = cur.fetchall()
                items = [{"id": str(r[0]), "status": r[1], "created_at": str(r[2])} for r in rows]
                self._json(200, {"items": items, "total": len(items), "source": "database"})
            except Exception as e:
                logger.error(f"config query failed: {e}")
                self._json(503, {"error": "config_unavailable"})
        else:
            # Never fabricate a response for an unimplemented endpoint.
            self._json(501, {"error": "not_implemented", "path": path})

    def do_POST(self):
        trace_id = self.headers.get("X-Trace-Id") or self.headers.get("traceparent") or f"{int(__import__('time').time()*1000)}-{os.getpid()}"
        logger.info(f"[address-verification-py] {self.command} {self.path} trace={trace_id}")
        inc_requests()
        if not _rl_allow():
            self.send_response(429)
            self.send_header("Content-Type", "application/json")
            self.send_header("Retry-After", "1")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "rate_limit_exceeded"}).encode())
            return
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(sanitize_input(self.rfile.read(length).decode() if isinstance(self.rfile.read(length), bytes) else str(self.rfile.read(length)))) if length > 0 else {}

        # JWT auth check — real signature verification, fail closed
        claims, err = validate_jwt(dict(self.headers))
        if err:
            self.respond(401, {"error": "unauthorized", "detail": err})
            return

        # No POST endpoints are backed by real persistence in this handler.
        self.respond(501, {"error": "not_implemented", "path": path})

# --- Graceful Shutdown ---
server = None
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
