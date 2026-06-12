import sys; sys.path.insert(0, '/home/ubuntu/repos/corebanking/libs/banking-rules-py')
#!/usr/bin/env python3
"""Real-time streaming analytics — transaction aggregation, anomaly detection, dashboard metrics"""
import os, json, logging, uuid, re, time, hashlib, threading, math, collections
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("realtime-analytics-py")

MAX_BODY_SIZE = 1_048_576  # 1MB request body limit
PORT = int(os.environ.get("PORT", "8107"))

def sanitize_log_entry(msg: str) -> str:
    """Remove sensitive data from log messages."""
    import re as _re
    msg = _re.sub(r'\b\d{11}\b', '***BVN***', msg)  # BVN
    msg = _re.sub(r'\b\d{10}\b', '***NUBAN***', msg)  # NUBAN
    msg = _re.sub(r'[\w.+-]+@[\w-]+\.[\w.]+', '***EMAIL***', msg)  # Email
    msg = _re.sub(r'\+?234\d{10}', '***PHONE***', msg)  # Nigerian phone
    return msg


# ═══════════════════════════════════════════════════════════════════════════════
# ML ANOMALY DETECTION INTEGRATION
# Calls ML inference server for real-time transaction anomaly scoring
# ═══════════════════════════════════════════════════════════════════════════════

ML_INFERENCE_URL = os.environ.get("ML_INFERENCE_URL", "http://ml-inference-server:8500")



# ── Database Layer ──────────────────────────────────────────────────────────
import contextlib

_db_pool = None

def get_db_pool():
    """Get or create database connection pool."""
    global _db_pool
    if _db_pool is not None:
        return _db_pool
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        return None
    try:
        import psycopg2
        import psycopg2.pool
        _db_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2, maxconn=10, dsn=db_url,
            options="-c statement_timeout=30000"  # 30s query timeout
        )
        return _db_pool
    except Exception as e:
        logging.warning(f"DB pool init failed: {e}")
        return None

@contextlib.contextmanager
def db_conn():
    """Context manager for DB connections with automatic return to pool."""
    pool = get_db_pool()
    if pool is None:
        yield None
        return
    conn = None
    try:
        conn = pool.getconn()
        conn.autocommit = False
        yield conn
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            try:
                conn.commit()
            except Exception:
                conn.rollback()
            pool.putconn(conn)

def db_query(sql, params=None):
    """Execute a DB query and return results as list of dicts."""
    with db_conn() as conn:
        if conn is None:
            return None
        try:
            cur = conn.cursor()
            cur.execute(sql, params or ())
            if cur.description:
                cols = [d[0] for d in cur.description]
                return [dict(zip(cols, row)) for row in cur.fetchall()]
            return []
        except Exception as e:
            logging.error(f"DB query error: {sanitize_log_entry(str(e))}")
            conn.rollback()
            return None

def db_execute(sql, params=None):
    """Execute a DB write and return affected row count."""
    with db_conn() as conn:
        if conn is None:
            return None
        try:
            cur = conn.cursor()
            cur.execute(sql, params or ())
            return cur.rowcount
        except Exception as e:
            logging.error(f"DB execute error: {sanitize_log_entry(str(e))}")
            conn.rollback()
            return None

STRICT_DB = os.environ.get("STRICT_DB", "false").lower() == "true"


def ml_score_anomaly(amount: float, hour: int, day_of_week: int,
                     velocity_1h: int, velocity_24h: int,
                     amount_vs_avg: float, balance_ratio: float,
                     merchant_cat_idx: int = 0, channel_idx: int = 0):
    """Call ML anomaly detection model. Returns dict or None on failure."""
    try:
        payload = json.dumps({
            "amount": amount, "hour": hour, "day_of_week": day_of_week,
            "velocity_1h": velocity_1h, "velocity_24h": velocity_24h,
            "amount_vs_avg": amount_vs_avg, "balance_ratio": balance_ratio,
            "merchant_cat_idx": merchant_cat_idx, "channel_idx": channel_idx,
        }).encode()
        req = urllib.request.Request(
            f"{ML_INFERENCE_URL}/v1/anomaly/score",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            result = json.loads(resp.read().decode())
            logger.info(f"ML_ANOMALY: score={result.get('anomaly_score', 0):.4f} "
                       f"is_anomaly={result.get('is_anomaly', False)}")
            return result
    except Exception as e:
        logger.debug(f"ML anomaly scoring unavailable: {e}")
        return None


def process_transaction_with_ml(transaction: dict):
    """Process a transaction through both rule-based and ML anomaly detection.
    
    Returns: {"rule_score": float, "ml_score": float|None, "is_anomaly": bool, "action": str}
    """
    amount = transaction.get("amount", 0)
    hour = transaction.get("hour", 12)
    day = transaction.get("day_of_week", 3)
    velocity_1h = transaction.get("velocity_1h", 1)
    velocity_24h = transaction.get("velocity_24h", 5)
    avg = transaction.get("customer_avg_amount", 50000)
    balance = transaction.get("balance", 500000)
    
    amount_vs_avg = amount / max(avg, 1)
    balance_ratio = amount / max(balance, 1)
    
    # Call ML model
    ml_result = ml_score_anomaly(amount, hour, day, velocity_1h, velocity_24h, amount_vs_avg, balance_ratio)
    
    ml_score = ml_result.get("anomaly_score") if ml_result else None
    is_anomaly = ml_result.get("is_anomaly", False) if ml_result else False
    
    # Combined decision: ML model + rule-based z-score
    rule_score = amount_vs_avg  # simplified rule-based
    
    if ml_score is not None and ml_score > 0.7:
        action = "block"
    elif ml_score is not None and ml_score > 0.4:
        action = "flag"
    elif is_anomaly:
        action = "review"
    elif rule_score > 5.0:
        action = "flag"
    else:
        action = "allow"
    
    return {
        "rule_score": round(rule_score, 4),
        "ml_score": round(ml_score, 4) if ml_score is not None else None,
        "is_anomaly": is_anomaly,
        "action": action,
        "ml_available": ml_result is not None,
    }


# Nigerian banking input validation
import re as _re

def validate_bvn(bvn: str) -> bool:
    """Validate 11-digit BVN"""
    return bool(bvn and len(bvn) == 11 and bvn.isdigit())

def validate_nuban(account_no: str) -> bool:
    """Validate 10-digit NUBAN account number"""
    return bool(account_no and len(account_no) == 10 and account_no.isdigit())

def validate_nigerian_phone(phone: str) -> bool:
    """Validate Nigerian phone number (+234... or 0...)"""
    clean = phone.replace(" ", "").replace("-", "")
    if clean.startswith("+234") and len(clean) == 14 and clean[1:].isdigit():
        return True
    if clean.startswith("0") and len(clean) == 11 and clean.isdigit():
        return True
    return False

def sanitize_input(s: str, max_len: int = 1000) -> str:
    """Strip control chars, limit length"""
    s = s[:max_len]
    return "".join(c for c in s if ord(c) >= 32 and ord(c) != 127)

def validate_amount_kobo(amount: int) -> bool:
    """Validate transaction amount in kobo (0 < amount <= 5B naira)"""
    return 0 < amount <= 500_000_000_000  # max ₦5B in kobo


ALLOWED_TABLES = frozenset(["realtime_analytics", "service_records", "audit_log"])

def _safe_table_name(table: str) -> str:
    """Validate table name to prevent SQL injection via table names"""
    import re
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', table):
        raise ValueError(f"Invalid table name: {table}")
    return table
SERVICE_NAME = "realtime-analytics-py"
START_TIME = time.time()
_request_count = 0; _error_count = 0; _counter_lock = threading.Lock()

def mask_pii(value: str, field_type: str = "generic") -> str:
    if not value: return "***"
    if field_type in ("bvn", "nin"): return f"***{value[-4:]}" if len(value) >= 4 else "***"
    return "***"
def inc_requests():
    global _request_count
    with _counter_lock: _request_count += 1
def inc_errors():
    global _error_count
    with _counter_lock: _error_count += 1

_db = None
def get_db():
    global _db
    if _db is None:
        db_url = os.environ.get("DATABASE_URL")
        if db_url:
            try:
                import psycopg2; _db = psycopg2.connect(db_url); _db.autocommit = True
            except Exception as e: logger.error(f"DB failed: {e}")
    return _db
def db_insert(table, data):
    db = get_db()
    if not db: raise ConnectionError("database_unavailable")
    cur = db.cursor()
    cur.execute(f"INSERT INTO {_safe_table_name(table)} (id, data, created_at) VALUES (%s, %s, NOW()) RETURNING id",
                (data.get("id", str(uuid.uuid4())), json.dumps(data)))
    return cur.fetchone()[0]
def validate_jwt(headers):
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "): return None, "missing_bearer_token"
    parts = auth[7:].split(".")
    if len(parts) != 3: return None, "invalid_jwt_format"
    try:
        import base64
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
        if payload.get("exp", float("inf")) < time.time(): return None, "token_expired"
        return payload, None
    except Exception: return None, "jwt_decode_failed"

_rl_tokens = 100.0; _rl_last = time.time(); _rl_lock = threading.Lock()
def _rl_allow():
    global _rl_tokens, _rl_last
    with _rl_lock:
        now = time.time(); _rl_tokens = min(100.0, _rl_tokens + (now - _rl_last) * 10); _rl_last = now
        if _rl_tokens >= 1: _rl_tokens -= 1; return True
        return False

# ─── Sliding Window Aggregation ───
class SlidingWindow:
    """Time-based sliding window for streaming aggregation."""
    def __init__(self, window_seconds: int = 300, slide_seconds: int = 60):
        self.window_seconds = window_seconds
        self.slide_seconds = slide_seconds
        self.events = collections.deque()
        self.lock = threading.Lock()

    def add(self, event: dict):
        with self.lock:
            event["_ts"] = time.time()
            self.events.append(event)
            self._evict()

    def _evict(self):
        cutoff = time.time() - self.window_seconds
        while self.events and self.events[0]["_ts"] < cutoff:
            self.events.popleft()

    def aggregate(self) -> dict:
        with self.lock:
            self._evict()
            events = list(self.events)

        if not events:
            return {"count": 0, "window_seconds": self.window_seconds}

        amounts = [e.get("amount_kobo", 0) for e in events]
        channels = collections.Counter(e.get("channel", "unknown") for e in events)
        statuses = collections.Counter(e.get("status", "unknown") for e in events)
        types = collections.Counter(e.get("txn_type", "unknown") for e in events)

        return {
            "count": len(events),
            "window_seconds": self.window_seconds,
            "total_amount_kobo": sum(amounts),
            "avg_amount_kobo": int(sum(amounts) / len(amounts)) if amounts else 0,
            "min_amount_kobo": min(amounts) if amounts else 0,
            "max_amount_kobo": max(amounts) if amounts else 0,
            "tps": round(len(events) / self.window_seconds, 2),
            "channel_distribution": dict(channels),
            "status_distribution": dict(statuses),
            "type_distribution": dict(types),
            "p50_amount_kobo": sorted(amounts)[len(amounts) // 2] if amounts else 0,
            "p99_amount_kobo": sorted(amounts)[int(len(amounts) * 0.99)] if len(amounts) > 1 else (amounts[0] if amounts else 0),
        }

# Per-channel windows
_windows = {
    "global": SlidingWindow(300, 60),
    "nip": SlidingWindow(300, 60),
    "ussd": SlidingWindow(300, 60),
    "pos": SlidingWindow(300, 60),
    "atm": SlidingWindow(300, 60),
    "mobile": SlidingWindow(300, 60),
    "web": SlidingWindow(300, 60),
}

# ─── Anomaly Detection (Z-Score) ───
class StreamingStats:
    """Welford's online algorithm for streaming mean/variance."""
    def __init__(self):
        self.n = 0
        self.mean = 0.0
        self.M2 = 0.0
        self.lock = threading.Lock()

    def update(self, value: float):
        with self.lock:
            self.n += 1
            delta = value - self.mean
            self.mean += delta / self.n
            delta2 = value - self.mean
            self.M2 += delta * delta2

    def variance(self) -> float:
        with self.lock:
            return self.M2 / self.n if self.n > 1 else 0.0

    def std(self) -> float:
        return math.sqrt(self.variance())

    def z_score(self, value: float) -> float:
        s = self.std()
        return abs(value - self.mean) / s if s > 0 else 0.0

    def stats(self) -> dict:
        return {"n": self.n, "mean": round(self.mean, 2), "std": round(self.std(), 2),
                "variance": round(self.variance(), 2)}

_amount_stats = StreamingStats()
_velocity_stats = StreamingStats()

def detect_anomaly(txn: dict) -> dict:
    """Detect anomalous transactions using streaming z-score."""
    amount = txn.get("amount_kobo", 0)
    _amount_stats.update(amount)

    amount_z = _amount_stats.z_score(amount)
    velocity_z = 0.0

    # Velocity check
    account_id = txn.get("account_id", "")
    if account_id:
        # Count recent transactions for this account
        with _windows["global"].lock:
            recent = sum(1 for e in _windows["global"].events if e.get("account_id") == account_id)
        _velocity_stats.update(recent)
        velocity_z = _velocity_stats.z_score(recent)

    is_anomaly = amount_z > 3.0 or velocity_z > 3.0
    risk_factors = []
    if amount_z > 3.0: risk_factors.append(f"amount_z_score:{amount_z:.2f}")
    if velocity_z > 3.0: risk_factors.append(f"velocity_z_score:{velocity_z:.2f}")

    # NFIU threshold check
    nfiu_flags = []
    if amount >= 5_000_000_00:  # ₦5M in kobo
        nfiu_flags.append("cash_threshold_5M")
    if amount >= 10_000_000_00:  # ₦10M in kobo
        nfiu_flags.append("transfer_threshold_10M")

    return {
        "is_anomaly": is_anomaly,
        "amount_z_score": round(amount_z, 4),
        "velocity_z_score": round(velocity_z, 4),
        "risk_factors": risk_factors,
        "nfiu_flags": nfiu_flags,
        "amount_stats": _amount_stats.stats(),
        "threshold": {"amount_z": 3.0, "velocity_z": 3.0},
        "recommendation": "flag_for_review" if is_anomaly else "allow",
    }

# ─── KPI Computation ───
def compute_kpis(window_data: dict) -> dict:
    """Compute real-time banking KPIs from window aggregation."""
    count = window_data.get("count", 0)
    total = window_data.get("total_amount_kobo", 0)
    statuses = window_data.get("status_distribution", {})

    success = statuses.get("success", 0) + statuses.get("completed", 0)
    failed = statuses.get("failed", 0) + statuses.get("error", 0)
    pending = statuses.get("pending", 0)

    success_rate = success / count * 100 if count > 0 else 0
    tps = window_data.get("tps", 0)

    # SLA thresholds
    sla_success_target = 99.5
    sla_latency_p99_ms = 500

    return {
        "transaction_count": count,
        "total_volume_kobo": total,
        "tps": tps,
        "success_rate_pct": round(success_rate, 2),
        "failure_count": failed,
        "pending_count": pending,
        "avg_transaction_kobo": window_data.get("avg_amount_kobo", 0),
        "sla_compliance": {
            "success_rate_target": sla_success_target,
            "success_rate_met": success_rate >= sla_success_target,
            "latency_target_ms": sla_latency_p99_ms,
        },
        "channel_breakdown": window_data.get("channel_distribution", {}),
        "alerts": [
            {"type": "low_success_rate", "active": success_rate < sla_success_target,
             "threshold": sla_success_target, "current": round(success_rate, 2)},
            {"type": "high_failure_rate", "active": failed > count * 0.05 if count > 0 else False,
             "threshold": "5%", "current": round(failed / count * 100, 2) if count > 0 else 0},
        ],
    }

# ─── Heatmap Data ───
def generate_heatmap(events: list, group_by: str = "hour") -> dict:
    """Generate transaction heatmap data grouped by time."""
    if not events:
        return {"groups": [], "group_by": group_by}

    groups = collections.defaultdict(lambda: {"count": 0, "total_kobo": 0, "channels": collections.Counter()})

    for e in events:
        ts = e.get("_ts", time.time())
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)

        if group_by == "hour":
            key = dt.strftime("%Y-%m-%d %H:00")
        elif group_by == "minute":
            key = dt.strftime("%Y-%m-%d %H:%M")
        else:
            key = dt.strftime("%Y-%m-%d")

        groups[key]["count"] += 1
        groups[key]["total_kobo"] += e.get("amount_kobo", 0)
        groups[key]["channels"][e.get("channel", "unknown")] += 1

    result = []
    for key in sorted(groups.keys()):
        g = groups[key]
        result.append({
            "period": key, "count": g["count"], "total_kobo": g["total_kobo"],
            "avg_kobo": g["total_kobo"] // g["count"] if g["count"] else 0,
            "channels": dict(g["channels"]),
        })

    return {"groups": result, "group_by": group_by, "total_periods": len(result)}

def add_security_headers(handler):
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("X-Frame-Options", "DENY")
    handler.send_header("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'")


# --- Rate Limiter (Token Bucket) ---
import threading as _threading
import time as _time

class _RateLimiter:
    def __init__(self, rate=100, burst=200):
        self._rate = rate
        self._burst = burst
        self._tokens = {}
        self._lock = _threading.Lock()

    def allow(self, key="global"):
        with self._lock:
            now = _time.monotonic()
            if key not in self._tokens:
                self._tokens[key] = (self._burst, now)
                return True
            tokens, last = self._tokens[key]
            elapsed = now - last
            tokens = min(self._burst, tokens + elapsed * self._rate)
            if tokens >= 1:
                self._tokens[key] = (tokens - 1, now)
                return True
            return False

_rate_limiter = _RateLimiter()


# --- Input Sanitization ---
import html as _html_mod

def sanitize(s):
    if not isinstance(s, str): return s
    return _html_mod.escape(s.strip()[:2000])


def _get_request_id(handler):
    """Extract or generate X-Request-Id for tracing."""
    import uuid
    request_id = handler.headers.get('X-Request-Id', str(uuid.uuid4()))
    handler.send_header('X-Request-Id', request_id)
    return request_id


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass
    def respond(self, code, data):
        if code >= 400: inc_errors()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        add_security_headers(self)
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):
        inc_requests()
        if not _rl_allow(): self.respond(429, {"error": "rate_limit_exceeded"}); return
        path = urlparse(self.path).path
        params = parse_qs(urlparse(self.path).query)
        if path == "/healthz":
            db = get_db()
            self.respond(200, {"status": "healthy", "service": SERVICE_NAME,
                               "checks": {"database": "connected" if db else "not_configured"},
                               "windows": {k: v.aggregate()["count"] for k, v in _windows.items()},
                               "uptime_secs": round(time.time() - START_TIME)})
        elif path == "/readyz": self.respond(200, {"ready": True})
        elif path == "/livez": self.respond(200, {"alive": True})
        elif path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {_request_count}\n'.encode())
        elif path == "/v1/aggregate":
            channel = params.get("channel", ["global"])[0]
            window = _windows.get(channel, _windows["global"])
            self.respond(200, window.aggregate())
        elif path == "/v1/aggregate/all":
            self.respond(200, {ch: w.aggregate() for ch, w in _windows.items()})
        elif path == "/v1/kpis":
            self.respond(200, compute_kpis(_windows["global"].aggregate()))
        elif path == "/v1/heatmap":
            group_by = params.get("group_by", ["hour"])[0]
            with _windows["global"].lock:
                events = list(_windows["global"].events)
            self.respond(200, generate_heatmap(events, group_by))
        elif path == "/v1/anomaly/stats":
            self.respond(200, {"amount_stats": _amount_stats.stats(), "velocity_stats": _velocity_stats.stats()})
        else: self.respond(404, {"error": "not_found"})

    def do_POST(self):
        inc_requests()
        if not _rl_allow(): self.respond(429, {"error": "rate_limit_exceeded"}); return
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()) if int(self.headers.get("Content-Length", 0)) > 0 else {}
        except json.JSONDecodeError: self.respond(400, {"error": "invalid_json"}); return
        path = urlparse(self.path).path
        claims, err = validate_jwt(dict(self.headers))
        if err: self.respond(401, {"error": "unauthorized", "detail": err}); return
        if path == "/v1/ingest":
            events = body.get("events", [body] if "amount_kobo" in body else [])
            ingested = 0
            for event in events:
                channel = event.get("channel", "unknown")
                _windows["global"].add(event)
                if channel in _windows:
                    _windows[channel].add(event)
                ingested += 1
            self.respond(200, {"ingested": ingested, "window_count": _windows["global"].aggregate()["count"]})
        elif path == "/v1/detect-anomaly":
            self.respond(200, detect_anomaly(body))
        elif path == "/v1/create":
            try:
                body["id"] = f"ANA-{uuid.uuid4().hex[:12].upper()}"
                body["created_at"] = datetime.now(timezone.utc).isoformat()
                db_insert("analytics_events", body)
                self.respond(201, {"created": True, "data": body})
            except ConnectionError: self.respond(503, {"error": "database_unavailable"})
            except Exception as e: logger.error(f"Write failed: {e}"); self.respond(500, {"error": "write_failed"})
        else: self.respond(404, {"error": "not_found"})



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

import signal
import sys

# --- Circuit Breaker ---
import time as _cb_time

class CircuitBreaker:
    """Circuit breaker: opens after threshold failures, resets after timeout."""
    CLOSED, OPEN, HALF_OPEN = 0, 1, 2
    def __init__(self, threshold=5, timeout=30):
        self.state = self.CLOSED
        self.fail_count = 0
        self.threshold = threshold
        self.timeout = timeout
        self.last_fail = 0
    def allow(self):
        if self.state == self.CLOSED: return True
        if self.state == self.OPEN and _cb_time.monotonic() - self.last_fail > self.timeout:
            self.state = self.HALF_OPEN
            return True
        return self.state == self.HALF_OPEN
    def record_success(self): self.fail_count = 0; self.state = self.CLOSED
    def record_failure(self):
        self.fail_count += 1
        self.last_fail = _cb_time.monotonic()
        if self.fail_count >= self.threshold: self.state = self.OPEN

_circuit_breaker = CircuitBreaker()


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

# --- Retry with Exponential Backoff ---
import time as _retry_time

def retry_with_backoff(fn, max_retries=3, base_delay=0.1):
    """Retry a function with exponential backoff."""
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception:
            if attempt == max_retries - 1:
                raise
            delay = min(base_delay * (2 ** attempt), 5.0)
            _retry_time.sleep(delay)

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

        handler_self.send_header("Access-Control-Allow-Origin", origin)
    else:
        handler_self.send_header("Access-Control-Allow-Origin", "https://dashboard.54bank.ng")
    handler_self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    handler_self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key, X-Tenant-ID")
    handler_self.send_header("Access-Control-Max-Age", "86400")


def _graceful_shutdown(signum, frame):
    print(f"[realtime-analytics-py] Received signal {signum}, shutting down gracefully...")
    sys.exit(0)

signal.signal(signal.SIGTERM, _graceful_shutdown)
signal.signal(signal.SIGINT, _graceful_shutdown)

_audit_log = []  # Append-only. No deletion permitted.

def append_audit_entry(service: str, operation: str, actor_id: str, entity_id: str,
                       entity_type: str, old_state: str = "", new_state: str = "", ip: str = ""):
    """Append immutable audit entry with tamper-detection checksum."""
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


# --- Event Bus (Kafka-compatible event emission) ---

class EventBus:
    """Publishes domain events to Kafka topics for downstream consumption."""

    def __init__(self, topic: str, service: str):
        self._broker = os.environ.get("KAFKA_BROKERS", "localhost:9092")
        self._topic = topic
        self._service = service
        self._buffer: list = []
        self._lock = threading.Lock()

    def emit(self, event_type: str, payload: dict) -> None:
        """Emit a domain event. In production: kafka-python producer."""
        event = {{
            "id": f"{{self._service}}_{{int(time.time() * 1000)}}",
            "type": event_type,
            "source": self._service,
            "topic": self._topic,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "data": payload,
        }}
        with self._lock:
            self._buffer.append(event)
        logger.info(f"[EventBus] {{self._service}} -> {{self._topic}}: {{event_type}}")

    def flush(self) -> list:
        with self._lock:
            events = self._buffer[:]
            self._buffer.clear()
        return events

    def pending_count(self) -> int:
        return len(self._buffer)


class EventConsumer:
    """Subscribes to Kafka topics for incoming events."""

    def __init__(self, topics: list, group_id: str):
        self._topics = topics
        self._group_id = group_id
        self._handlers: dict = {{}}

    def on(self, event_type: str, handler):
        self._handlers[event_type] = handler

    def start(self):
        logger.info(f"[EventConsumer] Subscribing to {{self._topics}} as {{self._group_id}}")
        # In production: kafka-python KafkaConsumer with group_id


def notify_downstream(service_url: str, path: str, payload: dict) -> bool:
    """Notify a downstream service via HTTP with retry."""
    try:
        resp = call_service("POST", f"{{service_url}}{{path}}", payload)
        return resp is not None
    except Exception as e:
        logger.warning(f"[Downstream] {{service_url}}{{path}} failed: {{e}}")
        return False


_event_bus = EventBus("platform.events", "realtime-analytics")


# --- Data Flow Emit Point ---
def emit_processing_event(action: str, data: dict) -> None:
    """Called by handlers after successful processing."""
    _event_bus.emit("realtime-analytics." + action, data)

if __name__ == "__main__":
    get_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "message": "Realtime analytics started",
                            "windows": list(_windows.keys())}))
    server.serve_forever()
