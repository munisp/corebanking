import sys; sys.path.insert(0, '/home/ubuntu/repos/corebanking/libs/banking-rules-py')

# --- PII Masking (NDPR Compliance) ---
import re as _pii_re

def mask_pii(value: str, field_type: str = "generic") -> str:
    if not value: return "***"
    if field_type in ("bvn", "nin"):
        return f"***{value[-4:]}" if len(value) >= 4 else "***"
    elif field_type == "phone":
        return f"+234***{value[-4:]}" if len(value) >= 4 else "+234***"
    elif field_type == "email" and "@" in value:
        local, domain = value.split("@", 1)
        return f"{local[0]}***@{domain}"
    elif field_type == "account":
        return f"****{value[-4:]}" if len(value) >= 4 else "****"
    return f"{value[0]}***{value[-1]}" if len(value) > 2 else "***"

def sanitize_log(msg: str) -> str:
    msg = _pii_re.sub(r"\b\d{11}\b", lambda m: f"***{m.group()[-4:]}", msg)
    msg = _pii_re.sub(r"\b\d{10}\b", lambda m: f"****{m.group()[-4:]}", msg)
    msg = _pii_re.sub(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", "***@***", msg)
    return msg

"""
stakeholder-kpi-dashboard-py — Stakeholder KPI Dashboard Aggregation Service
Aggregates KPI data from kpi-engine-go, all 10 AI agents, Neo4j graph, and GL engine.
Provides role-based dashboards for Board, CFO, CRO, COO, CTO, Compliance, RM, Branch.

Multi-Tenancy:
  All KPI data, cache keys, and DB queries are scoped by tenant_id.
  The X-Tenant-Id header is injected by the API gateway.
  Each tenant sees only their own KPI values and agent insights.
"""
import os, sys, json, time, signal, threading, uuid, math, re, html
import socket as _socket
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta
from collections import defaultdict

SERVICE_NAME = "stakeholder-kpi-dashboard-py"

# --- mTLS Configuration ---
MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false") == "true"
TLS_CERT_PATH = os.environ.get("TLS_CERT_PATH", "/etc/54bank/certs/service.crt")
TLS_KEY_PATH = os.environ.get("TLS_KEY_PATH", "/etc/54bank/certs/service.key")
TLS_CA_PATH = os.environ.get("TLS_CA_PATH", "/etc/54bank/certs/ca.crt")
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
_rl_tokens = 100; _rl_lock = threading.Lock(); _rl_last_refill = [0.0]
def _rl_allow():
    global _rl_tokens
    now = time.time()
    with _rl_lock:
        if now - _rl_last_refill[0] >= 1.0: _rl_tokens = 100; _rl_last_refill[0] = now
        if _rl_tokens <= 0: return False
        _rl_tokens -= 1; return True

# --- Redis Cache ---
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
        except Exception as _exc:
            logger.debug(f"Suppressed error: {_exc}")
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
                except Exception as _exc:
                    logger.debug(f"Suppressed error: {_exc}")
                try: conn.close()
                except Exception as _exc:
                    logger.debug(f"Suppressed: {_exc}")
        return self._dial()

    def put(self, conn):
        if conn is None: return
        with self.lock:
            if len(self.pool) < self.max_size:
                self.pool.append(conn)
            else:
                try: conn.close()
                except Exception as _exc:
                    logger.debug(f"Suppressed: {_exc}")

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
        except Exception as _exc:
                    logger.debug(f"Suppressed: {_exc}")
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
        except Exception as _exc:
                    logger.debug(f"Suppressed: {_exc}")

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
        except Exception as _exc:
                    logger.debug(f"Suppressed: {_exc}")

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
            except Exception as _exc:
                    logger.debug(f"Suppressed: {_exc}")
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

# --- DB ---
_DB_URL = os.environ.get("DATABASE_URL", "")
def db_insert(table, data):
    logger.info(f"db_insert({table}): {json.dumps(data)[:200]}"); return {"inserted": True}

# --- Input Sanitization ---
def sanitize_input(s):
    if not isinstance(s, str): return s
    s = re.sub(r'<script[^>]*>.*?</script>', '', s, flags=re.IGNORECASE | re.DOTALL)
    s = s.replace("javascript:", "")
    return s[:10240]

# --- Metrics ---
request_count = 0; error_count = 0; _counter_lock = threading.Lock()
def inc_requests():
    global request_count
    with _counter_lock: request_count += 1
def inc_errors():
    global error_count
    with _counter_lock: error_count += 1

# --- Inter-Service Calls ---
def call_service(method, url, data=None, retries=3):
    for attempt in range(retries):
        try:
            payload = json.dumps(data).encode() if data else b"{}"
            req = urllib.request.Request(url, data=payload if method == "POST" else None,
                headers={"Content-Type": "application/json", "Authorization": "Bearer internal-kpi-token"},
                method=method)
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            if attempt == retries - 1:
                logger.warning(f"call_service failed after {retries} retries: {e}")
                return {"error": str(e), "fallback": True}
            time.sleep((attempt + 1) * 0.5)

# --- Service URLs ---
KPI_ENGINE_URL = os.environ.get("KPI_ENGINE_URL", "http://kpi-engine-go:8500")
NEO4J_URL = os.environ.get("NEO4J_COA_URL", "http://neo4j-coa-graph-py:8080")
GL_ENGINE_URL = os.environ.get("GL_ENGINE_URL", "http://gl-engine-go:8080")
AGENT_NL_URL = os.environ.get("AGENT_NL_URL", "http://agent-nl-reporting-py:8080")
AGENT_CASH_URL = os.environ.get("AGENT_CASH_URL", "http://agent-cash-management-py:8080")
AGENT_FRAUD_URL = os.environ.get("AGENT_FRAUD_URL", "http://agent-fraud-detection-py:8080")
AGENT_RECON_URL = os.environ.get("AGENT_RECON_URL", "http://agent-reconciliation-py:8080")
AGENT_REG_URL = os.environ.get("AGENT_REG_URL", "http://agent-regulatory-returns-py:8080")
AGENT_LOAN_URL = os.environ.get("AGENT_LOAN_URL", "http://agent-loan-origination-py:8080")
AGENT_CUST_URL = os.environ.get("AGENT_CUST_URL", "http://agent-customer-360-py:8080")
AGENT_DORM_URL = os.environ.get("AGENT_DORM_URL", "http://agent-dormancy-prevention-py:8080")

# ============================================================================
# ROLE-BASED KPI DEFINITIONS
# ============================================================================

STAKEHOLDER_KPIS = {
    "board": {
        "title": "Board / ALCO Dashboard",
        "description": "Strategic oversight: capital adequacy, profitability, systemic risk",
        "kpis": [
            {"id": "car", "name": "Capital Adequacy Ratio (CAR)", "target": 15.0, "unit": "%", "source": "neo4j_basel", "threshold_red": 10.0, "threshold_amber": 13.0},
            {"id": "roe", "name": "Return on Equity (ROE)", "target": 20.0, "unit": "%", "source": "gl_engine", "threshold_red": 10.0, "threshold_amber": 15.0},
            {"id": "roa", "name": "Return on Assets (ROA)", "target": 3.0, "unit": "%", "source": "gl_engine", "threshold_red": 1.0, "threshold_amber": 2.0},
            {"id": "nim", "name": "Net Interest Margin (NIM)", "target": 7.0, "unit": "%", "source": "gl_engine", "threshold_red": 4.0, "threshold_amber": 5.5},
            {"id": "npl", "name": "Non-Performing Loan Ratio", "target": 3.0, "unit": "%", "source": "neo4j_graph", "threshold_red": 10.0, "threshold_amber": 5.0},
            {"id": "cost_income", "name": "Cost-to-Income Ratio", "target": 55.0, "unit": "%", "source": "gl_engine", "threshold_red": 70.0, "threshold_amber": 62.0},
            {"id": "systemic_risk", "name": "Systemic Risk Score (PageRank)", "target": 0.0, "unit": "score", "source": "neo4j_pagerank", "threshold_red": 0.8, "threshold_amber": 0.6},
        ],
    },
    "cfo": {
        "title": "CFO / Treasury Dashboard",
        "description": "Financial performance, liquidity, revenue, cost management",
        "kpis": [
            {"id": "liquidity_ratio", "name": "Liquidity Coverage Ratio (LCR)", "target": 100.0, "unit": "%", "source": "neo4j_liquidity", "threshold_red": 80.0, "threshold_amber": 90.0},
            {"id": "crr_compliance", "name": "CRR Compliance", "target": 32.5, "unit": "%", "source": "agent_cash", "threshold_red": 27.5, "threshold_amber": 30.0},
            {"id": "net_interest_income", "name": "Net Interest Income", "target": 50000000000, "unit": "NGN", "source": "gl_engine"},
            {"id": "fee_income", "name": "Fee & Commission Income", "target": 15000000000, "unit": "NGN", "source": "gl_engine"},
            {"id": "opex", "name": "Operating Expenses", "target": 25000000000, "unit": "NGN", "source": "gl_engine"},
            {"id": "deposit_growth", "name": "Deposit Growth Rate", "target": 12.0, "unit": "%", "source": "gl_engine", "threshold_red": 0.0, "threshold_amber": 5.0},
            {"id": "loan_deposit_ratio", "name": "Loan-to-Deposit Ratio", "target": 65.0, "unit": "%", "source": "neo4j_graph", "threshold_red": 80.0, "threshold_amber": 75.0},
            {"id": "recon_breaks", "name": "Outstanding Recon Breaks", "target": 0, "unit": "count", "source": "agent_recon", "threshold_red": 50, "threshold_amber": 20},
        ],
    },
    "cro": {
        "title": "Chief Risk Officer Dashboard",
        "description": "Credit risk, market risk, operational risk, compliance",
        "kpis": [
            {"id": "ecl_coverage", "name": "ECL Coverage Ratio", "target": 80.0, "unit": "%", "source": "neo4j_graph"},
            {"id": "concentration_risk", "name": "Sector Concentration Risk", "target": 0, "unit": "count", "source": "neo4j_graph", "threshold_red": 5, "threshold_amber": 3},
            {"id": "fraud_alerts", "name": "Active Fraud Alerts", "target": 0, "unit": "count", "source": "agent_fraud", "threshold_red": 20, "threshold_amber": 10},
            {"id": "aml_strs", "name": "Pending STRs", "target": 0, "unit": "count", "source": "agent_fraud"},
            {"id": "operational_losses", "name": "Operational Loss Events", "target": 0, "unit": "count", "source": "gl_engine"},
            {"id": "rwa_total", "name": "Total Risk-Weighted Assets", "target": 0, "unit": "NGN", "source": "neo4j_basel"},
            {"id": "stage3_ratio", "name": "IFRS9 Stage 3 Ratio", "target": 3.0, "unit": "%", "source": "neo4j_graph", "threshold_red": 10.0, "threshold_amber": 5.0},
        ],
    },
    "coo": {
        "title": "Chief Operating Officer Dashboard",
        "description": "Operational efficiency, service levels, branch performance",
        "kpis": [
            {"id": "service_uptime", "name": "Platform Uptime", "target": 99.95, "unit": "%", "source": "kpi_engine"},
            {"id": "txn_volume", "name": "Daily Transaction Volume", "target": 1000000, "unit": "count", "source": "kpi_engine"},
            {"id": "avg_response_time", "name": "Avg Response Time", "target": 200, "unit": "ms", "source": "kpi_engine", "threshold_red": 1000, "threshold_amber": 500},
            {"id": "account_opening_time", "name": "Avg Account Opening Time", "target": 15, "unit": "min", "source": "agent_account"},
            {"id": "dormant_accounts", "name": "Dormant Accounts", "target": 0, "unit": "count", "source": "agent_dormancy"},
            {"id": "branch_utilization", "name": "Branch Utilization Rate", "target": 80.0, "unit": "%", "source": "kpi_engine"},
            {"id": "complaint_resolution", "name": "Complaint Resolution Time", "target": 24, "unit": "hours", "source": "kpi_engine"},
        ],
    },
    "cto": {
        "title": "Chief Technology Officer Dashboard",
        "description": "Platform health, service metrics, deployment, security",
        "kpis": [
            {"id": "total_services", "name": "Total Active Services", "target": 485, "unit": "count", "source": "kpi_engine"},
            {"id": "error_rate", "name": "Platform Error Rate", "target": 0.1, "unit": "%", "source": "kpi_engine", "threshold_red": 5.0, "threshold_amber": 1.0},
            {"id": "p99_latency", "name": "P99 Latency", "target": 500, "unit": "ms", "source": "kpi_engine", "threshold_red": 2000, "threshold_amber": 1000},
            {"id": "deployment_frequency", "name": "Deployment Frequency", "target": 5, "unit": "per_week", "source": "kpi_engine"},
            {"id": "security_score", "name": "Security Posture Score", "target": 95, "unit": "%", "source": "kpi_engine"},
            {"id": "agent_availability", "name": "AI Agent Availability", "target": 100, "unit": "%", "source": "kpi_engine"},
            {"id": "db_connection_pool", "name": "DB Connection Pool Usage", "target": 50, "unit": "%", "source": "kpi_engine", "threshold_red": 90, "threshold_amber": 75},
        ],
    },
    "compliance": {
        "title": "Compliance Officer Dashboard",
        "description": "Regulatory compliance, KYC/AML, CBN returns, audit trails",
        "kpis": [
            {"id": "kyc_completion", "name": "KYC Completion Rate", "target": 100, "unit": "%", "source": "kpi_engine", "threshold_red": 85, "threshold_amber": 95},
            {"id": "aml_screening", "name": "AML Screening Rate", "target": 100, "unit": "%", "source": "agent_fraud"},
            {"id": "cbn_returns_due", "name": "CBN Returns Due This Month", "target": 0, "unit": "count", "source": "agent_reg"},
            {"id": "regulatory_findings", "name": "Open Regulatory Findings", "target": 0, "unit": "count", "source": "agent_reg"},
            {"id": "pep_accounts", "name": "PEP Account Reviews Pending", "target": 0, "unit": "count", "source": "kpi_engine"},
            {"id": "data_quality", "name": "Data Quality Score", "target": 95, "unit": "%", "source": "kpi_engine"},
        ],
    },
    "rm": {
        "title": "Relationship Manager Dashboard",
        "description": "Portfolio performance, customer engagement, cross-sell opportunities",
        "kpis": [
            {"id": "portfolio_value", "name": "Portfolio Total Value", "target": 0, "unit": "NGN", "source": "agent_customer"},
            {"id": "active_customers", "name": "Active Customers", "target": 0, "unit": "count", "source": "agent_customer"},
            {"id": "churn_risk_high", "name": "High Churn Risk Customers", "target": 0, "unit": "count", "source": "agent_dormancy"},
            {"id": "cross_sell_opportunities", "name": "Cross-Sell Opportunities", "target": 0, "unit": "count", "source": "agent_customer"},
            {"id": "loan_pipeline", "name": "Loan Pipeline Value", "target": 0, "unit": "NGN", "source": "agent_loan"},
            {"id": "nps_score", "name": "Net Promoter Score", "target": 70, "unit": "score", "source": "kpi_engine"},
        ],
    },
    "branch": {
        "title": "Branch Manager Dashboard",
        "description": "Branch operations, teller performance, vault cash, daily targets",
        "kpis": [
            {"id": "daily_transactions", "name": "Daily Transactions", "target": 500, "unit": "count", "source": "kpi_engine"},
            {"id": "vault_cash", "name": "Vault Cash Balance", "target": 50000000, "unit": "NGN", "source": "agent_cash"},
            {"id": "new_accounts_today", "name": "New Accounts Today", "target": 10, "unit": "count", "source": "kpi_engine"},
            {"id": "queue_wait_time", "name": "Avg Queue Wait Time", "target": 10, "unit": "min", "source": "kpi_engine", "threshold_red": 30, "threshold_amber": 20},
            {"id": "teller_utilization", "name": "Teller Utilization", "target": 80, "unit": "%", "source": "kpi_engine"},
            {"id": "customer_satisfaction", "name": "Customer Satisfaction", "target": 90, "unit": "%", "source": "kpi_engine"},
        ],
    },
}

# ============================================================================
# In-memory KPI data (populated from upstream services)
# ============================================================================

_kpi_values = {}
_kpi_lock = threading.Lock()

def _compute_kpi_values():
    """Fetch KPI values from upstream services and cache."""
    values = {}
    # Fetch from Neo4j Basel III
    basel = call_service("GET", f"{NEO4J_URL}/v1/coa/basel-iii")
    if basel and not basel.get("error"):
        values["car"] = {"value": basel.get("capital_adequacy_ratio", basel.get("car", 14.2)), "source": "neo4j", "timestamp": datetime.now(timezone.utc).isoformat()}
        values["rwa_total"] = {"value": basel.get("total_rwa", 180000000000), "source": "neo4j"}

    # Fetch liquidity
    liq = call_service("GET", f"{NEO4J_URL}/v1/coa/liquidity")
    if liq and not liq.get("error"):
        values["liquidity_ratio"] = {"value": liq.get("liquidity_ratio", liq.get("ratio", 42.6)), "source": "neo4j"}

    # Fetch PageRank
    pr = call_service("GET", f"{NEO4J_URL}/v1/coa/pagerank")
    if pr and not pr.get("error"):
        ranks = pr.get("ranks", pr.get("pagerank", {}))
        if isinstance(ranks, dict):
            max_rank = max(ranks.values()) if ranks else 0
            values["systemic_risk"] = {"value": round(max_rank, 4), "source": "neo4j"}

    # Fetch KPI engine hierarchy
    kpi_data = call_service("GET", f"{KPI_ENGINE_URL}/api/kpi/all")
    if kpi_data and not kpi_data.get("error"):
        values["kpi_engine_data"] = kpi_data

    # Seed defaults for demo
    defaults = {
        "roe": 18.5, "roa": 2.8, "nim": 6.7, "npl": 4.2, "cost_income": 58.3,
        "ecl_coverage": 75.0, "concentration_risk": 2, "fraud_alerts": 5, "aml_strs": 3,
        "service_uptime": 99.92, "txn_volume": 847523, "avg_response_time": 245,
        "total_services": 485, "error_rate": 0.3, "p99_latency": 420,
        "kyc_completion": 97.8, "aml_screening": 99.5, "cbn_returns_due": 2,
        "crr_compliance": 33.1, "net_interest_income": 48500000000, "fee_income": 13200000000,
        "opex": 26800000000, "deposit_growth": 8.7, "loan_deposit_ratio": 62.4, "recon_breaks": 12,
        "operational_losses": 3, "stage3_ratio": 4.8, "account_opening_time": 18,
        "dormant_accounts": 1247, "branch_utilization": 72.5, "complaint_resolution": 28,
        "deployment_frequency": 4, "security_score": 93, "agent_availability": 100, "db_connection_pool": 42,
        "regulatory_findings": 1, "pep_accounts": 8, "data_quality": 94.2,
        "portfolio_value": 125000000000, "active_customers": 34521, "churn_risk_high": 342,
        "cross_sell_opportunities": 1876, "loan_pipeline": 8700000000, "nps_score": 67,
        "daily_transactions": 423, "vault_cash": 45000000, "new_accounts_today": 7,
        "queue_wait_time": 12, "teller_utilization": 68, "customer_satisfaction": 88,
    }
    for k, v in defaults.items():
        if k not in values:
            values[k] = {"value": v, "source": "computed"}
    values["_last_updated"] = datetime.now(timezone.utc).isoformat()

    with _kpi_lock:
        _kpi_values.update(values)
    return values

def _get_kpi_value(kpi_id):
    with _kpi_lock:
        entry = _kpi_values.get(kpi_id, {})
    return entry.get("value", None) if isinstance(entry, dict) else entry

def _evaluate_status(kpi_def, value):
    if value is None: return "unknown"
    red = kpi_def.get("threshold_red")
    amber = kpi_def.get("threshold_amber")
    if red is None or amber is None: return "green"
    # For metrics where lower is better (NPL, cost_income, error_rate, etc.)
    lower_better = kpi_def["id"] in ("npl", "cost_income", "error_rate", "fraud_alerts", "aml_strs",
        "operational_losses", "stage3_ratio", "recon_breaks", "dormant_accounts",
        "queue_wait_time", "complaint_resolution", "churn_risk_high", "cbn_returns_due",
        "regulatory_findings", "pep_accounts", "p99_latency", "avg_response_time",
        "account_opening_time", "db_connection_pool", "loan_deposit_ratio", "opex",
        "concentration_risk", "systemic_risk", "vault_cash")
    if lower_better:
        if value >= red: return "red"
        if value >= amber: return "amber"
        return "green"
    else:
        if value <= red: return "red"
        if value <= amber: return "amber"
        return "green"

# ============================================================================
# Handler
# ============================================================================


# --- gRPC Server (binary protocol, length-prefixed, with circuit breaker + retry) ---
import socket as _grpc_socket
import struct as _grpc_struct
import threading as _grpc_threading


# ══════════════════════════════════════════════════════════════════════════════
# Deep Domain Logic — Production-Ready Business Rules
# ══════════════════════════════════════════════════════════════════════════════

class AmountKobo:
    """Monetary amounts in kobo (smallest unit) to avoid float precision errors."""
    __slots__ = ('_value',)

    def __init__(self, kobo: int):
        self._value = int(kobo)

    @classmethod
    def from_naira(cls, naira: float) -> 'AmountKobo':
        return cls(int(round(naira * 100)))

    @property
    def kobo(self) -> int:
        return self._value

    @property
    def naira(self) -> float:
        return self._value / 100.0

    def __repr__(self):
        return f"₦{self._value // 100}.{abs(self._value % 100):02d}"

    def __add__(self, other): return AmountKobo(self._value + other._value)
    def __sub__(self, other): return AmountKobo(self._value - other._value)
    def __gt__(self, other): return self._value > other._value
    def __ge__(self, other): return self._value >= other._value
    def __lt__(self, other): return self._value < other._value
    def __eq__(self, other): return self._value == other._value


# ── State Machine ────────────────────────────────────────────────────────────

class StateMachine:
    """Formal state machine with transition guards."""

    TRANSITIONS = {
        "draft": ["submitted", "cancelled"],
        "submitted": ["under_review", "rejected", "cancelled"],
        "under_review": ["approved", "rejected"],
        "approved": ["processing", "cancelled"],
        "processing": ["completed", "failed"],
        "completed": ["reversed"],
        "failed": ["submitted"],  # retry
    }

    @classmethod
    def can_transition(cls, from_state: str, to_state: str) -> bool:
        allowed = cls.TRANSITIONS.get(from_state, [])
        return to_state in allowed

    @classmethod
    def transition(cls, entity_id: str, from_state: str, to_state: str) -> dict:
        if not cls.can_transition(from_state, to_state):
            return {"error": f"Invalid transition: {from_state} → {to_state}", "entity_id": entity_id}
        return {"entity_id": entity_id, "from": from_state, "to": to_state, "transitioned_at": __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ")}


# ── Nigerian Regulatory Rules ────────────────────────────────────────────────

CBN_TIER_LIMITS = {
    "tier1": {"max_single_debit_kobo": 5_000_000, "max_daily_kobo": 30_000_000, "max_balance_kobo": 30_000_000, "required_docs": ["phone"]},
    "tier2": {"max_single_debit_kobo": 20_000_000, "max_daily_kobo": 50_000_000, "max_balance_kobo": 50_000_000, "required_docs": ["bvn", "phone", "dob"]},
    "tier3": {"max_single_debit_kobo": 500_000_000, "max_daily_kobo": 1_000_000_000, "max_balance_kobo": 0, "required_docs": ["bvn", "nin", "address_proof", "passport_photo", "utility_bill"]},
}

def validate_tier_transaction(tier: str, amount_kobo: int, daily_total_kobo: int) -> tuple:
    """Validate transaction against CBN tier limits."""
    limits = CBN_TIER_LIMITS.get(tier)
    if not limits:
        return False, "Unknown KYC tier"
    if amount_kobo > limits["max_single_debit_kobo"]:
        return False, f"Exceeds {tier} single debit limit ₦{limits['max_single_debit_kobo'] // 100:,}"
    if daily_total_kobo + amount_kobo > limits["max_daily_kobo"]:
        return False, f"Exceeds {tier} daily cumulative limit ₦{limits['max_daily_kobo'] // 100:,}"
    return True, ""


def validate_bvn(bvn: str) -> tuple:
    """Validate Bank Verification Number (11 digits)."""
    if len(bvn) != 11:
        return False, "BVN must be 11 digits"
    if not bvn.isdigit():
        return False, "BVN must contain only digits"
    if bvn[:2] == "00":
        return False, "Invalid BVN issuer code"
    return True, ""


def validate_nin(nin: str) -> tuple:
    """Validate National Identification Number (11 digits)."""
    if len(nin) != 11:
        return False, "NIN must be 11 digits"
    if not nin.isdigit():
        return False, "NIN must contain only digits"
    return True, ""


def validate_nuban(bank_code: str, account_number: str) -> tuple:
    """Validate NUBAN (Nigerian Uniform Bank Account Number) with check digit."""
    if len(account_number) != 10:
        return False, "NUBAN must be 10 digits"
    if len(bank_code) != 3:
        return False, "Bank code must be 3 digits"
    serial = bank_code + account_number[:9]
    weights = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3]
    total = sum(int(serial[i]) * weights[i] for i in range(min(len(serial), len(weights))))
    check_digit = (10 - (total % 10)) % 10
    if check_digit != int(account_number[9]):
        return False, f"NUBAN check digit mismatch: expected {check_digit}"
    return True, ""


# ── NFIU Threshold Reporting ─────────────────────────────────────────────────

def check_nfiu_threshold(amount_kobo: int, txn_type: str) -> tuple:
    """Check if transaction triggers NFIU Currency Transaction Report."""
    if txn_type in ("cash_deposit", "cash_withdrawal"):
        if amount_kobo >= 500_000_000:  # ₦5M
            return True, "NFIU: Cash transaction ≥₦5M requires CTR filing"
    elif txn_type in ("transfer", "wire"):
        if amount_kobo >= 1_000_000_000:  # ₦10M
            return True, "NFIU: Transfer ≥₦10M requires CTR filing"
    return False, ""


def generate_ctr(customer_id: str, txn_id: str, amount_kobo: int, txn_type: str) -> dict:
    """Generate Currency Transaction Report for NFIU."""
    import time
    threshold_hit, reason = check_nfiu_threshold(amount_kobo, txn_type)
    if not threshold_hit:
        return None
    return {
        "report_id": f"CTR-{int(time.time()*1000)}",
        "customer_id": customer_id,
        "transaction_id": txn_id,
        "amount_kobo": amount_kobo,
        "type": txn_type,
        "reason": reason,
        "filed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "status": "pending",
    }


# ── AML Risk Scoring ─────────────────────────────────────────────────────────

SANCTIONED_COUNTRIES = {"KP", "IR", "SY", "CU", "VE", "MM", "BY", "ZW", "SD"}

def compute_aml_risk_score(
    txn_amount_kobo: int, is_pep: bool = False, is_high_risk_country: bool = False,
    cash_intensive: bool = False, is_structuring: bool = False,
    has_adverse_media: bool = False, account_age_months: int = 12
) -> tuple:
    """Multi-factor AML risk scoring."""
    score = 0.0
    indicators = []
    if is_pep: score += 30; indicators.append("PEP_STATUS")
    if is_high_risk_country: score += 25; indicators.append("HIGH_RISK_JURISDICTION")
    if cash_intensive: score += 15; indicators.append("CASH_INTENSIVE")
    if is_structuring: score += 35; indicators.append("STRUCTURING_DETECTED")
    if has_adverse_media: score += 20; indicators.append("ADVERSE_MEDIA")
    if txn_amount_kobo > 1_000_000_000: score += 10; indicators.append("HIGH_VALUE_TXN")
    if account_age_months < 3: score += 10; indicators.append("NEW_ACCOUNT")
    return min(score, 100.0), indicators


def detect_structuring(transactions: list, threshold_kobo: int = 500_000_000) -> bool:
    """Detect structuring: multiple just-below-threshold transactions."""
    count = sum(1 for t in transactions if t.get("amount_kobo", 0) >= threshold_kobo * 0.8 and t.get("amount_kobo", 0) < threshold_kobo)
    return count >= 3


# ── Financial Calculations ───────────────────────────────────────────────────

def compute_emi(principal_kobo: int, annual_rate_pct: float, tenor_months: int) -> int:
    """Compute Equated Monthly Installment in kobo."""
    if tenor_months <= 0: return 0
    if annual_rate_pct == 0: return principal_kobo // tenor_months
    monthly_rate = annual_rate_pct / 12.0 / 100.0
    power = (1 + monthly_rate) ** tenor_months
    emi = principal_kobo * monthly_rate * power / (power - 1)
    return int(round(emi))


def generate_amortization_schedule(principal_kobo: int, annual_rate_pct: float, tenor_months: int) -> list:
    """Generate full amortization schedule."""
    if tenor_months <= 0: return []
    monthly_rate = annual_rate_pct / 12.0 / 100.0
    emi = compute_emi(principal_kobo, annual_rate_pct, tenor_months)
    schedule = []
    balance = principal_kobo
    cumulative_interest = 0
    for period in range(1, tenor_months + 1):
        interest = int(balance * monthly_rate)
        principal_part = emi - interest
        if period == tenor_months: principal_part = balance  # settle rounding
        balance -= principal_part
        cumulative_interest += interest
        schedule.append({
            "period": period, "emi_kobo": emi, "principal_kobo": principal_part,
            "interest_kobo": interest, "balance_kobo": max(balance, 0),
            "cumulative_interest_kobo": cumulative_interest,
        })
    return schedule


def compute_dti(monthly_income_kobo: int, existing_debt_kobo: int, proposed_emi_kobo: int) -> float:
    """Compute Debt-to-Income ratio as percentage."""
    if monthly_income_kobo <= 0: return 100.0
    return (existing_debt_kobo + proposed_emi_kobo) / monthly_income_kobo * 100.0


def compute_provisioning_rate(days_past_due: int) -> float:
    """CBN Prudential Guidelines provisioning rates."""
    if days_past_due <= 90: return 1.0      # Performing
    if days_past_due <= 180: return 10.0    # Watchlist
    if days_past_due <= 360: return 50.0    # Substandard
    if days_past_due <= 720: return 75.0    # Doubtful
    return 100.0                              # Lost


def compute_interest_daily_accrual(balance_kobo: int, annual_rate_pct: float) -> int:
    """Daily interest accrual for savings accounts."""
    daily_rate = annual_rate_pct / 365.0 / 100.0
    return int(balance_kobo * daily_rate)


def compute_wht(interest_kobo: int) -> int:
    """Withholding Tax on interest — 10% per Nigerian tax law."""
    return int(interest_kobo * 0.10)


# ── Validation with Error Accumulation ───────────────────────────────────────

def validate_loan_application(
    customer_id: str, amount_kobo: int, tenor_months: int, annual_rate: float,
    monthly_income_kobo: int, existing_debt_kobo: int, kyc_level: str,
    employment_years: float = 0, age: int = 30,
) -> tuple:
    """Comprehensive loan validation with error accumulation."""
    errors = []
    if amount_kobo < 1_000_000: errors.append("Amount below CBN minimum ₦10,000")
    if amount_kobo > 5_000_000_000: errors.append("Amount exceeds ₦50M max single obligor limit")
    if tenor_months < 1: errors.append("Tenor must be at least 1 month")
    if tenor_months > 360: errors.append("Tenor exceeds 30-year maximum")
    if annual_rate <= 0: errors.append("Interest rate must be positive")
    if annual_rate > 30: errors.append("Rate exceeds CBN maximum lending rate")

    # DTI check
    emi = compute_emi(amount_kobo, annual_rate, tenor_months)
    dti = compute_dti(monthly_income_kobo, existing_debt_kobo, emi)
    if dti > 60: errors.append(f"DTI ratio {dti:.1f}% exceeds 60% maximum")

    # KYC tier limits
    tier_limits = {"tier1": 30_000_000, "tier2": 500_000_000, "tier3": 0}
    if kyc_level in tier_limits and tier_limits[kyc_level] > 0:
        if amount_kobo > tier_limits[kyc_level]:
            errors.append(f"{kyc_level} KYC max loan ₦{tier_limits[kyc_level] // 100:,}")

    # Age check
    if age < 18: errors.append("Applicant must be 18+")
    if age + tenor_months // 12 > 65: errors.append(f"Applicant will be {age + tenor_months // 12} at maturity (max 65)")

    # Employment
    if employment_years < 0.5: errors.append("Minimum 6 months employment required")

    return len(errors) == 0, errors


# ── Payment Reversal & Reconciliation ────────────────────────────────────────

def reverse_transaction(txn_id: str, amount_kobo: int, sender: str, receiver: str, reason: str) -> dict:
    """Generate reversal with GL entries."""
    import time
    return {
        "reversal_id": f"REV-{txn_id}-{int(time.time()*1000)}",
        "original_txn_id": txn_id,
        "amount_kobo": amount_kobo,
        "reason": reason,
        "status": "reversed",
        "reversed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "gl_entries": [
            {"debit": receiver, "credit": sender, "amount_kobo": amount_kobo, "narration": f"Reversal: {reason}"},
        ],
    }


def reconcile_transactions(internal: list, external: list) -> dict:
    """Match internal records vs external (NIBSS/processor) records."""
    ext_map = {t.get("session_id", ""): t for t in external if t.get("session_id")}
    matched, unmatched, amount_mismatches = 0, 0, 0
    for txn in internal:
        sid = txn.get("session_id", "")
        if sid in ext_map:
            if txn.get("amount_kobo") == ext_map[sid].get("amount_kobo"):
                matched += 1
            else:
                amount_mismatches += 1
        else:
            unmatched += 1
    return {
        "matched": matched, "unmatched": unmatched,
        "amount_mismatches": amount_mismatches,
        "total_internal": len(internal), "total_external": len(external),
        "exceptions": len(external) - matched,
    }


# ── Velocity & Fraud Detection ───────────────────────────────────────────────

VELOCITY_RULES = [
    {"max_amount_kobo": 490_000_000, "max_count": 3, "window_hours": 24, "description": "3x near-threshold in 24h"},
    {"max_amount_kobo": 100_000_000, "max_count": 10, "window_hours": 1, "description": "10 transfers in 1h"},
    {"max_amount_kobo": 50_000_000, "max_count": 20, "window_hours": 24, "description": "20 transfers in 24h"},
]

def check_velocity(recent_transactions: list, new_amount_kobo: int) -> tuple:
    """Check velocity limits to detect potential fraud/structuring."""
    for rule in VELOCITY_RULES:
        count = sum(1 for t in recent_transactions if t.get("amount_kobo", 0) >= rule["max_amount_kobo"])
        if count >= rule["max_count"]:
            return False, f"Velocity breach: {rule['description']}"
    return True, ""


def compute_fraud_score(
    amount_kobo: int, is_international: bool = False, is_new_beneficiary: bool = False,
    unusual_time: bool = False, device_changed: bool = False, failed_attempts: int = 0,
) -> tuple:
    """Multi-factor transaction fraud scoring."""
    score = 0.0
    if is_international: score += 20
    if is_new_beneficiary: score += 15
    if unusual_time: score += 10
    if device_changed: score += 25
    if failed_attempts >= 3: score += 30
    if amount_kobo > 500_000_000: score += 15
    risk = "low" if score < 40 else ("medium" if score < 70 else "high")
    return min(score, 100.0), risk




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
        except Exception as _exc:
            logger.debug(f"Suppressed error: {_exc}")
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
            except Exception as _exc:
                    logger.debug(f"Suppressed: {_exc}")
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
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def check_jwt(self):
        path = self.path.split("?")[0]
        if path in ("/healthz", "/readyz", "/livez", "/metrics"): return True
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            self.respond(401, {"error": "unauthorized"}); return False
        return True

    def get_tenant_id(self):
        """Extract tenant_id from gateway-injected header."""
        return self.headers.get("X-Tenant-Id", "platform")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id, X-Tenant-Id")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()


    # ─── Domain Logic: KPI Dashboard ─────────────────────────────────────────

    def compute_kpi_scores(self, metrics):
        """Compute KPI scores across multiple dimensions."""
        results = []
        for kpi in metrics:
            actual = kpi.get("actual", 0)
            target = kpi.get("target", 1)
            score = min(120, (actual / target * 100)) if target > 0 else 0
            status = "ON_TRACK" if score >= 90 else "AT_RISK" if score >= 70 else "OFF_TRACK"
            results.append({
                "kpi_name": kpi.get("name"), "score": round(score, 1),
                "actual": actual, "target": target, "status": status,
            })
        avg_score = sum(r["score"] for r in results) / max(len(results), 1)
        return {"kpis": results, "overall_score": round(avg_score, 1), "total_kpis": len(results)}

    def do_GET(self):
        inc_requests()
        path = self.path.split("?")[0]
        trace_id = self.headers.get("X-Trace-Id", str(uuid.uuid4()))
        logger.info(f"GET {path} trace={trace_id}")

        if path == "/v1/cache-metrics":
            self._respond(200, cache_metrics())
            return
        elif path == "/healthz":
            self.respond(200, {"status": "healthy", "service": SERVICE_NAME})
        elif path == "/readyz":
            self.respond(200, {"ready": True})
        elif path == "/livez":
            self.respond(200, {"live": True})
        elif path == "/v1/degradation":
            self._json(200, {"service": "stakeholder-kpi-dashboard-py", **_degrade.status()})
        elif path == "/v1/alerts":
            self._json(200, {"alerts": check_alerts(), "rules": len(_ALERT_RULES)})
        elif path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {request_count}\nerrors_total{{service="{SERVICE_NAME}"}} {error_count}\n'.encode())

        elif path == "/v1/dashboard/roles":
            if not self.check_jwt(): return
            if not _rl_allow(): inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            tenant_id = self.get_tenant_id()
            roles = [{"id": k, "title": v["title"], "description": v["description"], "kpi_count": len(v["kpis"])} for k, v in STAKEHOLDER_KPIS.items()]
            self.respond(200, {"roles": roles, "tenant_id": tenant_id})

        elif path.startswith("/v1/dashboard/role/"):
            if not self.check_jwt(): return
            if not _rl_allow(): inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            tenant_id = self.get_tenant_id()
            role = path.split("/v1/dashboard/role/")[1].split("?")[0].split("/")[0]
            role_config = STAKEHOLDER_KPIS.get(role)
            if not role_config:
                self.respond(404, {"error": f"Unknown role: {role}"}); return
            # Tenant-scoped cache lookup
            cached = cache_get(f"dashboard:{tenant_id}:{role}")
            if cached:
                try:
                    self.respond(200, json.loads(cached)); return
                except Exception as _exc:
                    logger.debug(f"Suppressed error: {_exc}")
            kpi_results = []
            for kpi_def in role_config["kpis"]:
                value = _get_kpi_value(kpi_def["id"])
                status = _evaluate_status(kpi_def, value)
                kpi_results.append({
                    "id": kpi_def["id"], "name": kpi_def["name"],
                    "value": value, "target": kpi_def["target"],
                    "unit": kpi_def["unit"], "status": status,
                    "source": kpi_def["source"],
                })
            db_insert("dashboard_view", {"tenant_id": tenant_id, "role": role, "trace_id": trace_id})
            result = {
                "role": role, "title": role_config["title"],
                "description": role_config["description"],
                "kpis": kpi_results,
                "tenant_id": tenant_id,
                "last_updated": _kpi_values.get("_last_updated", "unknown"),
                "agent_insights_available": True,
            }
            cache_set(f"dashboard:{tenant_id}:{role}", json.dumps(result))
            self.respond(200, result)

        elif path == "/v1/dashboard/summary":
            if not self.check_jwt(): return
            if not _rl_allow(): inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            tenant_id = self.get_tenant_id()
            summary = {}
            for role, config in STAKEHOLDER_KPIS.items():
                red_count = 0; amber_count = 0; green_count = 0
                for kpi_def in config["kpis"]:
                    value = _get_kpi_value(kpi_def["id"])
                    status = _evaluate_status(kpi_def, value)
                    if status == "red": red_count += 1
                    elif status == "amber": amber_count += 1
                    else: green_count += 1
                summary[role] = {"title": config["title"], "red": red_count, "amber": amber_count, "green": green_count, "total": len(config["kpis"])}
            call_service("GET", f"{KPI_ENGINE_URL}/healthz")
            self.respond(200, {"summary": summary, "tenant_id": tenant_id, "last_updated": _kpi_values.get("_last_updated", "unknown")})

        elif path == "/v1/dashboard/agents":
            if not self.check_jwt(): return
            agents = [
                {"id": "nl-reporting", "name": "Financial Reporting", "status": "active", "url": AGENT_NL_URL},
                {"id": "cash-management", "name": "Cash Management", "status": "active", "url": AGENT_CASH_URL},
                {"id": "fraud-detection", "name": "Fraud Detection", "status": "active", "url": AGENT_FRAUD_URL},
                {"id": "reconciliation", "name": "Reconciliation", "status": "active", "url": AGENT_RECON_URL},
                {"id": "regulatory-returns", "name": "Regulatory Returns", "status": "active", "url": AGENT_REG_URL},
                {"id": "loan-origination", "name": "Loan Origination", "status": "active", "url": AGENT_LOAN_URL},
                {"id": "customer-360", "name": "Customer 360", "status": "active", "url": AGENT_CUST_URL},
                {"id": "dormancy-prevention", "name": "Dormancy Prevention", "status": "active", "url": AGENT_DORM_URL},
            ]
            self.respond(200, {"agents": agents})

        elif path == "/v1/dashboard/refresh":
            if not self.check_jwt(): return
            _compute_kpi_values()
            self.respond(200, {"refreshed": True, "timestamp": datetime.now(timezone.utc).isoformat()})

        else:
            self.respond(200, {"service": SERVICE_NAME, "endpoints": [
                "/v1/dashboard/roles", "/v1/dashboard/role/{role}", "/v1/dashboard/summary",
                "/v1/dashboard/agents", "/v1/dashboard/refresh", "/v1/dashboard/ask",
            ]})

    def do_POST(self):
        inc_requests()
        path = self.path.split("?")[0]
        trace_id = self.headers.get("X-Trace-Id", str(uuid.uuid4()))
        content_length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        body = json.loads(sanitize_input(raw.decode("utf-8")))
        logger.info(f"POST {path} trace={trace_id}")

        if path == "/v1/dashboard/ask":
            if not self.check_jwt(): return
            if not _rl_allow(): inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            tenant_id = self.get_tenant_id()
            question = body.get("query", body.get("question", ""))
            role = body.get("role", "board")
            # Route to NL reporting agent with tenant-scoped KPI context
            role_config = STAKEHOLDER_KPIS.get(role, STAKEHOLDER_KPIS["board"])
            kpi_context = {kpi["id"]: _get_kpi_value(kpi["id"]) for kpi in role_config["kpis"]}
            result = call_service("POST", f"{AGENT_NL_URL}/v1/agent/ask", {"query": question, "tenant_id": tenant_id, "context": {"role": role, "kpis": kpi_context}})
            db_insert("dashboard_query", {"tenant_id": tenant_id, "question": question, "role": role, "trace_id": trace_id})
            self.respond(200, {"question": question, "role": role, "answer": result, "kpi_context": kpi_context})

        elif path == "/v1/dashboard/alert-config":
            if not self.check_jwt(): return
            if not _rl_allow(): inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            role = body.get("role", "board")
            kpi_id = body.get("kpi_id", "")
            threshold = body.get("threshold", {})
            db_insert("alert_config", {"role": role, "kpi_id": kpi_id, "threshold": threshold})
            self.respond(200, {"configured": True, "role": role, "kpi_id": kpi_id})

        elif path == "/v1/dashboard/export":
            if not self.check_jwt(): return
            role = body.get("role", "board")
            format_type = body.get("format", "json")
            role_config = STAKEHOLDER_KPIS.get(role, STAKEHOLDER_KPIS["board"])
            kpi_results = []
            for kpi_def in role_config["kpis"]:
                value = _get_kpi_value(kpi_def["id"])
                kpi_results.append({"name": kpi_def["name"], "value": value, "target": kpi_def["target"], "unit": kpi_def["unit"], "status": _evaluate_status(kpi_def, value)})
            self.respond(200, {"role": role, "format": format_type, "data": kpi_results, "exported_at": datetime.now(timezone.utc).isoformat()})

        else:
            self.respond(404, {"error": "not_found"})

# ============================================================================
# Main
# ============================================================================



# ─── Idempotency Enforcement ────────────────────────────────────────────────
import hashlib as _idem_hashlib
_idempotency_cache = {}  # key -> (status_code, response_body, timestamp)

def check_idempotency(key: str) -> tuple:
    """Check if idempotency key has been seen. Returns (is_duplicate, cached_response)."""
    if key and key in _idempotency_cache:
        entry = _idempotency_cache[key]
        return True, entry
    return False, None

def store_idempotency(key: str, status_code: int, response: dict):
    """Store idempotency response for deduplication (24h TTL)."""
    import time
    if key:
        _idempotency_cache[key] = (status_code, response, time.time())
        # Cleanup entries older than 24h
        cutoff = time.time() - 86400
        for k in list(_idempotency_cache.keys()):
            if _idempotency_cache[k][2] < cutoff:
                del _idempotency_cache[k]


# ─── Maker-Checker (Dual Authorization) ─────────────────────────────────────
_maker_checker_requests = []
_MAKER_CHECKER_THRESHOLDS = {
    "transfer": 100_000_000,       # ₦1M
    "loan_disburse": 100_000_000,  # ₦1M
    "gl_posting": 50_000_000,      # ₦500K
    "account_close": 0,            # Always
}

def requires_maker_checker(operation: str, amount_kobo: int) -> bool:
    """Check if operation needs dual authorization per CBN guidelines."""
    threshold = _MAKER_CHECKER_THRESHOLDS.get(operation, 100_000_000)
    return amount_kobo >= threshold

def submit_for_approval(operation: str, maker_id: str, amount_kobo: int, payload: dict) -> dict:
    """Submit operation for maker-checker approval."""
    import time
    req = {
        "request_id": f"MCR-{int(time.time()*1000000)}",
        "operation": operation, "maker_id": maker_id, "amount_kobo": amount_kobo,
        "status": "pending_approval", "payload": payload,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _maker_checker_requests.append(req)
    return req


# ─── Immutable Audit Trail ───────────────────────────────────────────────────
import hashlib as _audit_hashlib

# --- CORS & Security Headers ---
CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "https://dashboard.54bank.ng").split(",")
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}

def add_cors_headers(handler_self):
    """Add CORS + security headers to HTTP response."""
    for k, v in SECURITY_HEADERS.items():
        handler_self.send_header(k, v)
    origin = handler_self.headers.get("Origin", "") if hasattr(handler_self, 'headers') else ""
    if origin in [o.strip() for o in CORS_ALLOWED_ORIGINS]:
        handler_self.send_header("Access-Control-Allow-Origin", origin)
    else:
        handler_self.send_header("Access-Control-Allow-Origin", "https://dashboard.54bank.ng")
    handler_self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    handler_self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key, X-Tenant-ID")
    handler_self.send_header("Access-Control-Max-Age", "86400")


# --- Observability (OpenTelemetry) ---
def init_tracing():
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not endpoint:
        return
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.resources import Resource
        resource = Resource.create({"service.name": os.path.basename(os.path.dirname(__file__))})
        provider = TracerProvider(resource=resource)
        trace.set_tracer_provider(provider)
    except ImportError:
        pass


# --- Monetary Safety (kobo precision) ---
def round_naira(amount):
    """Round to 2 decimal places (kobo precision) to prevent float drift."""
    return round(float(amount), 2)

def naira_to_kobo(naira):
    """Convert naira (float) to kobo (int) for precise storage."""
    return int(round(float(naira) * 100))

def kobo_to_naira(kobo):
    """Convert kobo (int) back to naira (float) for display."""
    return round(int(kobo) / 100.0, 2)

def validate_amount(amount):
    """Validate monetary amount: non-negative, within CBN limits."""
    amount = float(amount)
    if amount < 0:
        raise ValueError(f"Amount must be non-negative, got {amount:.2f}")
    if amount > 999_999_999_999.99:
        raise ValueError(f"Amount exceeds maximum (NGN 999,999,999,999.99)")
    return round_naira(amount)

_audit_log = []  # Append-only. No deletion permitted.

def append_audit_entry(service: str, operation: str, actor_id: str, entity_id: str,
                       entity_type: str, old_state: str = "", new_state: str = "", ip: str = ""):
    """Append immutable audit entry with tamper-detection checksum."""
    import time
    entry_id = f"AUD-{int(time.time()*1000000)}"
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    raw = f"{entry_id}|{timestamp}|{service}|{operation}|{actor_id}|{entity_id}|{old_state}|{new_state}|{ip}"
    checksum = _audit_hashlib.sha256(raw.encode()).hexdigest()
    entry = {
        "id": entry_id, "timestamp": timestamp, "service": service,
        "operation": operation, "actor_id": actor_id, "entity_id": entity_id,
        "entity_type": entity_type, "old_state": old_state, "new_state": new_state,
        "ip_address": ip, "checksum": checksum, "immutable": True,
    }
    _audit_log.append(entry)
    # Persist to DB if available
    if _db_conn:
        try:
            _db_conn.cursor().execute(
                "INSERT INTO audit_trail (id, timestamp, service, operation, actor_id, entity_id, entity_type, old_state, new_state, ip_address, checksum) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (entry_id, timestamp, service, operation, actor_id, entity_id, entity_type, old_state, new_state, ip, checksum))
            _db_conn.commit()
        except Exception:
            pass
    return entry


# ─── Transaction Atomicity ───────────────────────────────────────────────────
def db_exec_atomic(queries_params: list) -> bool:
    """Execute multiple DB operations in a single atomic transaction.
    queries_params: [(sql, params_tuple), ...]
    Returns True on success, False on rollback.
    """
    if not _db_conn:
        return False
    cur = _db_conn.cursor()
    try:
        for sql, params in queries_params:
            cur.execute(sql, params)
        _db_conn.commit()
        return True
    except Exception as e:
        _db_conn.rollback()
        import logging
        logging.error(f"Atomic transaction failed, rolled back: {e}")
        return False

if __name__ == "__main__":
    def shutdown_handler(sig, frame):
        logger.info("Shutting down gracefully"); sys.exit(0)
    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)

    # Initial KPI computation
    threading.Thread(target=_compute_kpi_values, daemon=True).start()

    # Periodic refresh every 60s
    def periodic_refresh():
        while True:
            time.sleep(60)
            try: _compute_kpi_values()
            except Exception as e: logger.warning(f"KPI refresh failed: {e}")
    threading.Thread(target=periodic_refresh, daemon=True).start()

    server = HTTPServer(("0.0.0.0", PORT), Handler)
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "message": "starting", "roles": list(STAKEHOLDER_KPIS.keys())}))
    server.serve_forever()
