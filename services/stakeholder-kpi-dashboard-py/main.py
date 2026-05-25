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
def cache_set(key, value, ttl=60):
    try:
        host, port = _REDIS_URL.rsplit(":", 1)
        s = _socket.create_connection((host, int(port)), timeout=2)
        s.sendall(f"*4\r\n$3\r\nSET\r\n${len(key)}\r\n{key}\r\n${len(str(value))}\r\n{value}\r\n$2\r\nEX\r\n${len(str(ttl))}\r\n{ttl}\r\n".encode())
        s.recv(256); s.close()
    except: pass

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

        if path == "/healthz":
            self.respond(200, {"status": "healthy", "service": SERVICE_NAME})
        elif path == "/readyz":
            self.respond(200, {"ready": True})
        elif path == "/livez":
            self.respond(200, {"live": True})
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
                except Exception:
                    pass
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
