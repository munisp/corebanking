"""
agent-reconciliation-py — Automated Reconciliation Agent — reconciles GL to sub-ledgers, classifies breaks, auto-resolves timing items
Agentic AI service using ReAct pattern with tool orchestration.
"""
import os, sys, json, time, signal, logging, threading, uuid, math, re
import socket as _socket
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone
from collections import defaultdict

SERVICE_NAME = "agent-reconciliation-py"
AGENT_TOOLS = ["gl_engine", "core_banking", "neo4j_graph", "falkordb"]

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

PORT = int(os.environ.get("PORT", "8080"))

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
        inc_requests()
        path = self.path.split("?")[0]
        trace_id = self.headers.get("X-Trace-Id", str(uuid.uuid4()))
        logger.info(f"[{SERVICE_NAME}] GET {path} trace={trace_id}")
        if path == "/healthz": self.respond(200, {"status": "healthy", "service": SERVICE_NAME, "tools": AGENT_TOOLS})
        elif path == "/readyz": self.respond(200, {"ready": True, "service": SERVICE_NAME})
        elif path == "/livez": self.respond(200, {"live": True})
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
    def shutdown_handler(sig, frame):
        logger.info("Shutting down gracefully"); sys.exit(0)
    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "message": "starting", "tools": AGENT_TOOLS}))
    server.serve_forever()
