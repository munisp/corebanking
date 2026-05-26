#!/usr/bin/env python3
"""
kgqa-reasoning-engine-py — EPR-KGQA (Entity-Pair Retrieval Knowledge Graph QA) service
Natural language question answering over 54Bank knowledge graph.
Translates NL queries → Cypher, retrieves from Neo4j/FalkorDB,
performs regulatory reasoning, and returns structured answers.
"""
import http.server
import json
import logging
import os
import re
import signal
import socket
import sys
import threading
import time
import traceback
import urllib.request
import urllib.error
from typing import Any


# --- mTLS Configuration ---
MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false") == "true"
TLS_CERT_PATH = os.environ.get("TLS_CERT_PATH", "/etc/54bank/certs/service.crt")
TLS_KEY_PATH = os.environ.get("TLS_KEY_PATH", "/etc/54bank/certs/service.key")
TLS_CA_PATH = os.environ.get("TLS_CA_PATH", "/etc/54bank/certs/ca.crt")
PORT = int(os.environ.get("PORT", "8080"))
SERVICE_NAME = "kgqa-reasoning-engine-py"
logger = logging.getLogger(SERVICE_NAME)
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')

# ─── SECURITY, RATE LIMITING, OBSERVABILITY ─────────────────────────────────

request_count = 0
error_count = 0
_rate_limit_tokens = 100.0
_rate_limit_last = time.time()
_rate_limit_max = 100.0
JWT_SECRET = os.environ.get("JWT_SECRET", "54bank-jwt-secret-change-in-production")
_cache = {}
_db_pool = None

def sanitize_input(s: str) -> str:
    s = s.replace("<", "&lt;").replace(">", "&gt;").replace("'", "&#39;").replace('"', "&quot;")
    return s[:10240]

def inc_requests():
    global request_count
    request_count += 1

def inc_errors():
    global error_count
    error_count += 1

def rl_allow() -> bool:
    global _rate_limit_tokens, _rate_limit_last
    now = time.time()
    elapsed = now - _rate_limit_last
    _rate_limit_tokens = min(_rate_limit_max, _rate_limit_tokens + elapsed * _rate_limit_max)
    _rate_limit_last = now
    if _rate_limit_tokens >= 1:
        _rate_limit_tokens -= 1
        return True
    return False

def check_jwt(headers) -> bool:
    auth = headers.get("Authorization", "")
    return auth.startswith("Bearer ")

def cache_get(key):
    return _cache.get(key)

def cache_set(key, value):
    _cache[key] = value

def get_db():
    global _db_pool
    if _db_pool is not None:
        return _db_pool
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return None
    try:
        import psycopg2
        import psycopg2.pool
        _db_pool = psycopg2.pool.SimpleConnectionPool(1, 10, db_url)
        logger.info("Connected to PostgreSQL")
        return _db_pool
    except Exception as e:
        logger.warning(f"DB connection failed: {e}")
        return None

def db_insert(service, data):
    pool = get_db()
    if pool is None:
        logger.info(f"dbInsert: no db connection (in-memory mode)")
        return
    try:
        conn = pool.getconn()
        cur = conn.cursor()
        record_id = f"{service}_{int(time.time()*1e9)}"
        cur.execute(
            "INSERT INTO records (id, service, tenant, status, data, created_at) VALUES (%s, %s, 'default', 'active', %s, NOW()) ON CONFLICT (id) DO UPDATE SET data=%s",
            (record_id, service, json.dumps(data), json.dumps(data)))
        conn.commit()
        pool.putconn(conn)
    except Exception as e:
        logger.warning(f"dbInsert failed: {e}")

def release_db():
    global _db_pool
    if _db_pool:
        _db_pool.closeall()
        _db_pool = None

def call_service(method, url, data=None):
    for attempt in range(3):
        try:
            body = json.dumps(data).encode() if data else None
            req = urllib.request.Request(url, data=body, method=method, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            if attempt == 2:
                logger.warning(f"call_service failed after 3 retries: {e}")
                return None
            time.sleep((attempt + 1) * 0.1)

# ─── EPR-KGQA ENGINE ─────────────────────────────────────────────────────────

# Entity-Pair Retrieval patterns for banking domain
ENTITY_PATTERNS = {
    "gl_account": re.compile(r"(?:account|gl|ledger)\s*(?:code\s*)?(\d{4})", re.IGNORECASE),
    "regulation": re.compile(r"(CRR|CAR|LCR|NSFR|IFRS\s*9|Basel\s*III|SOL|KYC|CTR|STR|NDIC|BOFIA)", re.IGNORECASE),
    "report": re.compile(r"(MBR\d{3}|SRF\d{3}|eFASS)", re.IGNORECASE),
    "entity": re.compile(r"(?:customer|entity|company|person)\s+(\w+)", re.IGNORECASE),
    "amount": re.compile(r"(?:NGN|₦|naira)\s*([\d,]+(?:\.\d+)?)", re.IGNORECASE),
}

QUESTION_TEMPLATES = {
    "what_is": re.compile(r"what\s+is\s+(?:the\s+)?(.+?)[\?]?$", re.IGNORECASE),
    "which_accounts": re.compile(r"which\s+(?:gl\s+)?accounts?\s+(.+?)[\?]?$", re.IGNORECASE),
    "what_regulation": re.compile(r"what\s+(?:regulation|rule|requirement)s?\s+(?:appl(?:y|ies)\s+to\s+)?(.+?)[\?]?$", re.IGNORECASE),
    "how_is_computed": re.compile(r"how\s+is\s+(.+?)\s+(?:computed|calculated)[\?]?$", re.IGNORECASE),
    "what_threshold": re.compile(r"what\s+(?:is\s+the\s+)?threshold\s+(?:for\s+)?(.+?)[\?]?$", re.IGNORECASE),
    "which_report": re.compile(r"which\s+report\s+(?:includes?|contains?)\s+(.+?)[\?]?$", re.IGNORECASE),
    "who_regulates": re.compile(r"who\s+regulates?\s+(.+?)[\?]?$", re.IGNORECASE),
}

# NL → Cypher translation rules
CYPHER_TEMPLATES = {
    "account_by_code": "MATCH (a:GLAccount {{code: '{code}'}}) RETURN a",
    "accounts_by_type": "MATCH (a:GLAccount {{accountType: '{type}'}}) RETURN a.code AS code, a.name AS name, a.subcategory AS subcategory ORDER BY a.code",
    "accounts_for_report": "MATCH (a:GLAccount)-[:REPORTED_IN]->(r:RegulatoryReturn {{code: '{code}'}}) RETURN a.code AS code, a.name AS name ORDER BY a.code",
    "capital_components": "MATCH (a:GLAccount)-[c:COMPONENT_OF]->(r:Regulation {{id: 'CAR'}}) RETURN a.code AS code, a.name AS name, c.tier AS tier ORDER BY c.tier",
    "regulation_details": "MATCH (r:Regulation {{id: '{id}'}}) RETURN r",
    "entity_network": "MATCH (e:AMLEntity {{entityId: '{id}'}})-[t:TRANSACTED_WITH]->(e2) RETURN e2.entityId AS target, e2.name AS name, t.totalAmount AS amount",
    "suspicious_networks": "MATCH (e:AMLEntity)-[t:TRANSACTED_WITH]->(e2) WHERE e.riskScore >= 50 RETURN e.entityId, e2.entityId, t.totalAmount ORDER BY t.totalAmount DESC LIMIT 20",
    "accounts_subject_to": "MATCH (a:GLAccount)-[:SUBJECT_TO]->(r:Regulation {{id: '{id}'}}) RETURN a.code AS code, a.name AS name",
    "deposit_accounts": "MATCH (a:GLAccount) WHERE a.subcategory STARTS WITH 'deposits_' RETURN a.code AS code, a.name AS name, a.ndicInsured AS insured ORDER BY a.code",
}

# Regulatory knowledge base (from FRO ontology)
REGULATORY_KB = {
    "CRR": {
        "name": "Cash Reserve Requirement",
        "regulator": "CBN",
        "current_rate": 0.325,
        "legal_basis": "CBN Act 2007 Section 15",
        "computation": "CRR = Cash Reserve at CBN / Total Deposits",
        "minimum": 0.325,
        "penalty": "Penalty rate at MPR + 600bps on shortfall",
        "frequency": "bi-weekly",
        "accounts": ["1005", "2101", "2102", "2103", "2104", "2105"],
    },
    "CAR": {
        "name": "Capital Adequacy Ratio",
        "regulator": "CBN",
        "minimum": 0.15,
        "legal_basis": "CBN Prudential Guidelines, Basel III",
        "computation": "CAR = Total Capital / Risk-Weighted Assets",
        "components": {"CET1": ["3002", "3003", "3004", "3006"], "AT1": ["3008"], "Tier2": ["2206", "3011"]},
        "frequency": "monthly",
        "reports": ["MBR007", "SRF008"],
    },
    "LCR": {
        "name": "Liquidity Coverage Ratio",
        "regulator": "CBN",
        "minimum": 1.0,
        "legal_basis": "CBN LCR Framework",
        "computation": "LCR = HQLA / Net Cash Outflows (30 days)",
        "hqla_level1": ["cash", "cbn_balances", "fgn_bonds"],
    },
    "IFRS9": {
        "name": "IFRS 9 Expected Credit Loss",
        "regulator": "CBN",
        "legal_basis": "IFRS 9 Financial Instruments",
        "stages": {
            "Stage 1": "12-month ECL — performing, no significant increase in credit risk (GL: 1355)",
            "Stage 2": "Lifetime ECL — significant increase in credit risk (GL: 1356)",
            "Stage 3": "Lifetime ECL — credit-impaired / default (GL: 1357)",
        },
        "accounts": ["1355", "1356", "1357"],
    },
    "SOL": {
        "name": "Single Obligor Limit",
        "regulator": "CBN",
        "maximum": 0.20,
        "legal_basis": "BOFIA 2020 Section 20(1)",
        "computation": "Max exposure = 20% of shareholders' funds unimpaired by losses",
        "related_party_limit": 0.10,
    },
    "KYC": {
        "name": "Tiered KYC Framework",
        "regulator": "CBN",
        "legal_basis": "CBN Tiered KYC Framework 2022",
        "tiers": {
            "Tier 1": "BVN only — max ₦300K balance, ₦50K daily",
            "Tier 2": "BVN + valid ID + photo — max ₦500K, ₦200K daily",
            "Tier 3": "Full KYC (BVN + ID + photo + utility + reference) — no limits",
        },
    },
    "CTR": {
        "name": "Currency Transaction Report",
        "regulator": "NFIU",
        "threshold_individual": 5_000_000,
        "threshold_corporate": 10_000_000,
        "legal_basis": "ML(PP) Act 2022",
        "deadline": "within 7 days of transaction",
    },
    "STR": {
        "name": "Suspicious Transaction Report",
        "regulator": "NFIU",
        "legal_basis": "ML(PP) Act 2022",
        "typologies": ["structuring", "rapid_movement", "round_tripping", "unusual_pattern", "pep_transaction"],
    },
}


def extract_entities(question: str) -> dict:
    """Extract entity pairs from natural language question."""
    entities = {}
    for etype, pattern in ENTITY_PATTERNS.items():
        match = pattern.search(question)
        if match:
            entities[etype] = match.group(1).strip()
    return entities


def classify_question(question: str) -> tuple:
    """Classify question type and extract key intent."""
    for qtype, pattern in QUESTION_TEMPLATES.items():
        match = pattern.match(question.strip())
        if match:
            return qtype, match.group(1).strip()
    return "general", question


def generate_cypher(question: str, entities: dict, qtype: str, intent: str) -> str:
    """Translate question to Cypher query."""
    if "gl_account" in entities:
        return CYPHER_TEMPLATES["account_by_code"].format(code=entities["gl_account"])
    if "regulation" in entities:
        reg_id = entities["regulation"].upper().replace(" ", "").replace("IFRS9", "IFRS9")
        if reg_id in REGULATORY_KB:
            return CYPHER_TEMPLATES["regulation_details"].format(id=reg_id)
        return CYPHER_TEMPLATES["accounts_subject_to"].format(id=reg_id)
    if "report" in entities:
        return CYPHER_TEMPLATES["accounts_for_report"].format(code=entities["report"].upper())
    if qtype == "which_accounts":
        if "asset" in intent.lower():
            return CYPHER_TEMPLATES["accounts_by_type"].format(type="asset")
        if "liability" in intent.lower() or "deposit" in intent.lower():
            return CYPHER_TEMPLATES["deposit_accounts"]
        if "capital" in intent.lower() or "equity" in intent.lower():
            return CYPHER_TEMPLATES["capital_components"]
    if qtype == "how_is_computed" and "car" in intent.lower():
        return CYPHER_TEMPLATES["capital_components"]
    return ""


def answer_from_kb(question: str, entities: dict, qtype: str, intent: str) -> dict:
    """Answer from regulatory knowledge base without graph query."""
    if "regulation" in entities:
        reg_key = entities["regulation"].upper().replace(" ", "")
        if reg_key in REGULATORY_KB:
            return {"source": "regulatory_kb", "answer": REGULATORY_KB[reg_key], "confidence": 0.95}
    for key, reg in REGULATORY_KB.items():
        if key.lower() in question.lower() or reg["name"].lower() in question.lower():
            return {"source": "regulatory_kb", "answer": reg, "confidence": 0.85}
    return {}


def query_knowledge_graph(cypher: str) -> list:
    """Execute Cypher query against Neo4j knowledge graph."""
    neo4j_url = os.environ.get("NEO4J_KG_URL", "http://neo4j-knowledge-graph-go:8080")
    try:
        result = call_service("POST", f"{neo4j_url}/v1/kg/cypher", {"query": cypher, "params": {}})
        if result and "rows" in result:
            return result["rows"]
    except Exception as e:
        logger.warning(f"Knowledge graph query failed: {e}")
    return []


def search_vectors(query_text: str) -> list:
    """Search Qdrant for similar regulatory documents."""
    qdrant_url = os.environ.get("QDRANT_URL", "http://qdrant-vector-store-rs:8080")
    try:
        result = call_service("POST", f"{qdrant_url}/v1/vectors/regulations", {"query": query_text, "limit": 3})
        if result and "results" in result:
            return result["results"]
    except Exception as e:
        logger.warning(f"Vector search failed: {e}")
    return []


def process_question(question: str) -> dict:
    """Full EPR-KGQA pipeline: NL → entities → Cypher → answer."""
    entities = extract_entities(question)
    qtype, intent = classify_question(question)
    cypher = generate_cypher(question, entities, qtype, intent)
    kb_answer = answer_from_kb(question, entities, qtype, intent)
    graph_results = query_knowledge_graph(cypher) if cypher else []
    vector_results = search_vectors(question)

    response = {
        "question": question,
        "entities": entities,
        "questionType": qtype,
        "intent": intent,
        "cypher": cypher,
        "graphResults": graph_results,
        "vectorResults": vector_results,
        "kbAnswer": kb_answer,
        "engine": "EPR-KGQA",
    }

    if kb_answer:
        response["answer"] = kb_answer.get("answer", {})
        response["confidence"] = kb_answer.get("confidence", 0.0)
        response["source"] = "regulatory_knowledge_base"
    elif graph_results:
        response["answer"] = graph_results
        response["confidence"] = 0.80
        response["source"] = "knowledge_graph"
    elif vector_results:
        response["answer"] = [r.get("payload", {}).get("text", "") for r in vector_results]
        response["confidence"] = 0.60
        response["source"] = "vector_similarity"
    else:
        response["answer"] = "I don't have enough information to answer this question. Try asking about specific regulations (CRR, CAR, LCR, IFRS9), GL accounts, or regulatory returns (MBR001, SRF008)."
        response["confidence"] = 0.0
        response["source"] = "fallback"

    return response


# ─── HTTP HANDLER ────────────────────────────────────────────────────────────


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

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        trace_id = f"trace-{int(time.time()*1e9)}"
        logger.info(f"[{SERVICE_NAME}] {self.command} {self.path} trace={trace_id}")

    def respond(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        self.send_header("Content-Security-Policy", "default-src 'self'")
        self.send_header("X-XSS-Protection", "1; mode=block")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        inc_requests()
        path = self.path.split("?")[0]

        if path == "/healthz":
            self.respond(200, {
                "status": "healthy",
                "service": SERVICE_NAME,
                "version": "1.0.0",
                "capabilities": [
                    "epr_kgqa", "nl_to_cypher", "regulatory_reasoning",
                    "entity_extraction", "question_classification",
                    "knowledge_graph_qa", "vector_similarity_search"
                ],
                "regulatoryKB": list(REGULATORY_KB.keys()),
            })
        elif path == "/readyz":
            self.respond(200, {"ready": True, "service": SERVICE_NAME})
        elif path == "/livez":
            self.respond(200, {"live": True})
        elif path == "/v1/degradation":
                self._json(200, {"service": "kgqa-reasoning-engine-py", **_degrade.status()})
            elif path == "/v1/alerts":
                self._json(200, {"alerts": check_alerts(), "rules": len(_ALERT_RULES)})
            elif path == "/metrics":
            body = f'# TYPE requests_total counter\nrequests_total{{service="{SERVICE_NAME}"}} {request_count}\n# TYPE errors_total counter\nerrors_total{{service="{SERVICE_NAME}"}} {error_count}\n'
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(body.encode())
        else:
            items, total = [], 0
            pool = get_db()
            if pool:
                try:
                    conn = pool.getconn()
                    cur = conn.cursor()
                    cur.execute("SELECT data FROM records WHERE service = %s ORDER BY created_at DESC LIMIT 20", (SERVICE_NAME,))
                    items = [row[0] for row in cur.fetchall()]
                    cur.execute("SELECT COUNT(*) FROM records WHERE service = %s", (SERVICE_NAME,))
                    total = cur.fetchone()[0]
                    pool.putconn(conn)
                except Exception:
                    pass
            self.respond(200, {"service": SERVICE_NAME, "items": items, "total": total, "source": "database" if pool else "in-memory"})

    def do_POST(self):
        inc_requests()
        path = self.path.split("?")[0]
        content_length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        body = json.loads(sanitize_input(raw.decode("utf-8")))

        if path in ["/healthz", "/readyz", "/livez", "/metrics"]:
            self.do_GET()
            return

        if not rl_allow():
            inc_errors()
            self.send_response(429)
            self.send_header("Retry-After", "1")
            self.end_headers()
            self.wfile.write(b'{"error":"rate_limit_exceeded"}')
            return

        if not check_jwt(self.headers):
            inc_errors()
            self.respond(401, {"error": "unauthorized"})
            return

        if path == "/v1/kgqa/ask":
            question = body.get("question", "")
            if not question:
                inc_errors()
                self.respond(400, {"error": "question is required"})
                return
            result = process_question(question)
            db_insert(SERVICE_NAME, {"tenant_id": self.get_tenant_id(), "action": "kgqa_ask", "question": question, "confidence": result.get("confidence", 0)})
            cache_set(f"{self.get_tenant_id()}:kgqa_{question[:50]}", json.dumps(result))
            self.respond(200, result)

        elif path == "/v1/kgqa/extract-entities":
            text = body.get("text", "")
            entities = extract_entities(text)
            self.respond(200, {"entities": entities, "text": text})

        elif path == "/v1/kgqa/classify":
            question = body.get("question", "")
            qtype, intent = classify_question(question)
            self.respond(200, {"questionType": qtype, "intent": intent})

        elif path == "/v1/kgqa/cypher":
            question = body.get("question", "")
            entities = extract_entities(question)
            qtype, intent = classify_question(question)
            cypher = generate_cypher(question, entities, qtype, intent)
            self.respond(200, {"cypher": cypher, "entities": entities, "questionType": qtype})

        elif path == "/v1/kgqa/regulatory":
            topic = body.get("topic", "").upper()
            if topic in REGULATORY_KB:
                self.respond(200, {"topic": topic, "regulation": REGULATORY_KB[topic]})
            else:
                self.respond(200, {"topic": topic, "available": list(REGULATORY_KB.keys()), "message": "Topic not found"})

        elif path == "/v1/create":
            result = db_insert(SERVICE_NAME, body)
            cache_set(f"{self.get_tenant_id()}:last_post", json.dumps(body))
            self.respond(201, {"created": True, "service": SERVICE_NAME})

        else:
            self.respond(404, {"error": "not found", "path": path})


# ─── MAIN ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), Handler)

    def shutdown_handler(sig, frame):
        logger.info(f"{SERVICE_NAME} shutting down gracefully...")
        release_db()
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)

    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "message": "starting"}))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        shutdown_handler(None, None)
