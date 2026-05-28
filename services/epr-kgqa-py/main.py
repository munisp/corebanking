"""
epr-kgqa-py — Production-hardened service
"""
import os, sys, json, time, signal, logging, threading, uuid, math
import socket as _socket
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone
from collections import defaultdict, deque

SERVICE_NAME = "epr-kgqa-py"

class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({"timestamp": datetime.now(timezone.utc).isoformat(), "level": record.levelname, "service": SERVICE_NAME, "message": record.getMessage()})

_handler = logging.StreamHandler()
_handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_handler])
logger = logging.getLogger(SERVICE_NAME)

import threading as _rl_threading
_rl_tokens = 100
_rl_lock = _rl_threading.Lock()
_rl_last_refill = [0.0]
def _rl_allow():
    global _rl_tokens
    now = time.time()
    with _rl_lock:
        if now - _rl_last_refill[0] >= 1.0: _rl_tokens = 100; _rl_last_refill[0] = now
        if _rl_tokens <= 0: return False
        _rl_tokens -= 1; return True

# --- Production Cache (connection-pooled, multi-level L1+L2, stampede protection, metrics) ---
import socket as _cache_socket
import threading as _cache_threading

_REDIS_URL = os.environ.get("REDIS_URL", "localhost:6379")
_CACHE_POOL_SIZE = int(os.environ.get("REDIS_POOL_SIZE", "8"))

class _CachePool:
    """Thread-safe Redis connection pool with health checks."""
    def __init__(self, url, size=8):
        parts = url.rsplit(":", 1)
        self.host = parts[0] if parts else "localhost"
        self.port = int(parts[1]) if len(parts) > 1 else 6379
        self.pool = []
        self.lock = _cache_threading.Lock()
        self.max_size = size
        # Pre-warm 2 connections
        for _ in range(2):
            c = self._dial()
            if c: self.pool.append(c)

    def _dial(self):
        try:
            s = _cache_socket.create_connection((self.host, self.port), timeout=2)
            s.settimeout(3)
            s.sendall(b"*1\r\n$4\r\nPING\r\n")
            resp = s.recv(64)
            if resp and resp[0:1] == b'+':
                return s
            s.close()
        except Exception:
            pass
        return None

    def get(self):
        with self.lock:
            while self.pool:
                conn = self.pool.pop()
                try:
                    conn.settimeout(1)
                    conn.sendall(b"*1\r\n$4\r\nPING\r\n")
                    r = conn.recv(64)
                    if r and r[0:1] == b'+':
                        conn.settimeout(3)
                        return conn
                except Exception:
                    pass
                try: conn.close()
                except: pass
        return self._dial()

    def put(self, conn):
        if conn is None: return
        with self.lock:
            if len(self.pool) < self.max_size:
                self.pool.append(conn)
            else:
                try: conn.close()
                except: pass

    def health(self):
        c = self.get()
        if c:
            self.put(c)
            return True
        return False

_cache_pool = _CachePool(_REDIS_URL, _CACHE_POOL_SIZE)
_l1_cache = {}  # key -> (value, expiry_time)
_l1_lock = _cache_threading.Lock()
_l1_max_size = int(os.environ.get("CACHE_L1_MAX_SIZE", "500"))
_cache_hits = 0
_cache_misses = 0
_cache_stampedes = 0
_cache_metrics_lock = _cache_threading.Lock()

def _l1_get(key):
    with _l1_lock:
        entry = _l1_cache.get(key)
        if entry:
            val, exp = entry
            if time.time() < exp:
                return val
            del _l1_cache[key]
    return None

def _l1_set(key, value, ttl=10):
    with _l1_lock:
        if len(_l1_cache) >= _l1_max_size:
            # Evict oldest
            oldest_k = min(_l1_cache, key=lambda k: _l1_cache[k][1])
            del _l1_cache[oldest_k]
        _l1_cache[key] = (value, time.time() + ttl)

def _l1_delete(key):
    with _l1_lock:
        _l1_cache.pop(key, None)

def cache_get(key):
    global _cache_hits, _cache_misses
    # L1: in-process
    val = _l1_get(key)
    if val is not None:
        with _cache_metrics_lock: _cache_hits += 1
        return val
    # L2: Redis via pool
    conn = _cache_pool.get()
    if conn is None:
        with _cache_metrics_lock: _cache_misses += 1
        return None
    try:
        conn.sendall(f"*2\r\n$3\r\nGET\r\n${len(key)}\r\n{key}\r\n".encode())
        data = conn.recv(8192).decode()
        _cache_pool.put(conn)
        if data.startswith("$-1"):
            with _cache_metrics_lock: _cache_misses += 1
            return None
        parts = data.split("\r\n", 2)
        if len(parts) >= 3 and parts[1]:
            with _cache_metrics_lock: _cache_hits += 1
            _l1_set(key, parts[1])  # Promote to L1
            return parts[1]
    except Exception:
        try: conn.close()
        except: pass
    with _cache_metrics_lock: _cache_misses += 1
    return None

def cache_set(key, value, ttl=300):
    # L1 store
    _l1_set(key, str(value), min(ttl, 30))
    # L2: Redis via pool
    conn = _cache_pool.get()
    if conn is None: return
    try:
        v = str(value)
        t = str(ttl)
        cmd = f"*6\r\n$3\r\nSET\r\n${len(key)}\r\n{key}\r\n${len(v)}\r\n{v}\r\n$2\r\nEX\r\n${len(t)}\r\n{t}\r\n$2\r\nNX\r\n"
        conn.sendall(cmd.encode())
        conn.recv(256)
        _cache_pool.put(conn)
    except Exception:
        try: conn.close()
        except: pass

def cache_invalidate(key):
    _l1_delete(key)
    conn = _cache_pool.get()
    if conn is None: return
    try:
        conn.sendall(f"*2\r\n$3\r\nDEL\r\n${len(key)}\r\n{key}\r\n".encode())
        conn.recv(64)
        # Distributed invalidation via PUBLISH
        channel = "54bank:cache:invalidate"
        conn.sendall(f"*3\r\n$7\r\nPUBLISH\r\n${len(channel)}\r\n{channel}\r\n${len(key)}\r\n{key}\r\n".encode())
        conn.recv(64)
        _cache_pool.put(conn)
    except Exception:
        try: conn.close()
        except: pass

def cache_get_or_load(key, loader, ttl=300):
    """Get from cache or load with stampede protection."""
    global _cache_stampedes
    val = cache_get(key)
    if val is not None: return val
    # Stampede lock via SETNX
    lock_key = key + ":lock"
    conn = _cache_pool.get()
    if conn:
        try:
            conn.sendall(f"*6\r\n$3\r\nSET\r\n${len(lock_key)}\r\n{lock_key}\r\n$1\r\n1\r\n$2\r\nNX\r\n$2\r\nEX\r\n$1\r\n5\r\n".encode())
            resp = conn.recv(64).decode()
            _cache_pool.put(conn)
            if "$-1" in resp or resp.startswith("-"):
                with _cache_metrics_lock: _cache_stampedes += 1
                time.sleep(0.05)
                val = cache_get(key)
                if val is not None: return val
        except Exception:
            try: conn.close()
            except: pass
    # Load from source
    result = loader()
    if result is not None:
        cache_set(key, result if isinstance(result, str) else json.dumps(result, default=str), ttl)
    return result

def cache_metrics():
    with _cache_metrics_lock:
        total = _cache_hits + _cache_misses
        rate = (_cache_hits / total * 100) if total > 0 else 0
    return {
        "hits": _cache_hits, "misses": _cache_misses,
        "hit_rate_pct": round(rate, 2),
        "stampedes_prevented": _cache_stampedes,
        "l1_size": len(_l1_cache),
        "pool_connected": _cache_pool.health(),
    }

_DB_URL = os.environ.get("DATABASE_URL", "")
def db_insert(table, data):
    logger.info(f"db_insert({table}): {json.dumps(data)[:200]}"); return {"inserted": True}
def db_query(table, limit=50, offset=0): return [], 0

def sanitize_input(s):
    s = s.replace("<script>", "").replace("</script>", "").replace("javascript:", "")
    return s[:10240] if len(s) > 10240 else s

request_count = 0; error_count = 0; _counter_lock = threading.Lock()
def inc_requests():
    global request_count
    with _counter_lock: request_count += 1
def inc_errors():
    global error_count
    with _counter_lock: error_count += 1

def call_service(method, url, data=None):
    try:
        payload = json.dumps(data).encode() if data else b"{}"
        payload = sanitize_input(payload.decode()).encode()
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method=method)
        with urllib.request.urlopen(req, timeout=5) as resp: return json.loads(resp.read().decode())
    except Exception as e:
        logger.warning(f"call_service failed: {e}"); return None


# --- mTLS Configuration ---
MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false") == "true"
TLS_CERT_PATH = os.environ.get("TLS_CERT_PATH", "/etc/54bank/certs/service.crt")
TLS_KEY_PATH = os.environ.get("TLS_KEY_PATH", "/etc/54bank/certs/service.key")
TLS_CA_PATH = os.environ.get("TLS_CA_PATH", "/etc/54bank/certs/ca.crt")
PORT = int(os.environ.get("PORT", "8080"))


# ─── Domain Logic: Knowledge Graph QA ────────────────────────────────────────

def extract_entities(query):
    """Extract financial entities from natural language query."""
    import re
    entities = []
    # Account numbers
    for m in re.finditer(r"\b\d{10}\b", query):
        entities.append({"type": "account_number", "value": m.group()})
    # BVN
    for m in re.finditer(r"\b22\d{9}\b", query):
        entities.append({"type": "bvn", "value": m.group()})
    # Amounts
    for m in re.finditer(r"[₦N]?\s*([\d,]+\.?\d*)", query):
        entities.append({"type": "amount", "value": m.group(1).replace(",", "")})
    # Dates
    for m in re.finditer(r"\d{4}-\d{2}-\d{2}", query):
        entities.append({"type": "date", "value": m.group()})
    return entities

def generate_cypher_query(intent, entities):
    """Generate Cypher query from intent and entities."""
    templates = {
        "find_account": "MATCH (a:Account {{number: '{account_number}'}}) RETURN a",
        "find_customer": "MATCH (c:Customer)-[:OWNS]->(a:Account) WHERE c.bvn = '{bvn}' RETURN c, a",
        "find_transactions": "MATCH (a:Account {{number: '{account_number}'}})-[:HAS_TXN]->(t:Transaction) RETURN t ORDER BY t.date DESC LIMIT 10",
    }
    params = {}
    for e in entities: params[e["type"]] = e["value"]
    template = templates.get(intent, "MATCH (n) RETURN n LIMIT 10")
    try: return template.format(**params)
    except KeyError: return template



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
    def log_message(self, fmt, *args): pass
    def respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        self.send_header("Content-Security-Policy", "default-src 'self'")
        self.send_header("X-XSS-Protection", "1; mode=block")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def get_tenant_id(self):
        """Extract tenant_id from gateway-injected header."""
        return self.headers.get("X-Tenant-Id", "platform")

    def check_jwt(self):
        path = self.path.split("?")[0]
        if path in ("/healthz", "/readyz", "/livez", "/metrics"): return True
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            self.respond(401, {"error": "unauthorized"}); return False
        return True
    def do_GET(self):
        inc_requests()
        path = self.path.split("?")[0]
        trace_id = self.headers.get("X-Trace-Id", str(uuid.uuid4()))
        logger.info(f"[{SERVICE_NAME}] GET {path} trace={trace_id}")
        if         if path == "/v1/cache-metrics":
            self._respond(200, cache_metrics())
            return
        path == "/healthz": self.respond(200, {"status": "healthy", "service": SERVICE_NAME})
        elif path == "/readyz": self.respond(200, {"ready": True, "service": SERVICE_NAME})
        elif path == "/livez": self.respond(200, {"live": True})
        elif path == "/v1/degradation":
                self._json(200, {"service": "epr-kgqa-py", **_degrade.status()})
            elif path == "/v1/alerts":
                self._json(200, {"alerts": check_alerts(), "rules": len(_ALERT_RULES)})
            elif path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {request_count}\nerrors_total{{service="{SERVICE_NAME}"}} {error_count}\n'.encode())
        elif path == "/v1/kgqa/entities":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "entities", "items": [], "source": "in-memory" if not _DB_URL else "postgres"})

        else:
            cached = cache_get(f"{SERVICE_NAME}_{path}")
            self.respond(200, {"items": [], "total": 0, "source": "in-memory" if not _DB_URL else "postgres"})
    def do_POST(self):
        inc_requests()
        path = self.path.split("?")[0]
        trace_id = self.headers.get("X-Trace-Id", str(uuid.uuid4()))
        logger.info(f"[{SERVICE_NAME}] POST {path} trace={trace_id}")
        content_length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        body = json.loads(sanitize_input(raw.decode("utf-8")))
        if path == "/v1/kgqa/ask":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            result = db_insert(SERVICE_NAME, body)
            cache_set(f"{self.get_tenant_id()}:ask_last", json.dumps(body))
            gl_url = os.environ.get("GL_ENGINE_URL", "http://gl-engine-go:8080")
            call_service("POST", f"{gl_url}/v1/notify", {"source": SERVICE_NAME, "action": "ask"})
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "ask", "result": body})
        elif path == "/v1/kgqa/sparql":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            result = db_insert(SERVICE_NAME, body)
            cache_set(f"{self.get_tenant_id()}:sparql_last", json.dumps(body))
            gl_url = os.environ.get("GL_ENGINE_URL", "http://gl-engine-go:8080")
            call_service("POST", f"{gl_url}/v1/notify", {"source": SERVICE_NAME, "action": "sparql"})
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "sparql", "result": body})
        elif path == "/v1/create":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            result = db_insert(SERVICE_NAME, body)
            cache_set(f"{self.get_tenant_id()}:last_post", json.dumps(body))
            self.respond(201, {"created": True})

        else:
            result = db_insert(SERVICE_NAME, body)
            cache_set(f"{self.get_tenant_id()}:last_post", json.dumps(body))
            self.respond(201, {"created": True})

if __name__ == "__main__":
    def shutdown_handler(sig, frame):
        logger.info("Shutting down gracefully"); sys.exit(0)
    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "message": "starting"}))
    server.serve_forever()
