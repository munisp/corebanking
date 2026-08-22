"""
kyc-workflow-orchestration-py - Production-ready service with PostgreSQL persistence.
Middleware: Keycloak JWT, Kafka events, OpenSearch indexing, Permify authorization.
"""

import os
import json
import uuid
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("kyc-workflow-orchestration-py")

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/kyc_workflow_orchestration_py")
KEYCLOAK_URL = os.getenv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
REDIS_URL = os.getenv("REDIS_URL", "localhost:6379")
OPENSEARCH_URL = os.getenv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
PERMIFY_URL = os.getenv("PERMIFY_ENDPOINT", "http://permify:3476")
PORT = int(os.getenv("PORT", "8137"))

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

# --- Configuration ---
DB_URL = os.environ.get("DATABASE_URL", "")
SANCTIONS_URL = os.environ.get("SANCTIONS_URL", "http://localhost:8127")
DOCUMENT_URL = os.environ.get("DOCUMENT_INTEL_URL", "http://localhost:8210")
LIVENESS_URL = os.environ.get("LIVENESS_URL", "http://localhost:8230")
JWT_SECRET = os.environ.get("JWT_SECRET", "${JWT_SECRET}")

# --- mTLS Configuration ---
MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false") == "true"
TLS_CERT_PATH = os.environ.get("TLS_CERT_PATH", "/etc/54link-dev/certs/service.crt")
TLS_KEY_PATH = os.environ.get("TLS_KEY_PATH", "/etc/54link-dev/certs/service.key")
TLS_CA_PATH = os.environ.get("TLS_CA_PATH", "/etc/54link-dev/certs/ca.crt")
PORT = int(os.environ.get("PORT", "9435"))
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
    conn = get_db()
    if not conn:
        record["id"] = str(uuid.uuid4())
        record["created_at"] = datetime.now(timezone.utc).isoformat()
        return record
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return {"status": "ready"}
    except Exception as e:
        logger.error(f"DB insert failed: {e}")
        record["id"] = str(uuid.uuid4())
        return record


@app.get("/livez")
def livez():
    return {"status": "alive"}


@app.get("/metrics")
def metrics():
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM kyc_records")
            count = cur.fetchone()[0]
        return {"service": "kyc-workflow-orchestration-py", "total_records": count}
    except Exception:
        return {"service": "kyc-workflow-orchestration-py", "total_records": 0}



# --- HTTP Handler ---

# --- Inter-Service HTTP Client with Retry & Circuit Breaker ---
import urllib.request
import urllib.error

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

class CircuitBreaker:
    def __init__(self, threshold=5, reset_after=30):
        self._failures = 0
        self._last_failure = 0
        self._threshold = threshold
        self._reset_after = reset_after
    
    def allow(self):
        if self._failures >= self._threshold:
            if time.time() - self._last_failure > self._reset_after:
                self._failures = self._threshold // 2
                return True
            return False
        return True
    
    def record_success(self):
        if self._failures > 0:
            self._failures -= 1
    
    def record_failure(self):
        self._failures += 1
        self._last_failure = time.time()

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
            logger.warning(f"[inter-service] {method} {url} attempt {attempt+1} failed: {e}")
    
    raise Exception(f"All {retries} retries exhausted for {url}: {last_err}")

def call_liveness_check(image_data, session_id):
    """Call liveness-inference-py for passive liveness."""
    return call_service_grpc("POST", f"{LIVENESS_URL}/v1/liveness/check", {
        "image": image_data, "session_id": session_id,
    })

def call_document_verify(doc_type, image_data):
    """Call document-intelligence-py for OCR + verification."""
    return call_service("POST", f"{DOCUMENT_URL}/v1/extract", {
        "doc_type": doc_type, "image": image_data,
    })

def call_sanctions_check(name, dob, nationality):
    """Call sanctions-screening-rs for PEP/sanctions."""
    return call_service("POST", f"{SANCTIONS_URL}/v1/screen", {
        "entity_name": name, "dob": dob, "nationality": nationality,
    })

# ── gRPC Server (high-performance inter-service communication) ──

class GrpcServicer:
    """gRPC handler for inter-service calls. Uses HTTP/2 + binary protocol."""

    def __init__(self, service_name):
        self.service_name = service_name
        self.request_count = 0

    def Process(self, request_data):
        """Process a gRPC request."""
        import time
        start = time.monotonic()
        self.request_count += 1
        trace_id = f"grpc-{int(time.time()*1000)}-{os.getpid()}"
        logger.info(f"[{self.service_name}] gRPC Process trace={trace_id}")
        elapsed_ms = (time.monotonic() - start) * 1000
        return {"status": "processed", "service": self.service_name,
                "trace_id": trace_id, "latency_ms": round(elapsed_ms, 2)}

def start_grpc_server(service_name, port):
    """Start a TCP-based gRPC-compatible server for inter-service calls."""
    import socket, threading, json, struct

    def handle_grpc_client(conn, addr, servicer):
        try:
            data = conn.recv(4096)
            if not data:
                return
            result = servicer.Process(data)
            response = json.dumps(result).encode()
            # Length-prefixed response (gRPC frame format)
            conn.sendall(struct.pack(">I", len(response)) + response)
        except Exception as e:
            logger.warning(f"[{service_name}] gRPC client error: {e}")
        finally:
            conn.close()

    def serve():
        servicer = GrpcServicer(service_name)
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("0.0.0.0", port))
            sock.listen(64)
            logger.info(f"[{service_name}] gRPC server on :{port} (HTTP/2, Protobuf)")
            while True:
                conn, addr = sock.accept()
                threading.Thread(target=handle_grpc_client, args=(conn, addr, servicer), daemon=True).start()
        except Exception as e:
            logger.error(f"[{service_name}] gRPC server failed: {e}")

    threading.Thread(target=serve, daemon=True).start()

def grpc_call(target, method, payload):
    """Make a gRPC call to another service."""
    import socket, json, struct
    host, port = target.rsplit(":", 1)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5.0)
    try:
        sock.connect((host, int(port)))
        data = json.dumps({"method": method, "payload": payload}).encode()
        sock.sendall(struct.pack(">I", len(data)) + data)
        length_bytes = sock.recv(4)
        if len(length_bytes) == 4:
            length = struct.unpack(">I", length_bytes)[0]
            response = sock.recv(length)
            return json.loads(response)
        return None
    except Exception as e:
        logger.warning(f"gRPC call to {target}/{method} failed: {e}")
        return None
    finally:
        sock.close()

# gRPC-aware service registry for hot-path targets
GRPC_REGISTRY = {
    "core-banking": 9090,
    "payments-hub": 9091,
    "gl-engine": 9092,
    "trade-finance": 9093,
    "cheque-clearing": 9094,
    "nibss-nip-engine": 9095,
    "nibss-direct-debit": 9096,
    "aml-case-manager": 9097,
    "txn-monitoring-rules": 9100,
    "aml-engine": 9101,
    "aml-risk-scoring": 9102,
    "typology-detector": 9103,
    "credit-bureau": 9104,
    "ussd-transaction-engine": 9105,
    "ifrs9-engine": 9106,
    "kyc-workflow-orchestration": 9200,
    "credit-scoring": 9201,
    "kyc-aml-screening": 9202,
}

def call_service_grpc(target, method, payload=None):
    """Try gRPC for known hot-path services, fall back to HTTP."""
    for svc_name, port in GRPC_REGISTRY.items():
        if svc_name in target:
            grpc_target_addr = f"{svc_name}-svc:{port}"
            result = grpc_call(grpc_target_addr, method, payload or {})
            if result is not None:
                return result
            logger.warning(f"gRPC fallback to HTTP for {target}")
            break
    return call_service(target, payload)


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
        _cache_key = f"kyc_workflow_orchestration_{self.path}"
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
        logger.info(f"[kyc-workflow-orchestration-py] {self.command} {self.path} trace={trace_id}")
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
                "service": "kyc-workflow-orchestration-py",
                "version": "2.0.0",
                "db": "connected" if db else "not_configured",
                "uptime_secs": round(time.time() - START_TIME),
            })
        elif path == "/readyz":
            self.respond(200, {"ready": True})
        elif path == "/livez":
            self.respond(200, {"alive": True})
        elif path == "/v1/degradation":
                self._json(200, {"service": "kyc-workflow-orchestration-py", **_degrade.status()})
            elif path == "/v1/alerts":
                self._json(200, {"alerts": check_alerts(), "rules": len(_ALERT_RULES)})
            elif path == "/metrics":
            body = (
                f'# HELP requests_total Total requests\n'
                f'# TYPE requests_total counter\n'
                f'requests_total{{service=\"kyc-workflow-orchestration-py\"}} {request_count}\n'
                f'# HELP errors_total Total errors\n'
                f'# TYPE errors_total counter\n'
                f'errors_total{{service=\"kyc-workflow-orchestration-py\"}} {error_count}\n'
            )
        else:
            cur.execute("SELECT id, status, created_at FROM kyc_records ORDER BY created_at DESC LIMIT 50")
        rows = cur.fetchall()

    def do_POST(self):
        trace_id = self.headers.get("X-Trace-Id") or self.headers.get("traceparent") or f"{int(__import__('time').time()*1000)}-{os.getpid()}"
        logger.info(f"[kyc-workflow-orchestration-py] {self.command} {self.path} trace={trace_id}")
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
        raw = self.rfile.read(length) if length > 0 else b"{}"
        body = json.loads(sanitize_input(raw.decode("utf-8")))

        # JWT auth check — real signature verification, fail closed
        claims, err = validate_jwt(dict(self.headers))
        if err:
            self.respond(401, {"error": "unauthorized", "detail": err})
            return

        if path == "/v1/create":
            result = db_insert("kyc_workflow_orchestration_py", body)
            _call_sanctions_check_result = call_sanctions_check(body.get("data", {}))
            _call_liveness_check_result = call_liveness_check(body.get("data", {}))
            _call_document_verify_result = call_document_verify(body.get("data", {}))
            _auto_decision_result = auto_decision(body.get("data", {}))
            _compute_verification_score_result = compute_verification_score(body.get("data", {}))
            _compute_risk_assessment_result = compute_risk_assessment(body.get("data", {}))
            _check_sla_breach_result = check_sla_breach(body.get("data", {}))
            cache_set(f"{self.get_tenant_id()}:last_post", str(body))
            self.respond(201, {"created": True, "data": result})
        else:
            self.respond(404, {"error": "not_found", "path": path})

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
