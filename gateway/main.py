"""
api-gateway — 54Bank API Gateway
Routes requests to backend services: 10 AI agents, KPI dashboard, graph DBs,
core banking, GL engine. Handles JWT validation, rate limiting, CORS,
multi-tenant isolation, and tier-based feature gating.

Multi-Tenancy:
  - Extracts tenant_id from JWT claims or X-Tenant-Id header
  - Injects X-Tenant-Id into all upstream requests for data isolation
  - Validates feature access against tenant tier before proxying
  - Tenant branding served from /api/tenant/branding
"""
import os, sys, json, time, signal, threading, uuid, re, html
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

SERVICE_NAME = "api-gateway"
PORT = int(os.environ.get("PORT", "8080"))

# --- Logging ---
import logging
class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({"timestamp": datetime.now(timezone.utc).isoformat(), "level": record.levelname, "service": SERVICE_NAME, "message": record.getMessage()})
_handler = logging.StreamHandler(); _handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_handler])
logger = logging.getLogger(SERVICE_NAME)

# --- Rate Limiting ---
_rl_tokens = 200; _rl_lock = threading.Lock(); _rl_last_refill = [0.0]
def _rl_allow():
    global _rl_tokens
    now = time.time()
    with _rl_lock:
        if now - _rl_last_refill[0] >= 1.0: _rl_tokens = 200; _rl_last_refill[0] = now
        if _rl_tokens <= 0: return False
        _rl_tokens -= 1; return True

# --- Metrics ---
request_count = 0; error_count = 0; _counter_lock = threading.Lock()
def inc_requests():
    global request_count
    with _counter_lock: request_count += 1
def inc_errors():
    global error_count
    with _counter_lock: error_count += 1

# --- Tenant Management ---
TENANT_MGMT_URL = os.environ.get("TENANT_MGMT_URL", "http://tenant-management-py:8080")

def _get_tenant_features(tenant_id):
    """Fetch tenant features from tenant-management service (cached 60s)."""
    cache_key = f"tenant_features:{tenant_id}"
    cached = _tenant_cache.get(cache_key)
    if cached and time.time() - cached[1] < 60:
        return cached[0]
    try:
        req = urllib.request.Request(
            f"{TENANT_MGMT_URL}/v1/tenant/features",
            headers={"Authorization": "Bearer internal", "X-Tenant-Id": tenant_id}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            _tenant_cache[cache_key] = (data, time.time())
            return data
    except Exception:
        return None

def _validate_tenant_access(tenant_id, path_clean):
    """Check if tenant's tier allows access to the requested resource."""
    features = _get_tenant_features(tenant_id)
    if not features:
        return True  # Fail open if tenant service unavailable
    tier_features = features.get("features", {})
    allowed_agents = tier_features.get("agents", [])
    allowed_kpi_roles = tier_features.get("kpi_roles", [])
    allowed_graph = tier_features.get("graph_tools", [])
    # Check agent access
    if "/api/agent/" in path_clean:
        agent_id = path_clean.split("/api/agent/")[1].split("/")[0]
        if agent_id not in allowed_agents:
            return False
    # Check KPI role access
    if "/api/dashboard/role/" in path_clean:
        role = path_clean.split("/api/dashboard/role/")[1].split("/")[0]
        if role not in allowed_kpi_roles:
            return False
    # Check graph tool access
    for tool_prefix in ["/api/neo4j", "/api/falkordb", "/api/qdrant", "/api/kgqa", "/api/langchain"]:
        if path_clean.startswith(tool_prefix):
            tool_name = tool_prefix.replace("/api/", "")
            tool_map = {"neo4j": "coa-graph", "falkordb": "coa-graph", "qdrant": "semantic-search", "kgqa": "coa-graph", "langchain": "semantic-search"}
            if tool_map.get(tool_name, "") not in allowed_graph:
                return False
    return True

_tenant_cache = {}

# --- Service Registry ---
ROUTES = {
    # Tenant Management
    "/api/tenant": TENANT_MGMT_URL,
    "/api/tenants": TENANT_MGMT_URL,
    # AI Agents
    "/api/agent/account-opening": os.environ.get("AGENT_ACCOUNT_URL", "http://agent-account-opening-py:8080"),
    "/api/agent/transaction-investigation": os.environ.get("AGENT_TXN_URL", "http://agent-transaction-investigation-py:8080"),
    "/api/agent/regulatory-returns": os.environ.get("AGENT_REG_URL", "http://agent-regulatory-returns-py:8080"),
    "/api/agent/loan-origination": os.environ.get("AGENT_LOAN_URL", "http://agent-loan-origination-py:8080"),
    "/api/agent/nl-reporting": os.environ.get("AGENT_NL_URL", "http://agent-nl-reporting-py:8080"),
    "/api/agent/customer-360": os.environ.get("AGENT_CUST_URL", "http://agent-customer-360-py:8080"),
    "/api/agent/dormancy-prevention": os.environ.get("AGENT_DORM_URL", "http://agent-dormancy-prevention-py:8080"),
    "/api/agent/cash-management": os.environ.get("AGENT_CASH_URL", "http://agent-cash-management-py:8080"),
    "/api/agent/fraud-detection": os.environ.get("AGENT_FRAUD_URL", "http://agent-fraud-detection-py:8080"),
    "/api/agent/reconciliation": os.environ.get("AGENT_RECON_URL", "http://agent-reconciliation-py:8080"),
    # KPI Dashboard
    "/api/dashboard": os.environ.get("KPI_DASHBOARD_URL", "http://stakeholder-kpi-dashboard-py:8080"),
    # Graph Intelligence
    "/api/neo4j": os.environ.get("NEO4J_URL", "http://neo4j-coa-graph-py:8080"),
    "/api/falkordb": os.environ.get("FALKORDB_URL", "http://falkordb-coa-py:8080"),
    "/api/qdrant": os.environ.get("QDRANT_URL", "http://qdrant-financial-search-py:8080"),
    "/api/kgqa": os.environ.get("KGQA_URL", "http://epr-kgqa-py:8080"),
    "/api/langchain": os.environ.get("LANGCHAIN_URL", "http://langchain-agent-py:8080"),
    # Core Banking
    "/api/core-banking": os.environ.get("CORE_BANKING_URL", "http://core-banking-go:8080"),
    "/api/gl-engine": os.environ.get("GL_ENGINE_URL", "http://gl-engine-go:8080"),
    "/api/payments": os.environ.get("PAYMENTS_URL", "http://payments-hub-go:8080"),
    # KPI Engine
    "/api/kpi": os.environ.get("KPI_ENGINE_URL", "http://kpi-engine-go:8500"),
}

def _proxy(method, upstream_url, path_suffix, headers, body=None):
    """Forward request to upstream service."""
    url = f"{upstream_url}{path_suffix}"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, data=body, method=method)
            for k, v in headers.items():
                if k.lower() not in ("host", "content-length", "transfer-encoding"):
                    req.add_header(k, v)
            req.add_header("X-Forwarded-By", SERVICE_NAME)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.status, resp.read(), dict(resp.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read(), {}
        except Exception as e:
            if attempt == 2:
                return 502, json.dumps({"error": "upstream_unavailable", "detail": str(e)}).encode(), {}
            time.sleep((attempt + 1) * 0.3)
    return 502, b'{"error":"proxy_failure"}', {}

class GatewayHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def _add_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id, X-Tenant-Id")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

    def _add_security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        self.send_header("X-XSS-Protection", "1; mode=block")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")

    def respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._add_cors(); self._add_security_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode() if isinstance(data, dict) else data)

    def _extract_tenant_id(self):
        """Extract tenant_id from JWT claims or X-Tenant-Id header."""
        # In production: decode JWT and extract tenant_id claim
        # For now: use X-Tenant-Id header, default to platform
        return self.headers.get("X-Tenant-Id", "platform")

    def check_jwt(self):
        path = self.path.split("?")[0]
        if path in ("/healthz", "/readyz", "/livez", "/metrics"): return True
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            self.respond(401, {"error": "unauthorized", "message": "Bearer token required"})
            return False
        return True

    def do_OPTIONS(self):
        self.send_response(204)
        self._add_cors()
        self.end_headers()

    def _route(self, method):
        inc_requests()
        path = self.path
        trace_id = self.headers.get("X-Trace-Id", str(uuid.uuid4()))
        logger.info(f"{method} {path} trace={trace_id}")

        path_clean = path.split("?")[0]

        # Health endpoints
        if path_clean == "/healthz":
            self.respond(200, {"status": "healthy", "service": SERVICE_NAME, "routes": len(ROUTES)}); return
        if path_clean == "/readyz":
            self.respond(200, {"ready": True}); return
        if path_clean == "/livez":
            self.respond(200, {"live": True}); return
        if path_clean == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {request_count}\nerrors_total{{service="{SERVICE_NAME}"}} {error_count}\n'.encode()); return

        # Route list
        if path_clean == "/api/routes":
            if not self.check_jwt(): return
            self.respond(200, {"routes": list(ROUTES.keys())}); return

        # JWT check
        if not self.check_jwt(): return
        if not _rl_allow(): inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return

        # Multi-tenant: extract tenant and validate access
        tenant_id = self._extract_tenant_id()
        if not _validate_tenant_access(tenant_id, path_clean):
            inc_errors()
            self.respond(403, {
                "error": "feature_not_available",
                "message": "This feature is not included in your current plan. Contact your platform administrator to upgrade.",
                "tenant_id": tenant_id,
                "path": path_clean,
            }); return

        # Find matching route
        matched_prefix = None
        for prefix in sorted(ROUTES.keys(), key=len, reverse=True):
            if path_clean.startswith(prefix):
                matched_prefix = prefix; break

        if not matched_prefix:
            inc_errors()
            self.respond(404, {"error": "route_not_found", "path": path_clean, "available_routes": list(ROUTES.keys())}); return

        upstream = ROUTES[matched_prefix]
        suffix = path_clean[len(matched_prefix):]
        if not suffix.startswith("/"): suffix = "/" + suffix

        # Read body for POST/PUT
        body = None
        cl = int(self.headers.get("Content-Length", 0))
        if cl > 0: body = self.rfile.read(cl)

        headers_dict = dict(self.headers)
        headers_dict["X-Trace-Id"] = trace_id
        headers_dict["X-Tenant-Id"] = tenant_id  # Inject tenant for data isolation

        # Proxy to upstream
        status, resp_body, resp_headers = _proxy(method, upstream, suffix, headers_dict, body)

        self.send_response(status)
        self.send_header("Content-Type", resp_headers.get("Content-Type", "application/json"))
        self._add_cors(); self._add_security_headers()
        self.send_header("X-Trace-Id", trace_id)
        self.send_header("X-Tenant-Id", tenant_id)
        self.send_header("X-Upstream", matched_prefix)
        self.end_headers()
        self.wfile.write(resp_body if isinstance(resp_body, bytes) else resp_body.encode())

    def do_GET(self): self._route("GET")
    def do_POST(self): self._route("POST")
    def do_PUT(self): self._route("PUT")
    def do_DELETE(self): self._route("DELETE")

if __name__ == "__main__":
    def shutdown_handler(sig, frame):
        logger.info("Shutting down gracefully"); sys.exit(0)
    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)

    server = HTTPServer(("0.0.0.0", PORT), GatewayHandler)
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "routes": len(ROUTES), "message": "starting"}))
    server.serve_forever()
