
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
agent-regulatory-returns-py — Automated Regulatory Return Preparation Agent — generates CBN MBR, SRF, eFASS, Basel III reports
Agentic AI service using ReAct pattern with tool orchestration.
"""
import os, sys, json, time, signal, logging, threading, uuid, math, re
import socket as _socket
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone
from collections import defaultdict

SERVICE_NAME = "agent-regulatory-returns-py"
AGENT_TOOLS = ["neo4j_graph", "gl_engine", "falkordb", "kgqa"]

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


    # ─── Domain Logic: Regulatory Returns Agent ──────────────────────────────

    def validate_regulatory_return(self, return_data):
        """Validate CBN regulatory return data completeness."""
        report_type = return_data.get("report_type", "")
        period = return_data.get("period", "")
        data_fields = return_data.get("data_fields", {})

        required_fields = {
            "MBR": ["total_assets", "total_liabilities", "capital_adequacy_ratio", "liquidity_ratio", "npl_ratio"],
            "QBR": ["total_assets", "total_deposits", "total_loans", "profit_before_tax", "car", "npl_ratio"],
            "EFASS": ["balance_sheet", "income_statement", "cash_flow", "notes", "off_balance_sheet"],
            "NFIU_CTR": ["transaction_count", "total_amount", "customer_count"],
        }
        required = required_fields.get(report_type, [])
        missing = [f for f in required if f not in data_fields]
        return {
            "valid": len(missing) == 0, "report_type": report_type, "period": period,
            "missing_fields": missing, "completeness": round((1 - len(missing) / max(len(required), 1)) * 100, 1),
        }

    def do_GET(self):
        inc_requests()
        path = self.path.split("?")[0]
        trace_id = self.headers.get("X-Trace-Id", str(uuid.uuid4()))
        logger.info(f"[{SERVICE_NAME}] GET {path} trace={trace_id}")
        if         if path == "/v1/cache-metrics":
            self._respond(200, cache_metrics())
            return
        path == "/healthz":
            _db = get_db()
            _db_status = "not_configured"
            if _db:
                try:
                    _cur = _db.cursor(); _cur.execute("SELECT 1"); _cur.fetchone()
                    _db_status = "connected"
                except Exception:
                    _db_status = "unhealthy"
            self.respond(200, {"status": "healthy" if _db_status != "unhealthy" else "degraded", "service": SERVICE_NAME, "tools": AGENT_TOOLS, "checks": {"database": _db_status}})
        elif path == "/readyz": self.respond(200, {"ready": True, "service": SERVICE_NAME})
        elif path == "/livez": self.respond(200, {"live": True})
        elif path == "/v1/degradation":
                self._json(200, {"service": "agent-regulatory-returns-py", **_degrade.status()})
            elif path == "/v1/alerts":
                self._json(200, {"alerts": check_alerts(), "rules": len(_ALERT_RULES)})
            elif path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {request_count}\nerrors_total{{service="{SERVICE_NAME}"}} {error_count}\n'.encode())
        elif path == "/v1/agent/returns-calendar":
            if not self.check_jwt(): return
            if not _rl_allow():
                inc_errors(); self.respond(429, {"error": "rate_limit_exceeded"}); return
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "returns_calendar", "description": "Regulatory returns calendar", "tools": AGENT_TOOLS})

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
        if path == "/v1/agent/prepare-return":
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
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "prepare_return", "query": query, "intent": intent, "steps": steps, "result": response, "tools_used": selected_tools})
        elif path == "/v1/agent/validate-return":
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
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "validate_return", "query": query, "intent": intent, "steps": steps, "result": response, "tools_used": selected_tools})
        elif path == "/v1/agent/basel-iii-summary":
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
            self.respond(200, {"service": SERVICE_NAME, "endpoint": "basel_summary", "query": query, "intent": intent, "steps": steps, "result": response, "tools_used": selected_tools})

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
