import sys; sys.path.insert(0, '/home/ubuntu/repos/corebanking/libs/banking-rules-py')
#!/usr/bin/env python3
"""Carbon footprint tracking, ESG scoring, green bond issuance, sustainability reporting"""
import os, json, logging, uuid, re, time, hashlib, threading, math
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("carbon-esg-tracker-py")

PORT = int(os.environ.get("PORT", "8105"))
SERVICE_NAME = "carbon-esg-tracker-py"
START_TIME = time.time()
_request_count = 0; _error_count = 0; _counter_lock = threading.Lock()

def mask_pii(value: str, field_type: str = "generic") -> str:
    if not value: return "***"
    if field_type in ("bvn", "nin"): return f"***{value[-4:]}" if len(value) >= 4 else "***"
    return "***"
def sanitize_log(msg: str) -> str: return re.sub(r"\b\d{11}\b", lambda m: f"***{m.group()[-4:]}", msg)
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

# ─── Carbon Emission Factors (kg CO2e per unit) ───
EMISSION_FACTORS = {
    "electricity_kwh": {"nigeria_grid": 0.43, "solar": 0.0, "diesel_gen": 0.85, "gas_gen": 0.42},
    "fuel_litre": {"petrol": 2.31, "diesel": 2.68, "lpg": 1.51, "kerosene": 2.54},
    "transport_km": {"car_petrol": 0.192, "car_diesel": 0.171, "bus": 0.089, "motorcycle": 0.114,
                     "flight_domestic": 0.255, "flight_international": 0.195},
    "waste_kg": {"landfill": 0.587, "recycled": 0.021, "composted": 0.010, "incinerated": 0.330},
    "water_m3": {"municipal": 0.344, "borehole": 0.150, "rainwater": 0.001},
    "paper_kg": {"virgin": 1.53, "recycled": 0.61},
    "digital_gb": {"data_transfer": 0.06, "cloud_storage": 0.01},
}

# ─── Scope Classification (GHG Protocol) ───
SCOPE_CLASSIFICATION = {
    "scope_1": ["fuel_combustion", "company_vehicles", "diesel_generators", "refrigerants"],
    "scope_2": ["purchased_electricity", "purchased_heat", "purchased_cooling"],
    "scope_3": ["business_travel", "employee_commute", "purchased_goods", "waste", "investments",
                "downstream_transport", "use_of_sold_products"],
}

def compute_carbon_footprint(activities: list) -> dict:
    """Compute organizational carbon footprint from activity data."""
    errors = []
    if not activities:
        errors.append("activities_list_required")
        return {"valid": False, "errors": errors}

    scope_totals = {"scope_1": 0.0, "scope_2": 0.0, "scope_3": 0.0}
    activity_results = []

    for act in activities:
        category = act.get("category", "")
        subcategory = act.get("subcategory", "")
        quantity = act.get("quantity", 0)
        unit = act.get("unit", "")

        if category not in EMISSION_FACTORS:
            errors.append(f"unknown_category:{category}")
            continue

        factors = EMISSION_FACTORS[category]
        factor = factors.get(subcategory, list(factors.values())[0])
        emissions_kg = quantity * factor

        # Determine scope
        scope = "scope_3"
        if category == "fuel_litre": scope = "scope_1"
        elif category == "electricity_kwh": scope = "scope_2"

        scope_totals[scope] += emissions_kg
        activity_results.append({
            "category": category, "subcategory": subcategory,
            "quantity": quantity, "unit": unit,
            "emission_factor": factor, "emissions_kg_co2e": round(emissions_kg, 3),
            "scope": scope,
        })

    total_emissions = sum(scope_totals.values())
    # Nigeria's NDC target: 20% reduction by 2030 from BAU
    ndc_context = "Nigeria aims 20% unconditional + 45% conditional GHG reduction by 2030 (Paris Agreement NDC)"

    return {
        "valid": True,
        "total_emissions_kg_co2e": round(total_emissions, 3),
        "total_emissions_tonnes_co2e": round(total_emissions / 1000, 3),
        "scope_breakdown": {k: round(v, 3) for k, v in scope_totals.items()},
        "scope_percentages": {k: round(v / total_emissions * 100, 1) if total_emissions > 0 else 0
                              for k, v in scope_totals.items()},
        "activities": activity_results,
        "activity_count": len(activity_results),
        "errors": errors if errors else None,
        "ndc_context": ndc_context,
    }

# ─── ESG Scoring ───
ESG_WEIGHTS = {"environmental": 0.35, "social": 0.35, "governance": 0.30}

ESG_CRITERIA = {
    "environmental": {
        "carbon_intensity": {"weight": 0.25, "description": "CO2 emissions per ₦1M revenue"},
        "renewable_energy_pct": {"weight": 0.20, "description": "Percentage of renewable energy use"},
        "waste_recycling_rate": {"weight": 0.15, "description": "Waste recycled vs landfilled"},
        "water_efficiency": {"weight": 0.15, "description": "Water consumption per employee"},
        "biodiversity_policy": {"weight": 0.10, "description": "Biodiversity protection policies"},
        "climate_risk_mgmt": {"weight": 0.15, "description": "Climate risk assessment and management"},
    },
    "social": {
        "employee_diversity": {"weight": 0.20, "description": "Gender and ethnic diversity index"},
        "health_safety": {"weight": 0.20, "description": "Workplace safety incident rate"},
        "community_investment": {"weight": 0.15, "description": "Community investment as % of profit"},
        "financial_inclusion": {"weight": 0.20, "description": "Services reaching underserved populations"},
        "data_privacy": {"weight": 0.15, "description": "NDPR compliance and data breach record"},
        "human_rights": {"weight": 0.10, "description": "Human rights due diligence"},
    },
    "governance": {
        "board_independence": {"weight": 0.20, "description": "Independent directors percentage"},
        "audit_quality": {"weight": 0.20, "description": "Audit committee effectiveness"},
        "anti_corruption": {"weight": 0.20, "description": "Anti-bribery/corruption policies and incidents"},
        "executive_compensation": {"weight": 0.15, "description": "Pay ratio and ESG-linked compensation"},
        "transparency": {"weight": 0.15, "description": "Disclosure quality and timeliness"},
        "risk_management": {"weight": 0.10, "description": "Enterprise risk framework maturity"},
    },
}

def compute_esg_score(scores: dict) -> dict:
    """Compute composite ESG score from pillar scores."""
    pillar_scores = {}
    pillar_details = {}

    for pillar, criteria in ESG_CRITERIA.items():
        pillar_input = scores.get(pillar, {})
        weighted_sum = 0.0
        details = []

        for criterion, spec in criteria.items():
            value = pillar_input.get(criterion, 50)  # default to 50/100
            value = max(0, min(100, value))
            weighted_score = value * spec["weight"]
            weighted_sum += weighted_score
            details.append({
                "criterion": criterion, "score": value, "weight": spec["weight"],
                "weighted_score": round(weighted_score, 2), "description": spec["description"],
            })

        pillar_scores[pillar] = round(weighted_sum, 2)
        pillar_details[pillar] = details

    composite = sum(pillar_scores[p] * ESG_WEIGHTS[p] for p in ESG_WEIGHTS)
    rating_map = [(90, "AAA"), (80, "AA"), (70, "A"), (60, "BBB"), (50, "BB"), (40, "B"), (30, "CCC"), (0, "D")]
    rating = next((r for threshold, r in rating_map if composite >= threshold), "D")

    return {
        "composite_score": round(composite, 2),
        "rating": rating,
        "pillar_scores": pillar_scores,
        "pillar_weights": ESG_WEIGHTS,
        "pillar_details": pillar_details,
        "benchmark": "Nigeria Sustainability Banking Principles (NSBP)",
        "framework": "GRI_Standards_2021 + TCFD + SASB",
    }

# ─── Green Bond Framework ───
def evaluate_green_bond(bond: dict) -> dict:
    """Evaluate green bond eligibility per ICMA Green Bond Principles."""
    use_of_proceeds = bond.get("use_of_proceeds", [])
    amount_kobo = bond.get("amount_kobo", 0)

    eligible_categories = {
        "renewable_energy": {"eligible": True, "sdg": [7, 13]},
        "energy_efficiency": {"eligible": True, "sdg": [7, 11]},
        "clean_transportation": {"eligible": True, "sdg": [11, 13]},
        "green_buildings": {"eligible": True, "sdg": [11]},
        "pollution_prevention": {"eligible": True, "sdg": [6, 14, 15]},
        "sustainable_water": {"eligible": True, "sdg": [6]},
        "climate_adaptation": {"eligible": True, "sdg": [13]},
        "circular_economy": {"eligible": True, "sdg": [12]},
        "biodiversity": {"eligible": True, "sdg": [14, 15]},
    }

    eligible_uses = []
    ineligible_uses = []
    total_sdgs = set()

    for use in use_of_proceeds:
        cat = use.get("category", "")
        if cat in eligible_categories:
            eligible_uses.append({**use, "sdg_alignment": eligible_categories[cat]["sdg"]})
            total_sdgs.update(eligible_categories[cat]["sdg"])
        else:
            ineligible_uses.append(use)

    eligible_pct = len(eligible_uses) / len(use_of_proceeds) * 100 if use_of_proceeds else 0
    is_eligible = eligible_pct >= 95 and len(ineligible_uses) == 0

    return {
        "eligible": is_eligible,
        "eligible_percentage": round(eligible_pct, 1),
        "amount_kobo": amount_kobo,
        "eligible_uses": eligible_uses,
        "ineligible_uses": ineligible_uses,
        "sdg_alignment": sorted(total_sdgs),
        "framework": "ICMA_Green_Bond_Principles_2021",
        "nigerian_regulation": "SEC_Green_Bond_Rules_2018",
        "listing": "FMDQ_Green_Bond_Segment",
        "external_review": "required_second_party_opinion",
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
                               "uptime_secs": round(time.time() - START_TIME)})
        elif path == "/readyz": self.respond(200, {"ready": True})
        elif path == "/livez": self.respond(200, {"alive": True})
        elif path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {_request_count}\n'.encode())
        elif path == "/v1/emission-factors":
            self.respond(200, {"emission_factors": EMISSION_FACTORS})
        elif path == "/v1/esg/criteria":
            self.respond(200, {"criteria": {p: {k: v["description"] for k, v in c.items()} for p, c in ESG_CRITERIA.items()}})
        elif path == "/v1/scope-classification":
            self.respond(200, SCOPE_CLASSIFICATION)
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
        if path == "/v1/carbon/calculate":
            self.respond(200, compute_carbon_footprint(body.get("activities", [])))
        elif path == "/v1/esg/score":
            self.respond(200, compute_esg_score(body.get("scores", {})))
        elif path == "/v1/green-bond/evaluate":
            self.respond(200, evaluate_green_bond(body))
        elif path == "/v1/create":
            try:
                body["id"] = f"CAR-{uuid.uuid4().hex[:12].upper()}"
                body["created_at"] = datetime.now(timezone.utc).isoformat()
                db_insert("carbon_esg", body)
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
    print(f"[carbon-esg-tracker-py] Received signal {signum}, shutting down gracefully...")
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
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "message": "Carbon/ESG tracker started"}))
    server.serve_forever()
