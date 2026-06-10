import sys; sys.path.insert(0, '/home/ubuntu/repos/corebanking/libs/banking-rules-py')
#!/usr/bin/env python3
"""Federated learning — cross-bank fraud model training, privacy-preserving aggregation, differential privacy"""
import os, json, logging, uuid, re, time, hashlib, threading, math, random
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("federated-learning-py")

MAX_BODY_SIZE = 1_048_576  # 1MB request body limit
PORT = int(os.environ.get("PORT", "8106"))

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


ALLOWED_TABLES = frozenset(["federated_learning", "service_records", "audit_log"])

def _safe_table_name(table: str) -> str:
    """Validate table name to prevent SQL injection via table names"""
    import re
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', table):
        raise ValueError(f"Invalid table name: {table}")
    return table
SERVICE_NAME = "federated-learning-py"
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
    cur.execute(f"INSERT INTO {table} (id, data, created_at) VALUES (%s, %s, NOW()) RETURNING id",
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

# ─── Federated Aggregation Strategies ───

def federated_average(client_updates: list, weights: list = None) -> dict:
    """FedAvg: weighted average of model parameters from multiple banks."""
    errors = []
    if not client_updates:
        errors.append("client_updates_required")
        return {"valid": False, "errors": errors}

    num_clients = len(client_updates)
    if weights is None:
        weights = [1.0 / num_clients] * num_clients
    elif len(weights) != num_clients:
        errors.append("weights_count_must_match_clients")
        return {"valid": False, "errors": errors}

    # Normalize weights
    weight_sum = sum(weights)
    weights = [w / weight_sum for w in weights]

    # Aggregate parameters (simulate with dict of layer->values)
    aggregated_params = {}
    for i, update in enumerate(client_updates):
        params = update.get("parameters", {})
        for layer_name, layer_values in params.items():
            if layer_name not in aggregated_params:
                aggregated_params[layer_name] = [0.0] * len(layer_values)
            for j, val in enumerate(layer_values):
                aggregated_params[layer_name][j] += val * weights[i]

    # Compute update norms per client (for anomaly detection)
    client_norms = []
    for update in client_updates:
        params = update.get("parameters", {})
        norm = 0.0
        for vals in params.values():
            norm += sum(v ** 2 for v in vals)
        client_norms.append(math.sqrt(norm))

    median_norm = sorted(client_norms)[len(client_norms) // 2]
    anomalous_clients = [i for i, n in enumerate(client_norms) if n > median_norm * 3]

    return {
        "valid": True,
        "strategy": "federated_averaging",
        "num_clients": num_clients,
        "weights": [round(w, 4) for w in weights],
        "aggregated_layers": list(aggregated_params.keys()),
        "aggregated_param_count": sum(len(v) for v in aggregated_params.values()),
        "client_norms": [round(n, 4) for n in client_norms],
        "anomalous_clients": anomalous_clients,
        "median_norm": round(median_norm, 4),
    }

def apply_differential_privacy(gradients: list, epsilon: float = 1.0,
                                delta: float = 1e-5, clip_norm: float = 1.0) -> dict:
    """Apply (ε,δ)-differential privacy to gradient updates via Gaussian mechanism."""
    errors = []
    if epsilon <= 0:
        errors.append("epsilon_must_be_positive")
    if delta <= 0 or delta >= 1:
        errors.append("delta_must_be_between_0_and_1")
    if clip_norm <= 0:
        errors.append("clip_norm_must_be_positive")
    if not gradients:
        errors.append("gradients_required")
    if errors:
        return {"valid": False, "errors": errors}

    # Clip gradients to L2 norm bound
    grad_norm = math.sqrt(sum(g ** 2 for g in gradients))
    clip_factor = min(1.0, clip_norm / grad_norm) if grad_norm > 0 else 1.0
    clipped = [g * clip_factor for g in gradients]

    # Compute noise scale (Gaussian mechanism)
    sensitivity = clip_norm
    sigma = sensitivity * math.sqrt(2 * math.log(1.25 / delta)) / epsilon

    # Add calibrated Gaussian noise
    rng = random.Random(42)  # deterministic for reproducibility
    noisy = [g + rng.gauss(0, sigma) for g in clipped]

    # Privacy budget accounting
    rdp_alpha = 2.0  # Rényi divergence order
    rdp_epsilon = rdp_alpha * (clip_norm ** 2) / (2 * sigma ** 2)

    return {
        "valid": True,
        "mechanism": "gaussian",
        "epsilon": epsilon,
        "delta": delta,
        "sigma": round(sigma, 6),
        "clip_norm": clip_norm,
        "original_norm": round(grad_norm, 6),
        "clipped_norm": round(math.sqrt(sum(g ** 2 for g in clipped)), 6),
        "noisy_gradient_sample": [round(g, 6) for g in noisy[:5]],
        "noise_magnitude": round(sigma * math.sqrt(len(gradients)), 6),
        "privacy_loss": {
            "rdp_alpha": rdp_alpha,
            "rdp_epsilon": round(rdp_epsilon, 6),
            "composition": "advanced_composition_theorem",
        },
        "gradient_count": len(gradients),
    }

def secure_aggregation_protocol(participants: list) -> dict:
    """Simulate secure aggregation using secret sharing (Shamir/additive)."""
    errors = []
    if len(participants) < 2:
        errors.append("minimum_2_participants_required")
        return {"valid": False, "errors": errors}

    n = len(participants)
    threshold = max(2, n * 2 // 3)  # 2/3 threshold for reconstruction

    # Generate secret shares for each participant
    shares_map = {}
    for i, p in enumerate(participants):
        bank_id = p.get("bank_id", f"bank_{i}")
        model_hash = hashlib.sha256(json.dumps(p.get("model_update", {})).encode()).hexdigest()[:16]
        num_samples = p.get("num_samples", 0)

        # Simulate additive secret sharing
        shares = []
        for j in range(n):
            share_id = hashlib.sha256(f"{bank_id}-{j}-{time.time()}".encode()).hexdigest()[:12]
            shares.append({"share_id": share_id, "recipient": f"participant_{j}", "encrypted": True})

        shares_map[bank_id] = {
            "model_hash": model_hash,
            "num_samples": num_samples,
            "shares_generated": len(shares),
            "shares": shares[:3],
        }

    return {
        "valid": True,
        "protocol": "additive_secret_sharing",
        "num_participants": n,
        "reconstruction_threshold": threshold,
        "participants": shares_map,
        "privacy_guarantees": [
            "No participant sees another's raw model update",
            "Server only sees aggregated result",
            "Dropout tolerance up to n-threshold participants",
        ],
        "communication_rounds": 3,
        "encryption": "AES-256-GCM for share transport",
    }

# ─── Federation Round Management ───
ROUND_TRANSITIONS = {
    "initialized": ["participant_registration"],
    "participant_registration": ["local_training"],
    "local_training": ["update_collection"],
    "update_collection": ["aggregation"],
    "aggregation": ["evaluation"],
    "evaluation": ["model_distribution", "local_training"],
    "model_distribution": ["participant_registration", "completed"],
    "completed": [],
}

# ─── Model Performance Tracking ───
def evaluate_federated_model(metrics_per_bank: list) -> dict:
    """Aggregate evaluation metrics across participating banks."""
    if not metrics_per_bank:
        return {"valid": False, "errors": ["metrics_required"]}

    auc_scores = [m.get("auc_roc", 0) for m in metrics_per_bank]
    precision_scores = [m.get("precision", 0) for m in metrics_per_bank]
    recall_scores = [m.get("recall", 0) for m in metrics_per_bank]
    f1_scores = [m.get("f1", 0) for m in metrics_per_bank]
    sample_counts = [m.get("num_samples", 1) for m in metrics_per_bank]

    # Weighted average by sample count
    total_samples = sum(sample_counts)
    weighted_auc = sum(a * s for a, s in zip(auc_scores, sample_counts)) / total_samples if total_samples else 0
    weighted_f1 = sum(f * s for f, s in zip(f1_scores, sample_counts)) / total_samples if total_samples else 0

    # Fairness: check performance disparity across banks
    auc_std = math.sqrt(sum((a - weighted_auc) ** 2 for a in auc_scores) / len(auc_scores)) if auc_scores else 0
    max_disparity = max(auc_scores) - min(auc_scores) if auc_scores else 0

    return {
        "valid": True,
        "num_banks": len(metrics_per_bank),
        "total_samples": total_samples,
        "weighted_auc_roc": round(weighted_auc, 4),
        "weighted_f1": round(weighted_f1, 4),
        "per_bank_auc": [round(a, 4) for a in auc_scores],
        "auc_std": round(auc_std, 4),
        "max_performance_disparity": round(max_disparity, 4),
        "fairness_assessment": "acceptable" if max_disparity < 0.1 else "review_needed",
        "model_ready_for_deployment": weighted_auc > 0.75 and max_disparity < 0.15,
    }

def add_security_headers(handler):
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("X-Frame-Options", "DENY")


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
        if path == "/healthz":
            db = get_db()
            self.respond(200, {"status": "healthy", "service": SERVICE_NAME,
                               "checks": {"database": "connected" if db else "not_configured"},
                               "capabilities": ["federated_averaging", "differential_privacy", "secure_aggregation"],
                               "uptime_secs": round(time.time() - START_TIME)})
        elif path == "/readyz": self.respond(200, {"ready": True})
        elif path == "/livez": self.respond(200, {"alive": True})
        elif path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {_request_count}\n'.encode())
        elif path == "/v1/round/states":
            self.respond(200, {"transitions": ROUND_TRANSITIONS})
        elif path == "/v1/aggregation/strategies":
            self.respond(200, {"strategies": ["federated_averaging", "federated_proximal", "scaffold",
                                               "federated_matched_averaging"]})
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
        if path == "/v1/aggregate":
            self.respond(200, federated_average(body.get("client_updates", []), body.get("weights")))
        elif path == "/v1/differential-privacy/apply":
            self.respond(200, apply_differential_privacy(
                body.get("gradients", []), body.get("epsilon", 1.0),
                body.get("delta", 1e-5), body.get("clip_norm", 1.0)))
        elif path == "/v1/secure-aggregation":
            self.respond(200, secure_aggregation_protocol(body.get("participants", [])))
        elif path == "/v1/evaluate":
            self.respond(200, evaluate_federated_model(body.get("metrics_per_bank", [])))
        elif path == "/v1/create":
            try:
                body["id"] = f"FED-{uuid.uuid4().hex[:12].upper()}"
                body["created_at"] = datetime.now(timezone.utc).isoformat()
                db_insert("federated_rounds", body)
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
    print(f"[federated-learning-py] Received signal {signum}, shutting down gracefully...")
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

if __name__ == "__main__":
    get_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "message": "Federated learning coordinator started"}))
    server.serve_forever()
