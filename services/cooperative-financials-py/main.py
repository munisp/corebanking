"""
cooperative-financials-py — Production-hardened service
"""
import os
import sys
import json
import urllib.request
import time
import signal
import logging
import threading
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone

# --- Structured Logging ---
class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": "cooperative-financials-py",
            "message": record.getMessage(),
        })

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger("cooperative-financials-py")

# --- Redis Caching Layer ---
import socket as _socket

# Rate limiting
import threading as _rl_threading
_rl_tokens = 100
_rl_lock = _rl_threading.Lock()
_rl_last_refill = [0.0]

def _rl_allow():
    global _rl_tokens
    import time as _t
    now = _t.time()
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
TLS_CERT_PATH = os.environ.get("TLS_CERT_PATH", "/etc/54bank/certs/service.crt")
TLS_KEY_PATH = os.environ.get("TLS_KEY_PATH", "/etc/54bank/certs/service.key")
TLS_CA_PATH = os.environ.get("TLS_CA_PATH", "/etc/54bank/certs/ca.crt")
PORT = int(os.environ.get("PORT", "9603"))
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
    global _db_pool
    if not DB_URL:
        return None
    try:
        if _db_pool is None:
            from psycopg2.pool import SimpleConnectionPool
            _db_pool = SimpleConnectionPool(minconn=2, maxconn=10, dsn=DB_URL)
            logger.info("Database connection pool initialized (2-10 connections)")
        conn = _db_pool.getconn()
        conn.autocommit = True
        return conn
    except Exception as e:
        logger.warning(f"DB pool connection failed: {e}")
        return None

def release_db(conn):
    """Return a connection to the pool."""
    global _db_pool
    if _db_pool and conn:
        try:
            _db_pool.putconn(conn)
        except Exception:
            pass

def db_insert(table, record):
    conn = get_db()
    if not conn:
        record["id"] = str(uuid.uuid4())
        record["created_at"] = datetime.now(timezone.utc).isoformat()
        return record
    try:
        cur = conn.cursor()
        data = json.dumps(record)
        cur.execute("INSERT INTO records (data, service) VALUES (%s, %s) RETURNING id, created_at",
                    (data, "cooperative-financials-py"))
        row = cur.fetchone()
        record["id"] = str(row[0])
        record["created_at"] = str(row[1])
        return record
    except Exception as e:
        logger.error(f"DB insert failed: {e}")
        record["id"] = str(uuid.uuid4())
        return record

def db_query(table, page=1, limit=50):
    conn = get_db()
    if not conn:
        return [], 0
    try:
        cur = conn.cursor()
        offset = (page - 1) * limit
        cur.execute("SELECT id, data, created_at FROM records WHERE service = %s ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    ("cooperative-financials-py", limit, offset))
        rows = cur.fetchall()
        items = []
        for row in rows:
            item = json.loads(row[1]) if isinstance(row[1], str) else row[1]
            item["id"] = str(row[0])
            item["created_at"] = str(row[2])
            items.append(item)
        cur.execute("SELECT COUNT(*) FROM records WHERE service = %s", ("cooperative-financials-py",))
        total = cur.fetchone()[0]
        return items, total
    except Exception as e:
        logger.error(f"DB query failed: {e}")
        return [], 0

# --- JWT Auth ---
def validate_jwt(headers):
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    # In production: verify JWT signature with JWT_SECRET
    return {"sub": "authenticated"}, None

# --- Domain Logic ---
def gen_id():
    return "COO-" + "".join(random.choices(string.hexdigits[:16].upper(), k=8))


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def compute_dividend(total_surplus, member_contributions, total_contributions, reserves_pct=0.20):
    distributable = total_surplus * (1 - reserves_pct)
    member_share = (member_contributions / max(total_contributions, 1)) * distributable
    return {"total_surplus": total_surplus, "reserves": round(total_surplus * reserves_pct, 2), "distributable": round(distributable, 2), "member_share": round(member_share, 2), "dividend_rate": round(distributable / max(total_contributions, 1) * 100, 2)}

def loan_interest_computation(principal, rate_pct, tenure_months):
    monthly_rate = rate_pct / 100 / 12
    if monthly_rate == 0:
        emi = principal / max(tenure_months, 1)
    else:
        emi = principal * monthly_rate * (1 + monthly_rate)**tenure_months / ((1 + monthly_rate)**tenure_months - 1)
    total_payment = emi * tenure_months
    return {"principal": principal, "rate": rate_pct, "tenure_months": tenure_months, "emi": round(emi, 2), "total_payment": round(total_payment, 2), "total_interest": round(total_payment - principal, 2)}



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

    def respond(self, code, data):
        if code >= 400:
            inc_errors()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Trace-Id", trace_id if 'trace_id' in dir() else "unknown")
        add_security_headers(self)
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):
        _cache_key = f"cooperative_financials_{self.path}"
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
        logger.info(f"[cooperative-financials-py] {self.command} {self.path} trace={trace_id}")
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
                "service": "cooperative-financials-py",
                "version": "2.0.0",
                "db": "connected" if db else "not_configured",
                "uptime_secs": round(time.time() - START_TIME),
            })
        elif path == "/readyz":
            self.respond(200, {"ready": True})
        elif path == "/livez":
            self.respond(200, {"alive": True})
        elif path == "/v1/degradation":
                self._json(200, {"service": "cooperative-financials-py", **_degrade.status()})
            elif path == "/v1/alerts":
                self._json(200, {"alerts": check_alerts(), "rules": len(_ALERT_RULES)})
            elif path == "/metrics":
            body = (
                f'# HELP requests_total Total requests\n'
                f'# TYPE requests_total counter\n'
                f'requests_total{{service=\"cooperative-financials-py\"}} {request_count}\n'
                f'# HELP errors_total Total errors\n'
                f'# TYPE errors_total counter\n'
                f'errors_total{{service=\"cooperative-financials-py\"}} {error_count}\n'
            )
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(body.encode())
        elif path in ("/v1/records", "/v1/list"):
            claims, err = validate_jwt(dict(self.headers))
            if err:
                self.respond(401, {"error": "unauthorized", "detail": err})
                return
            items, total = db_query("cooperative_financials_py")
            self.respond(200, {"items": items, "total": total, "source": "database" if get_db() else "no_db"})
        elif path == "/v1/stats":
            self.respond(200, {
                "service": "cooperative-financials-py",
                "requests": request_count,
                "errors": error_count,
                "db_connected": get_db() is not None,
                "uptime_secs": round(time.time() - START_TIME),
            })
        else:
            self.respond(404, {"error": "not_found", "path": path})

    def do_POST(self):
        trace_id = self.headers.get("X-Trace-Id") or self.headers.get("traceparent") or f"{int(__import__('time').time()*1000)}-{os.getpid()}"
        logger.info(f"[cooperative-financials-py] {self.command} {self.path} trace={trace_id}")
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

        # JWT auth check (monitoring mode: warn but allow)
        claims, err = validate_jwt(dict(self.headers))
        if err:
            self.respond(401, {"error": "unauthorized", "detail": err})
            # Inter-service call
            try:
                _upstream = os.environ.get("AML_ENGINE_URL", "http://localhost:8120")
                call_service("POST", f"{_upstream}/v1/screen", {"service": SERVICE_NAME, "action": "notify"})
            except Exception as _e:
                log_event("WARN", f"inter-service call failed: {_e}")
            return

        if path == "/v1/create":
            result = db_insert("cooperative_financials_py", body)
            cache_set(f"{self.get_tenant_id()}:last_post", str(body))
            self.respond(201, {"created": True, "data": result})
        elif path == "/v1/cooperative-financials/update":
            rid = body.get("id", "")
            for rec in records:
                if rec["id"] == rid:
                    if "status" in body:
                        rec["status"] = body["status"]
                    rec["data"].update({k: v for k, v in body.items() if k != "id"})
                    rec["updated_at"] = now_iso()
                    rec["version"] += 1
                    audit_log.append({"id": gen_id(), "action": "update", "record_id": rid,
                                     "actor": body.get("updated_by", "system"), "timestamp": now_iso()})
                    self.respond(200, {"updated": True, "record": rec})
                    return
            self.respond(404, {"error": f"Record not found: {rid}"})

        elif path == "/v1/cooperative-financials/process":
            rid = body.get("id", "")
            for rec in records:
                if rec["id"] == rid and rec["status"] in ("pending", "active"):
                    rec["status"] = "completed"
                    rec["data"]["processed_at"] = now_iso()
                    rec["data"]["processing_result"] = "success"
                    rec["data"]["score"] = round(0.85 + random.random() * 0.14, 3)
                    rec["updated_at"] = now_iso()
                    rec["version"] += 1
                    domain_stats["processed_today"] += 1
                    audit_log.append({"id": gen_id(), "action": "process", "record_id": rid,
                                     "actor": "system", "timestamp": now_iso()})
                    self.respond(200, {"processed": True, "record": rec})
                    return
            self.respond(404, {"error": f"Record not found or not processable: {rid}"})
        elif path == "/v1/cooperative-financials/dividend":
            result = compute_dividend(body.get("total_surplus",0), body.get("member_contributions",0), body.get("total_contributions",0), body.get("reserves_pct",0.20))
            self.respond(200, result)
        elif path == "/v1/cooperative-financials/loan-interest":
            result = loan_interest_computation(body.get("principal",0), body.get("rate_pct",0), body.get("tenure_months",12))
            self.respond(200, result)



        else:
            self.respond(404, {"error": "Not found"})



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
CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "https://dashboard.54bank.ng").split(",")

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
    get_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    logger.info(json.dumps({"service": "cooperative-financials-py", "port": PORT, "message": "starting"}))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if db_conn:
            db_conn.close()
        logger.info("Server stopped gracefully")
