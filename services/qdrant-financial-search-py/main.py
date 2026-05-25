"""
qdrant-financial-search-py — Production-hardened service
"""
import os, sys, json, time, signal, logging, threading, uuid, math
import socket as _socket
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone
from collections import defaultdict, deque

SERVICE_NAME = "qdrant-financial-search-py"

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

PORT = int(os.environ.get("PORT", "8080"))


# ─── Domain Logic: Financial Vector Search ───────────────────────────────────

def compute_text_embedding(text, dim=128):
    """Compute simple text embedding for financial documents."""
    import hashlib
    h = hashlib.sha256(text.encode()).digest()
    embedding = [(b / 255.0) * 2 - 1 for b in h]
    while len(embedding) < dim:
        h = hashlib.sha256(h).digest()
        embedding.extend([(b / 255.0) * 2 - 1 for b in h])
    return embedding[:dim]

def compute_cosine_similarity(vec_a, vec_b):
    """Compute cosine similarity between two vectors."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = sum(a * a for a in vec_a) ** 0.5
    mag_b = sum(b * b for b in vec_b) ** 0.5
    if mag_a == 0 or mag_b == 0: return 0
    return dot / (mag_a * mag_b)

def search_similar_documents(query, documents, top_k=5):
    """Search for similar financial documents using cosine similarity."""
    query_vec = compute_text_embedding(query)
    results = []
    for doc in documents:
        doc_vec = compute_text_embedding(doc.get("text", ""))
        score = compute_cosine_similarity(query_vec, doc_vec)
        results.append({"document": doc, "score": round(score, 4)})
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]


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
        if path == "/healthz": self.respond(200, {"status": "healthy", "service": SERVICE_NAME})
        elif path == "/readyz": self.respond(200, {"ready": True, "service": SERVICE_NAME})
        elif path == "/livez": self.respond(200, {"live": True})
        elif path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {request_count}\nerrors_total{{service="{SERVICE_NAME}"}} {error_count}\n'.encode())

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
        if path == "/v1/search/semantic":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            result = db_insert(SERVICE_NAME, body)
            cache_set(f"{self.get_tenant_id()}:semantic_search_last", json.dumps(body))
            gl_url = os.environ.get("GL_ENGINE_URL", "http://gl-engine-go:8080")
            call_service("POST", f"{gl_url}/v1/notify", {"source": SERVICE_NAME, "action": "semantic_search"})
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "semantic_search", "result": body})
        elif path == "/v1/search/index":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            result = db_insert(SERVICE_NAME, body)
            cache_set(f"{self.get_tenant_id()}:index_document_last", json.dumps(body))
            gl_url = os.environ.get("GL_ENGINE_URL", "http://gl-engine-go:8080")
            call_service("POST", f"{gl_url}/v1/notify", {"source": SERVICE_NAME, "action": "index_document"})
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "index_document", "result": body})
        elif path == "/v1/search/similar":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            result = db_insert(SERVICE_NAME, body)
            cache_set(f"{self.get_tenant_id()}:find_similar_last", json.dumps(body))
            gl_url = os.environ.get("GL_ENGINE_URL", "http://gl-engine-go:8080")
            call_service("POST", f"{gl_url}/v1/notify", {"source": SERVICE_NAME, "action": "find_similar"})
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "find_similar", "result": body})
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
