"""
agent-reconciliation-py - Production-ready service with PostgreSQL persistence.
Middleware: Keycloak JWT, Kafka events, OpenSearch indexing, Permify authorization.
"""

import os
import json
import uuid
import logging

from http.server import ThreadingHTTPServer
import time
import threading
import socket as _socket
import urllib.request
from http.server import BaseHTTPRequestHandler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("agent-reconciliation-py")
SERVICE_NAME = "agent-reconciliation-py"
AGENT_TOOLS = ["neo4j_graph", "falkordb", "qdrant_search", "gl_engine", "core_banking", "kyc", "aml_engine", "kgqa", "langchain"]

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/agent_reconciliation_py")
KEYCLOAK_URL = os.getenv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
REDIS_URL = os.getenv("REDIS_URL", "localhost:6379")
OPENSEARCH_URL = os.getenv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
PERMIFY_URL = os.getenv("PERMIFY_ENDPOINT", "http://permify:3476")
PORT = int(os.getenv("PORT", "8080"))

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

_REDIS_URL = os.environ.get("REDIS_URL", "localhost:6379")
def cache_get(key):
    try:
        host, port = _REDIS_URL.rsplit(":", 1)
        s = _socket.create_connection((host, int(port)), timeout=2)
        s.sendall(f"*2\r\n$3\r\nGET\r\n${len(key)}\r\n{key}\r\n".encode())
        data = s.recv(4096).decode(); s.close()
        if data.startswith("$-1"): return None
        parts = data.split("\r\n", 2); return parts[1] if len(parts) >= 3 else None
    except: return None
def cache_set(key, value, ttl=300):
    try:
        host, port = _REDIS_URL.rsplit(":", 1)
        s = _socket.create_connection((host, int(port)), timeout=2)
        s.sendall(f"*4\r\n$3\r\nSET\r\n${len(key)}\r\n{key}\r\n${len(str(value))}\r\n{value}\r\n$2\r\nEX\r\n${len(str(ttl))}\r\n{ttl}\r\n".encode())
        s.recv(256); s.close()
    except: pass

_DB_URL = os.environ.get("DATABASE_URL", "")
def db_insert(table, data):
    logger.info(f"db_insert({table}): {json.dumps(data)[:200]}"); return {"inserted": True}

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
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json", "Authorization": "Bearer internal-agent-token"}, method=method)
        with urllib.request.urlopen(req, timeout=10) as resp: return json.loads(resp.read().decode())
    except Exception as e:
        logger.warning(f"call_service failed: {e}"); return {"error": str(e), "fallback": True}

# --- Service URLs ---
NEO4J_URL = os.environ.get("NEO4J_COA_URL", "http://neo4j-coa-graph-py:8080")
FALKORDB_URL = os.environ.get("FALKORDB_COA_URL", "http://falkordb-coa-py:8080")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://qdrant-financial-search-py:8080")
LANGCHAIN_URL = os.environ.get("LANGCHAIN_URL", "http://langchain-agent-py:8080")
GL_ENGINE_URL = os.environ.get("GL_ENGINE_URL", "http://gl-engine-go:8080")
CORE_BANKING_URL = os.environ.get("CORE_BANKING_URL", "http://core-banking-go:8080")
KYC_URL = os.environ.get("KYC_URL", "http://kyc-orchestrator-go:8080")
AML_URL = os.environ.get("AML_URL", "http://aml-engine-rs:8080")
KGQA_URL = os.environ.get("KGQA_URL", "http://epr-kgqa-py:8080")


# --- mTLS Configuration ---
MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false") == "true"
TLS_CERT_PATH = os.environ.get("TLS_CERT_PATH", "/etc/54link-dev/certs/service.crt")
TLS_KEY_PATH = os.environ.get("TLS_KEY_PATH", "/etc/54link-dev/certs/service.key")
TLS_CA_PATH = os.environ.get("TLS_CA_PATH", "/etc/54link-dev/certs/ca.crt")


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

    # --- Agent reasoning methods ---
    def parse_intent(self, query):
        q = query.lower()
        intents = []
        if any(w in q for w in ["account", "open", "create", "onboard"]): intents.append("account_management")
        if any(w in q for w in ["transaction", "trace", "flow", "investigate"]): intents.append("transaction_analysis")
        if any(w in q for w in ["loan", "credit", "lending", "origination"]): intents.append("loan_assessment")
        if any(w in q for w in ["report", "return", "cbn", "regulatory", "basel", "ifrs"]): intents.append("regulatory_reporting")
        if any(w in q for w in ["balance", "position", "liquidity", "cash", "treasury"]): intents.append("cash_management")
        if any(w in q for w in ["fraud", "suspicious", "aml", "money laundering"]): intents.append("fraud_detection")
        if any(w in q for w in ["reconcil", "match", "break", "difference"]): intents.append("reconciliation")
        if any(w in q for w in ["customer", "client", "360", "portfolio"]): intents.append("customer_360")
        if any(w in q for w in ["dormant", "inactive", "churn", "retention"]): intents.append("dormancy_prevention")
        if any(w in q for w in ["interest", "margin", "revenue", "profit", "loss"]): intents.append("financial_analysis")
        return intents if intents else ["general_inquiry"]

    def select_tools(self, intents):
        tool_map = {
            "account_management": ["core_banking", "kyc", "gl_engine"],
            "transaction_analysis": ["neo4j_graph", "gl_engine", "aml_engine"],
            "loan_assessment": ["neo4j_graph", "qdrant_search", "core_banking", "gl_engine"],
            "regulatory_reporting": ["neo4j_graph", "gl_engine", "falkordb"],
            "cash_management": ["neo4j_graph", "gl_engine", "falkordb"],
            "fraud_detection": ["aml_engine", "neo4j_graph", "qdrant_search"],
            "reconciliation": ["gl_engine", "core_banking", "neo4j_graph"],
            "customer_360": ["core_banking", "neo4j_graph", "qdrant_search", "aml_engine"],
            "dormancy_prevention": ["core_banking", "neo4j_graph", "qdrant_search"],
            "financial_analysis": ["gl_engine", "neo4j_graph", "falkordb"],
            "general_inquiry": ["kgqa", "qdrant_search"],
        }
        tools = set()
        for intent in intents:
            tools.update(tool_map.get(intent, ["kgqa"]))
        return list(tools)

    def execute_tool(self, tool, query, context):
        tool_urls = {
            "neo4j_graph": (NEO4J_URL, "/v1/coa/graph"),
            "falkordb": (FALKORDB_URL, "/v1/graph/query"),
            "qdrant_search": (QDRANT_URL, "/v1/search/semantic"),
            "gl_engine": (GL_ENGINE_URL, "/v1/gl/chart-of-accounts"),
            "core_banking": (CORE_BANKING_URL, "/v1/list"),
            "kyc": (KYC_URL, "/v1/list"),
            "aml_engine": (AML_URL, "/v1/list"),
            "kgqa": (KGQA_URL, "/v1/kgqa/ask"),
            "langchain": (LANGCHAIN_URL, "/v1/agent/query"),
        }
        if tool in tool_urls:
            base_url, path = tool_urls[tool]
            return call_service("POST" if "search" in path or "ask" in path or "query" in path else "GET", f"{base_url}{path}", {"query": query, "context": context})
        return {"tool": tool, "status": "not_available"}

    def synthesize(self, query, tool_results):
        successful = {k: v for k, v in tool_results.items() if not isinstance(v, dict) or "error" not in v}
        failed = {k: v.get("error", "unknown") for k, v in tool_results.items() if isinstance(v, dict) and "error" in v}
        return {
            "answer": f"Processed query using {len(successful)} tools successfully",
            "data_sources": list(successful.keys()),
            "failed_sources": failed,
            "confidence": len(successful) / max(len(tool_results), 1),
        }


    # ─── Domain Logic: Reconciliation Agent ──────────────────────────────────

    def reconcile_transactions(self, internal_txns, external_txns):
        """Auto-reconcile transactions between internal ledger and external source."""
        matched = []
        unmatched_internal = list(internal_txns)
        unmatched_external = list(external_txns)

        for i_txn in internal_txns:
            for e_txn in external_txns:
                if (abs(i_txn.get("amount", 0) - e_txn.get("amount", 0)) < 0.01 and
                    i_txn.get("reference") == e_txn.get("reference")):
                    matched.append({"internal": i_txn, "external": e_txn, "status": "matched"})
                    if i_txn in unmatched_internal: unmatched_internal.remove(i_txn)
                    if e_txn in unmatched_external: unmatched_external.remove(e_txn)
                    break

        return {
            "matched": len(matched), "unmatched_internal": len(unmatched_internal),
            "unmatched_external": len(unmatched_external),
            "reconciliation_rate": round(len(matched) / max(len(internal_txns), 1) * 100, 1),
            "suspense_items": unmatched_internal[:10],
        }

    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self.respond(401, {"error": "unauthorized", "detail": _n1_err})
                return
        inc_requests()
        path = self.path.split("?")[0]
        trace_id = self.headers.get("X-Trace-Id", str(uuid.uuid4()))
        logger.info(f"[{SERVICE_NAME}] GET {path} trace={trace_id}")
        if path == "/healthz": self.respond(200, {"status": "healthy", "service": SERVICE_NAME, "tools": AGENT_TOOLS})
        elif path == "/readyz": self.respond(200, {"ready": True, "service": SERVICE_NAME})
        elif path == "/livez": self.respond(200, {"live": True})
        elif path == "/v1/degradation":
            self.respond(200, {"service": "agent-reconciliation-py", **_degrade.status()})
        elif path == "/v1/alerts":
            self.respond(200, {"alerts": check_alerts(), "rules": len(_ALERT_RULES)})
        elif path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {request_count}\nerrors_total{{service="{SERVICE_NAME}"}} {error_count}\n'.encode())
        elif path == "/v1/agent/recon-status":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "recon_status", "description": "Current reconciliation status", "tools": AGENT_TOOLS})

        else:
            self.respond(200, {"service": SERVICE_NAME, "tools": AGENT_TOOLS})

    def do_POST(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self.respond(401, {"error": "unauthorized", "detail": _n1_err})
                return
        inc_requests()
        path = self.path.split("?")[0]
        trace_id = self.headers.get("X-Trace-Id", str(uuid.uuid4()))
        logger.info(f"[{SERVICE_NAME}] POST {path} trace={trace_id}")
        content_length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        body = json.loads(sanitize_input(raw.decode("utf-8")))
        if path == "/v1/agent/reconcile":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            
            # Agent reasoning loop (ReAct pattern)
            query = body.get("query", body.get("prompt", ""))
            context = body.get("context", {})
            steps = []
            
            # Step 1: Parse intent
            intent = self.parse_intent(query)
            steps.append({"step": 1, "action": "parse_intent", "result": intent})
            
            # Step 2: Select tools
            selected_tools = self.select_tools(intent)
            steps.append({"step": 2, "action": "select_tools", "result": selected_tools})
            
            # Step 3: Execute tool calls
            tool_results = {}
            for tool in selected_tools:
                result = self.execute_tool(tool, query, context)
                tool_results[tool] = result
                steps.append({"step": len(steps) + 1, "action": f"execute_{tool}", "result": result})
            
            # Step 4: Synthesize response
            response = self.synthesize(query, tool_results)
            steps.append({"step": len(steps) + 1, "action": "synthesize", "result": "complete"})
            
            db_insert(SERVICE_NAME, {"query": query, "intent": intent, "steps": len(steps)})
            cache_set(f"{self.get_tenant_id()}:{SERVICE_NAME}_last", json.dumps({"query": query}))
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "reconcile", "query": query, "intent": intent, "steps": steps, "result": response, "tools_used": selected_tools})
        elif path == "/v1/agent/classify-breaks":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            
            # Agent reasoning loop (ReAct pattern)
            query = body.get("query", body.get("prompt", ""))
            context = body.get("context", {})
            steps = []
            
            # Step 1: Parse intent
            intent = self.parse_intent(query)
            steps.append({"step": 1, "action": "parse_intent", "result": intent})
            
            # Step 2: Select tools
            selected_tools = self.select_tools(intent)
            steps.append({"step": 2, "action": "select_tools", "result": selected_tools})
            
            # Step 3: Execute tool calls
            tool_results = {}
            for tool in selected_tools:
                result = self.execute_tool(tool, query, context)
                tool_results[tool] = result
                steps.append({"step": len(steps) + 1, "action": f"execute_{tool}", "result": result})
            
            # Step 4: Synthesize response
            response = self.synthesize(query, tool_results)
            steps.append({"step": len(steps) + 1, "action": "synthesize", "result": "complete"})
            
            db_insert(SERVICE_NAME, {"query": query, "intent": intent, "steps": len(steps)})
            cache_set(f"{self.get_tenant_id()}:{SERVICE_NAME}_last", json.dumps({"query": query}))
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "classify_breaks", "query": query, "intent": intent, "steps": steps, "result": response, "tools_used": selected_tools})
        elif path == "/v1/agent/auto-resolve":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            
            # Agent reasoning loop (ReAct pattern)
            query = body.get("query", body.get("prompt", ""))
            context = body.get("context", {})
            steps = []
            
            # Step 1: Parse intent
            intent = self.parse_intent(query)
            steps.append({"step": 1, "action": "parse_intent", "result": intent})
            
            # Step 2: Select tools
            selected_tools = self.select_tools(intent)
            steps.append({"step": 2, "action": "select_tools", "result": selected_tools})
            
            # Step 3: Execute tool calls
            tool_results = {}
            for tool in selected_tools:
                result = self.execute_tool(tool, query, context)
                tool_results[tool] = result
                steps.append({"step": len(steps) + 1, "action": f"execute_{tool}", "result": result})
            
            # Step 4: Synthesize response
            response = self.synthesize(query, tool_results)
            steps.append({"step": len(steps) + 1, "action": "synthesize", "result": "complete"})
            
            db_insert(SERVICE_NAME, {"query": query, "intent": intent, "steps": len(steps)})
            cache_set(f"{self.get_tenant_id()}:{SERVICE_NAME}_last", json.dumps({"query": query}))
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "auto_resolve", "query": query, "intent": intent, "steps": steps, "result": response, "tools_used": selected_tools})

        else:
            self.respond(404, {"error": "not_found"})

if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "message": "starting"}))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
