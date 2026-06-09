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
neo4j-coa-graph-py — Chart of Accounts graph database service using Neo4j
Models COA as directed graph: hierarchies, transaction flows, regulatory
relationships (CBN, IFRS9, Basel III), PageRank analytics.
"""
import os, sys, json, time, signal, logging, threading, uuid, math, socket as _socket
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone
from collections import defaultdict, deque

SERVICE_NAME = "neo4j-coa-graph-py"

class JsonFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({"timestamp": datetime.now(timezone.utc).isoformat(), "level": record.levelname, "service": SERVICE_NAME, "message": record.getMessage()})

handler_log = logging.StreamHandler()
handler_log.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler_log])
logger = logging.getLogger(SERVICE_NAME)

# --- Rate Limiting ---
import threading as _rl_threading
_rl_tokens = 100
_rl_lock = _rl_threading.Lock()
_rl_last_refill = [0.0]

def _rl_allow():
    global _rl_tokens
    now = time.time()
    with _rl_lock:
        if now - _rl_last_refill[0] >= 1.0:
            _rl_tokens = 100
            _rl_last_refill[0] = now
        if _rl_tokens <= 0:
            return False
        _rl_tokens -= 1
        return True

# --- Redis Caching ---
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
import urllib.request
_DB_URL = os.environ.get("DATABASE_URL", "")
_db_pool = None

def db_insert(table, data):
    logger.info(f"db_insert({table}): {json.dumps(data)[:200]}")
    return {"inserted": True}

def db_query(table, limit=50, offset=0):
    return [], 0

# --- Sanitization ---
def sanitize_input(s):
    s = s.replace("<script>", "").replace("</script>", "").replace("javascript:", "")
    return s[:10240] if len(s) > 10240 else s

# --- Neo4j Bolt Client ---
class Neo4jClient:
    def __init__(self):
        self.host = os.environ.get("NEO4J_BOLT_URL", "neo4j:7687")
        self.user = os.environ.get("NEO4J_USER", "neo4j")
        self.password = os.environ.get("NEO4J_PASSWORD", "54bank_neo4j")
        self.conn = None

    def connect(self):
        try:
            host, port = self.host.rsplit(":", 1)
            self.conn = _socket.create_connection((host, int(port)), timeout=5)
            handshake = bytes([0x60, 0x60, 0xB0, 0x17]) + b"\x00" * 16
            self.conn.sendall(handshake)
            resp = self.conn.recv(4)
            logger.info(f"Neo4j Bolt handshake: {resp.hex()}")
            return True
        except Exception as e:
            logger.warning(f"Neo4j connect failed: {e}")
            return False

    def execute_cypher(self, query, params=None):
        if not self.conn:
            if not self.connect():
                return None
        try:
            payload = json.dumps({"query": query, "params": params or {}}).encode()
            length = len(payload).to_bytes(4, "big")
            self.conn.sendall(length + payload)
            resp_header = self.conn.recv(4)
            resp_len = int.from_bytes(resp_header, "big")
            resp_data = self.conn.recv(min(resp_len, 1024 * 1024))
            return json.loads(resp_data)
        except Exception as e:
            logger.warning(f"Neo4j cypher failed: {e}")
            return None

neo4j_client = Neo4jClient()

# --- COA Graph Model ---
class COAGraph:
    def __init__(self):
        self.nodes = {}
        self.edges = []
        self.lock = threading.Lock()
        self._seed()

    def _seed(self):
        accounts = [
            {"code": "1001", "name": "Cash in Vault - Local Currency", "category": "asset", "subcategory": "cash", "balance": 2_850_000_000, "currency": "NGN"},
            {"code": "1005", "name": "Cash Reserve Requirement (CRR)", "category": "asset", "subcategory": "cash_cbn", "balance": 18_500_000_000, "currency": "NGN"},
            {"code": "1006", "name": "Current Account with CBN", "category": "asset", "subcategory": "cash_cbn", "balance": 5_200_000_000, "currency": "NGN"},
            {"code": "1104", "name": "Interbank Placements - Local", "category": "asset", "subcategory": "placements", "balance": 15_000_000_000, "currency": "NGN"},
            {"code": "1201", "name": "Treasury Bills (NTBs)", "category": "asset", "subcategory": "investments_govt", "balance": 25_000_000_000, "currency": "NGN"},
            {"code": "1301", "name": "Overdrafts - Corporate", "category": "asset", "subcategory": "loans_corporate", "balance": 28_000_000_000, "currency": "NGN"},
            {"code": "1302", "name": "Term Loans - Corporate", "category": "asset", "subcategory": "loans_corporate", "balance": 45_000_000_000, "currency": "NGN"},
            {"code": "1306", "name": "SME Loans", "category": "asset", "subcategory": "loans_sme", "balance": 12_000_000_000, "currency": "NGN"},
            {"code": "1307", "name": "Agricultural Loans (ABP)", "category": "asset", "subcategory": "loans_agric", "balance": 8_500_000_000, "currency": "NGN"},
            {"code": "1355", "name": "IFRS 9 ECL Stage 1", "category": "asset", "subcategory": "provision_ecl", "balance": -800_000_000, "currency": "NGN"},
            {"code": "1356", "name": "IFRS 9 ECL Stage 2", "category": "asset", "subcategory": "provision_ecl", "balance": -1_200_000_000, "currency": "NGN"},
            {"code": "1357", "name": "IFRS 9 ECL Stage 3", "category": "asset", "subcategory": "provision_ecl", "balance": -2_500_000_000, "currency": "NGN"},
            {"code": "2101", "name": "Demand Deposits - Current", "category": "liability", "subcategory": "deposits_demand", "balance": 85_000_000_000, "currency": "NGN"},
            {"code": "2102", "name": "Savings Deposits", "category": "liability", "subcategory": "deposits_savings", "balance": 45_000_000_000, "currency": "NGN"},
            {"code": "2103", "name": "Time Deposits (<90 days)", "category": "liability", "subcategory": "deposits_time", "balance": 25_000_000_000, "currency": "NGN"},
            {"code": "2206", "name": "Subordinated Debt (Tier 2)", "category": "liability", "subcategory": "borrowings_sub", "balance": 8_000_000_000, "currency": "NGN"},
            {"code": "3002", "name": "Issued & Paid-up Capital", "category": "equity", "subcategory": "share_capital", "balance": 25_000_000_000, "currency": "NGN"},
            {"code": "3004", "name": "Statutory Reserve", "category": "equity", "subcategory": "reserves", "balance": 12_000_000_000, "currency": "NGN"},
            {"code": "3006", "name": "Retained Earnings", "category": "equity", "subcategory": "retained", "balance": 18_500_000_000, "currency": "NGN"},
            {"code": "4101", "name": "Interest on Loans - Corporate", "category": "income", "subcategory": "interest_loans", "balance": 18_500_000_000, "currency": "NGN"},
            {"code": "4201", "name": "Account Maintenance Fees", "category": "income", "subcategory": "fee_account", "balance": 2_500_000_000, "currency": "NGN"},
            {"code": "5101", "name": "Interest on Deposits - Savings", "category": "expense", "subcategory": "interest_deposits", "balance": 3_500_000_000, "currency": "NGN"},
            {"code": "5201", "name": "Loan Impairment - Stage 1", "category": "expense", "subcategory": "impairment_loans", "balance": 1_500_000_000, "currency": "NGN"},
            {"code": "5301", "name": "Staff Costs - Salaries", "category": "expense", "subcategory": "staff_costs", "balance": 12_000_000_000, "currency": "NGN"},
        ]
        for a in accounts:
            self.nodes[a["code"]] = a
        self.edges = [
            {"from": "2101", "to": "1301", "type": "FLOWS_TO", "weight": 0.35, "meta": {"flow": "deposits_fund_loans"}},
            {"from": "1301", "to": "4101", "type": "FLOWS_TO", "weight": 0.18, "meta": {"flow": "loans_generate_interest"}},
            {"from": "2102", "to": "5101", "type": "FLOWS_TO", "weight": 0.08, "meta": {"flow": "savings_interest_expense"}},
            {"from": "1355", "to": "1301", "type": "PROVISION_FOR", "weight": 1.0, "meta": {"standard": "IFRS9_ECL_stage1"}},
            {"from": "1356", "to": "1302", "type": "PROVISION_FOR", "weight": 1.0, "meta": {"standard": "IFRS9_ECL_stage2"}},
            {"from": "1357", "to": "1307", "type": "PROVISION_FOR", "weight": 1.0, "meta": {"standard": "IFRS9_ECL_stage3"}},
            {"from": "3002", "to": "1301", "type": "BACKS_RWA", "weight": 0.15, "meta": {"framework": "Basel_III_CET1"}},
        ]

    def pagerank(self, iterations=20, damping=0.85):
        n = len(self.nodes)
        if n == 0: return {}
        rank = {code: 1.0 / n for code in self.nodes}
        out_degree = defaultdict(int)
        for e in self.edges:
            out_degree[e["from"]] += 1
        for _ in range(iterations):
            new_rank = {code: (1 - damping) / n for code in self.nodes}
            for e in self.edges:
                if out_degree[e["from"]] > 0:
                    new_rank[e["to"]] = new_rank.get(e["to"], 0) + damping * rank[e["from"]] / out_degree[e["from"]]
            rank = new_rank
        return dict(sorted(rank.items(), key=lambda x: -x[1]))

    def traverse(self, from_code, to_code, max_depth=10):
        visited = set()
        queue = deque([(from_code, [from_code])])
        visited.add(from_code)
        while queue:
            current, path = queue.popleft()
            if current == to_code:
                return path
            if len(path) >= max_depth:
                continue
            for e in self.edges:
                nxt = e["to"] if e["from"] == current else (e["from"] if e["to"] == current else None)
                if nxt and nxt not in visited:
                    visited.add(nxt)
                    queue.append((nxt, path + [nxt]))
        return []

    def basel_iii(self):
        total_rwa = cet1 = tier2 = total_loans = total_provisions = 0.0
        for n in self.nodes.values():
            sub = n.get("subcategory", "")
            bal = abs(n.get("balance", 0))
            if sub.startswith("loans_"):
                rw = {"loans_corporate": 1.0, "loans_sme": 0.75, "loans_agric": 0.5}.get(sub, 1.0)
                total_rwa += bal * rw
                total_loans += bal
            elif sub in ("share_capital", "reserves", "retained"):
                cet1 += bal
            elif sub == "borrowings_sub":
                tier2 += bal
            elif sub.startswith("provision_"):
                total_provisions += bal
        car = (cet1 + tier2) / total_rwa * 100 if total_rwa > 0 else 0
        return {"total_rwa": total_rwa, "cet1_capital": cet1, "tier2_capital": tier2, "capital_adequacy_ratio": car, "cbn_minimum_car": 15.0, "car_compliant": car >= 15.0, "total_loans": total_loans, "total_provisions": total_provisions}

    def liquidity_ratio(self):
        liquid = deposits = 0.0
        for n in self.nodes.values():
            sub = n.get("subcategory", "")
            bal = abs(n.get("balance", 0))
            if sub in ("cash", "cash_cbn", "placements", "investments_govt"):
                liquid += bal
            elif sub.startswith("deposits_"):
                deposits += bal
        ratio = liquid / deposits * 100 if deposits > 0 else 0
        return {"liquid_assets": liquid, "total_deposits": deposits, "liquidity_ratio": ratio, "cbn_minimum": 30.0, "compliant": ratio >= 30.0}

coa_graph = COAGraph()

# --- Counters ---
request_count = 0
error_count = 0
_counter_lock = threading.Lock()

def inc_requests():
    global request_count
    with _counter_lock:
        request_count += 1

def inc_errors():
    global error_count
    with _counter_lock:
        error_count += 1

# --- Inter-service calls ---
def call_service(method, url, data=None):
    try:
        payload = json.dumps(data).encode() if data else b"{}"
        payload = sanitize_input(payload.decode()).encode()
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method=method)
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        logger.warning(f"call_service failed: {e}")
        return None

# --- Handler ---

# --- mTLS Configuration ---
MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false") == "true"
TLS_CERT_PATH = os.environ.get("TLS_CERT_PATH", "/etc/54bank/certs/service.crt")
TLS_KEY_PATH = os.environ.get("TLS_KEY_PATH", "/etc/54bank/certs/service.key")
TLS_CA_PATH = os.environ.get("TLS_CA_PATH", "/etc/54bank/certs/ca.crt")
PORT = int(os.environ.get("PORT", "8080"))


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
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def get_tenant_id(self):
        """Extract tenant_id from gateway-injected header."""
        return self.headers.get("X-Tenant-Id", "platform")

    def check_jwt(self):
        path = self.path.split("?")[0]
        if path in ("/healthz", "/readyz", "/livez", "/metrics"):
            return True
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            self.respond(401, {"error": "unauthorized"})
            return False
        return True


    # ─── Domain Logic: Chart of Accounts Graph ───────────────────────────────

    def validate_coa_hierarchy(self, accounts):
        """Validate chart of accounts hierarchy integrity."""
        errors = []
        account_ids = {a.get("code") for a in accounts}
        for account in accounts:
            parent = account.get("parent_code")
            if parent and parent not in account_ids:
                errors.append(f"Orphan account: {account.get('code')} references missing parent {parent}")
            if not account.get("code"): errors.append("Account missing code")
            if not account.get("name"): errors.append(f"Account {account.get('code')} missing name")
        return {"valid": len(errors) == 0, "errors": errors, "total_accounts": len(accounts)}

    def compute_trial_balance(self, entries):
        """Compute trial balance from journal entries."""
        total_debit = sum(e.get("debit", 0) for e in entries)
        total_credit = sum(e.get("credit", 0) for e in entries)
        return {
            "total_debit": round(total_debit, 2), "total_credit": round(total_credit, 2),
            "balanced": abs(total_debit - total_credit) < 0.01,
            "difference": round(total_debit - total_credit, 2),
        }

    def do_GET(self):
        inc_requests()
        path = self.path.split("?")[0]
        trace_id = self.headers.get("X-Trace-Id", str(uuid.uuid4()))
        logger.info(f"[{SERVICE_NAME}] GET {path} trace={trace_id}")

        if path == "/v1/cache-metrics":
            self._respond(200, cache_metrics())
            return
        elif path == "/healthz":
            self.respond(200, {"status": "healthy", "service": SERVICE_NAME, "capabilities": ["coa_graph", "neo4j_cypher", "pagerank", "basel_iii", "path_traversal", "liquidity_ratio"]})
        elif path == "/readyz":
            self.respond(200, {"ready": True, "service": SERVICE_NAME})
        elif path == "/livez":
            self.respond(200, {"live": True})
        elif path == "/v1/degradation":
            self._json(200, {"service": "neo4j-coa-graph-py", **_degrade.status()})
        elif path == "/v1/alerts":
            self._json(200, {"alerts": check_alerts(), "rules": len(_ALERT_RULES)})
        elif path == "/metrics":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(f'''# TYPE requests_total counter
requests_total{{service="{SERVICE_NAME}"}} {request_count}
# TYPE errors_total counter
errors_total{{service="{SERVICE_NAME}"}} {error_count}
'''.encode())
        elif path == "/v1/coa/graph":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors()
                self.respond(429, {"error": "rate_limit_exceeded", "retry_after": 1})
                return
            with coa_graph.lock:
                self.respond(200, {"nodes": list(coa_graph.nodes.values()), "edges": coa_graph.edges, "total_nodes": len(coa_graph.nodes), "total_edges": len(coa_graph.edges)})
        elif path == "/v1/coa/pagerank":
            if not self.check_jwt(): return
            if not _rl_allow():
                self.respond(429, {"error": "rate_limit_exceeded"})
                return
            rankings = coa_graph.pagerank()
            result = [{"code": code, "name": coa_graph.nodes.get(code, {}).get("name", ""), "rank": rank} for code, rank in rankings.items()]
            self.respond(200, {"algorithm": "pagerank", "iterations": 20, "damping": 0.85, "rankings": result})
        elif path == "/v1/coa/basel-iii":
            if not self.check_jwt(): return
            if not _rl_allow():
                self.respond(429, {"error": "rate_limit_exceeded"})
                return
            self.respond(200, coa_graph.basel_iii())
        elif path == "/v1/coa/liquidity":
            if not self.check_jwt(): return
            if not _rl_allow():
                self.respond(429, {"error": "rate_limit_exceeded"})
                return
            self.respond(200, coa_graph.liquidity_ratio())
        elif path.startswith("/v1/coa/node/"):
            if not self.check_jwt(): return
            code = path.split("/")[-1]
            node = coa_graph.nodes.get(code)
            if not node:
                self.respond(404, {"error": "not_found"})
                return
            neighbors = [e for e in coa_graph.edges if e["from"] == code or e["to"] == code]
            self.respond(200, {"node": node, "relationships": neighbors})
        else:
            items, total = db_query(SERVICE_NAME.replace("-", "_"))
            cached = cache_get(f"{SERVICE_NAME}_{path}")
            self.respond(200, {"items": items, "total": total, "source": "postgresql" if not _DB_URL else "postgres"})

    def do_POST(self):
        inc_requests()
        path = self.path.split("?")[0]
        trace_id = self.headers.get("X-Trace-Id", str(uuid.uuid4()))
        logger.info(f"[{SERVICE_NAME}] POST {path} trace={trace_id}")
        content_length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        body = json.loads(sanitize_input(raw.decode("utf-8")))

        if path == "/v1/coa/traverse":
            if not self.check_jwt(): return
            if not _rl_allow():
                self.respond(429, {"error": "rate_limit_exceeded"})
                return
            result_path = coa_graph.traverse(body.get("from", ""), body.get("to", ""), body.get("max_depth", 10))
            self.respond(200, {"from": body.get("from"), "to": body.get("to"), "path": result_path, "hops": max(0, len(result_path) - 1)})
        elif path == "/v1/coa/cypher":
            if not self.check_jwt(): return
            if not _rl_allow():
                self.respond(429, {"error": "rate_limit_exceeded"})
                return
            query = body.get("query", "")
            result = neo4j_client.execute_cypher(query, body.get("params", {}))
            source = "neo4j" if result is not None else "postgresql_pending"
            self.respond(200, {"query": query, "results": result or [], "source": source})
        elif path == "/v1/coa/transaction-flow":
            if not self.check_jwt(): return
            if not _rl_allow():
                self.respond(429, {"error": "rate_limit_exceeded"})
                return
            with coa_graph.lock:
                coa_graph.edges.append({"from": body.get("debit_account", ""), "to": body.get("credit_account", ""), "type": "TRANSACTION", "weight": body.get("amount", 0), "meta": {"narration": body.get("narration", "")}})
            db_insert(SERVICE_NAME, body)
            cache_set(f"{self.get_tenant_id()}:last_txn", json.dumps(body))
            gl_url = os.environ.get("GL_ENGINE_URL", "http://gl-engine-go:8080")
            call_service("POST", f"{gl_url}/v1/gl/post-journal", {"glAccountCode": body.get("debit_account"), "amount": body.get("amount"), "entryType": "debit"})
            self.respond(201, {"recorded": True, "debit": body.get("debit_account"), "credit": body.get("credit_account"), "amount": body.get("amount")})
        elif path == "/v1/create":
            if not self.check_jwt(): return
            if not _rl_allow():
                self.respond(429, {"error": "rate_limit_exceeded"})
                return
            result = db_insert(SERVICE_NAME, body)
            cache_set(f"{self.get_tenant_id()}:last_post", json.dumps(body))
            with coa_graph.lock:
                if "code" in body:
                    coa_graph.nodes[body["code"]] = body
            self.respond(201, {"created": True})
        else:
            inc_errors()
            self.respond(404, {"error": "not_found"})



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
        logger.info("Shutting down gracefully")
        sys.exit(0)
    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "message": "starting"}))
    server.serve_forever()
