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

#!/usr/bin/env python3
"""54Bank NDPR Compliance Service — Nigeria Data Protection Regulation"""
import os, json, logging, hashlib, uuid
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ndpr-compliance")

MAX_BODY_SIZE = 1_048_576  # 1MB request body limit
PORT = int(os.environ.get("PORT", "8095"))

# --- NDPR Data Processing Purposes (Section 2.2) ---
LAWFUL_BASES = ["consent", "contract", "legal_obligation", "vital_interest", "public_interest", "legitimate_interest"]
DATA_PURPOSES = [
    "account_management", "transaction_processing", "kyc_verification",
    "aml_screening", "credit_scoring", "marketing", "analytics",
    "fraud_detection", "regulatory_reporting", "customer_support"
]

# --- NDPR Data Retention Periods (Section 2.3) ---
RETENTION_POLICIES = {
    "transaction_records": {"years": 7, "basis": "CBN_regulation"},
    "kyc_documents": {"years": 10, "basis": "CBN_KYC_AML"},
    "audit_logs": {"years": 5, "basis": "NDPR_Section_2.3"},
    "marketing_consents": {"years": 2, "basis": "NDPR_consent_refresh"},
    "customer_communications": {"years": 3, "basis": "dispute_resolution"},
    "credit_reports": {"years": 6, "basis": "credit_bureau_regulation"},
    "employee_records": {"years": 7, "basis": "labor_law"},
    "session_logs": {"days": 90, "basis": "security_monitoring"},
}

# --- PII Field Registry ---
PII_FIELDS = {
    "bvn": {"sensitivity": "critical", "mask_pattern": "***{last4}", "retention": "kyc_documents"},
    "nin": {"sensitivity": "critical", "mask_pattern": "***{last4}", "retention": "kyc_documents"},
    "phone_number": {"sensitivity": "high", "mask_pattern": "+234***{last4}", "retention": "account_management"},
    "email": {"sensitivity": "high", "mask_pattern": "{first}***@{domain}", "retention": "account_management"},
    "account_number": {"sensitivity": "critical", "mask_pattern": "****{last4}", "retention": "transaction_records"},
    "date_of_birth": {"sensitivity": "high", "mask_pattern": "****-**-**", "retention": "kyc_documents"},
    "address": {"sensitivity": "medium", "mask_pattern": "***", "retention": "kyc_documents"},
    "full_name": {"sensitivity": "medium", "mask_pattern": "{first_initial}. {last}", "retention": "account_management"},
    "passport_number": {"sensitivity": "critical", "mask_pattern": "***{last3}", "retention": "kyc_documents"},
    "salary": {"sensitivity": "high", "mask_pattern": "***", "retention": "credit_reports"},
    "ip_address": {"sensitivity": "medium", "mask_pattern": "{first_octet}.*.*.*", "retention": "session_logs"},
}

# --- Consent Manager ---
class ConsentManager:
    def __init__(self):
        self.consents = {}  # user_id -> {purpose -> consent_record}
    
    def grant_consent(self, user_id, purpose, legal_basis, ip_address=None, user_agent=None):
        if purpose not in DATA_PURPOSES:
            return {"error": f"Unknown purpose: {purpose}", "valid_purposes": DATA_PURPOSES}
        if legal_basis not in LAWFUL_BASES:
            return {"error": f"Invalid legal basis: {legal_basis}", "valid_bases": LAWFUL_BASES}
        
        consent_id = str(uuid.uuid4())
        record = {
            "consent_id": consent_id,
            "user_id": user_id,
            "purpose": purpose,
            "legal_basis": legal_basis,
            "granted": True,
            "granted_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=730)).isoformat(),
            "ip_address": ip_address,
            "user_agent": user_agent,
            "version": 1
        }
        
        if user_id not in self.consents:
            self.consents[user_id] = {}
        self.consents[user_id][purpose] = record
        
        logger.info(f"Consent granted: user={user_id} purpose={purpose} basis={legal_basis}")
        return {"status": "granted", "consent": record}
    
    def revoke_consent(self, user_id, purpose):
        if user_id in self.consents and purpose in self.consents[user_id]:
            self.consents[user_id][purpose]["granted"] = False
            self.consents[user_id][purpose]["revoked_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"Consent revoked: user={user_id} purpose={purpose}")
            return {"status": "revoked", "purpose": purpose}
        return {"error": "Consent not found"}
    
    def check_consent(self, user_id, purpose):
        if user_id in self.consents and purpose in self.consents[user_id]:
            c = self.consents[user_id][purpose]
            if c["granted"] and datetime.fromisoformat(c["expires_at"]) > datetime.now(timezone.utc):
                return {"has_consent": True, "consent": c}
        return {"has_consent": False, "purpose": purpose}
    
    def get_user_consents(self, user_id):
        return self.consents.get(user_id, {})

# --- Data Subject Rights (DSAR) Handler ---


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


def _get_request_id(handler):
    """Extract or generate X-Request-Id for tracing."""
    import uuid
    request_id = handler.headers.get('X-Request-Id', str(uuid.uuid4()))
    handler.send_header('X-Request-Id', request_id)
    return request_id


class DSARHandler:
    VALID_TYPES = ["access", "erasure", "rectification", "portability", "restriction", "objection"]
    
    def __init__(self):
        self.requests = {}
    
    def create_request(self, user_id, request_type, details=None):
        if request_type not in self.VALID_TYPES:
            return {"error": f"Invalid DSAR type: {request_type}", "valid_types": self.VALID_TYPES}
        
        req_id = f"DSAR-{uuid.uuid4().hex[:12].upper()}"
        deadline = datetime.now(timezone.utc) + timedelta(days=30)  # NDPR: 30-day response
        
        record = {
            "request_id": req_id,
            "user_id": user_id,
            "type": request_type,
            "status": "received",
            "details": details,
            "requested_at": datetime.now(timezone.utc).isoformat(),
            "deadline": deadline.isoformat(),
            "timeline": [
                {"status": "received", "at": datetime.now(timezone.utc).isoformat(), "note": "Request received and acknowledged"}
            ]
        }
        self.requests[req_id] = record
        logger.info(f"DSAR created: {req_id} type={request_type} user={user_id} deadline={deadline.date()}")
        return {"status": "received", "request": record}
    
    def process_access_request(self, user_id):
        """Right of Access — compile all data held about user"""
        return {
            "user_id": user_id,
            "data_categories": [
                {"category": "identity", "fields": ["name", "email", "phone", "bvn", "nin"], "source": "kyc-service"},
                {"category": "accounts", "fields": ["account_numbers", "balances", "products"], "source": "core-banking"},
                {"category": "transactions", "fields": ["history", "amounts", "dates"], "source": "transaction-service"},
                {"category": "consents", "fields": ["purposes", "dates", "status"], "source": "ndpr-service"},
                {"category": "communications", "fields": ["emails", "sms", "notifications"], "source": "notification-service"},
                {"category": "ml_decisions", "fields": ["credit_scores", "fraud_flags", "risk_tiers"], "source": "ml-inference"},
            ],
            "processing_purposes": DATA_PURPOSES,
            "retention_policies": RETENTION_POLICIES,
            "third_party_sharing": [
                {"entity": "NIBSS", "purpose": "payment_processing", "legal_basis": "contract"},
                {"entity": "Credit Bureau", "purpose": "credit_reporting", "legal_basis": "legal_obligation"},
                {"entity": "CBN", "purpose": "regulatory_reporting", "legal_basis": "legal_obligation"},
                {"entity": "NFIU", "purpose": "aml_reporting", "legal_basis": "legal_obligation"},
            ],
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    def process_erasure_request(self, user_id):
        """Right to Erasure — with regulatory exemptions"""
        return {
            "user_id": user_id,
            "erasable": [
                {"category": "marketing_preferences", "action": "delete", "timeline": "immediate"},
                {"category": "session_logs", "action": "delete", "timeline": "24_hours"},
                {"category": "analytics_data", "action": "anonymize", "timeline": "7_days"},
            ],
            "retained_by_law": [
                {"category": "transaction_records", "retention": "7 years", "basis": "CBN regulation"},
                {"category": "kyc_documents", "retention": "10 years", "basis": "CBN KYC/AML"},
                {"category": "audit_logs", "retention": "5 years", "basis": "NDPR Section 2.3"},
                {"category": "tax_records", "retention": "6 years", "basis": "FIRS regulation"},
            ],
            "note": "Some data retained per Nigerian regulatory requirements (CBN, FIRS, NFIU)"
        }

# --- PII Masking Engine ---
class PIIMaskingEngine:
    @staticmethod
    def mask_bvn(value):
        if not value or len(value) < 4: return "***"
        return f"***{value[-4:]}"
    
    @staticmethod
    def mask_nin(value):
        if not value or len(value) < 4: return "***"
        return f"***{value[-4:]}"
    
    @staticmethod
    def mask_phone(value):
        if not value or len(value) < 4: return "+234***"
        return f"+234***{value[-4:]}"
    
    @staticmethod
    def mask_email(value):
        if not value or "@" not in value: return "***@***"
        parts = value.split("@")
        return f"{parts[0][0]}***@{parts[1]}"
    
    @staticmethod
    def mask_account(value):
        if not value or len(value) < 4: return "****"
        return f"****{value[-4:]}"
    
    @staticmethod
    def mask_dict(data, fields_to_mask=None):
        if fields_to_mask is None:
            fields_to_mask = list(PII_FIELDS.keys())
        masked = {}
        for k, v in data.items():
            key_lower = k.lower().replace("-", "_").replace(" ", "_")
            if any(f in key_lower for f in fields_to_mask):
                if isinstance(v, str):
                    if "bvn" in key_lower: masked[k] = PIIMaskingEngine.mask_bvn(v)
                    elif "nin" in key_lower: masked[k] = PIIMaskingEngine.mask_nin(v)
                    elif "phone" in key_lower or "mobile" in key_lower: masked[k] = PIIMaskingEngine.mask_phone(v)
                    elif "email" in key_lower: masked[k] = PIIMaskingEngine.mask_email(v)
                    elif "account" in key_lower: masked[k] = PIIMaskingEngine.mask_account(v)
                    else: masked[k] = "***"
                else:
                    masked[k] = "***"
            else:
                masked[k] = v
        return masked

consent_mgr = ConsentManager()
dsar_handler = DSARHandler()
masking_engine = PIIMaskingEngine()

# --- Request Metrics ---
_request_counter = 0
_error_counter = 0

def inc_requests():
    global _request_counter
    _request_counter += 1

def inc_errors():
    global _error_counter
    _error_counter += 1

# --- DB Connection ---
_db_conn = None

def _init_db():
    global _db_conn
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return
    try:
        import psycopg2
        _db_conn = psycopg2.connect(db_url)
        _db_conn.autocommit = True
    except Exception as e:
        print(f"[ndpr-compliance-py] DB init failed: {e}")

class NDPRHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass
    
    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())
    
    def do_GET(self):
        path = urlparse(self.path).path
        params = parse_qs(urlparse(self.path).query)
        
        if path == "/healthz":
            self._json(200, {"status": "healthy", "service": "ndpr-compliance", "version": "1.0.0"})
        elif path == "/readyz":
            self._json(200, {"status": "ready"})
        elif path == "/metrics":
            self._json(200, {"requests": _request_counter, "errors": _error_counter})
        elif path == "/privacy-policy":
            self._json(200, {
                "title": "54Bank Privacy Policy",
                "version": "2.0",
                "effective_date": "2026-01-01",
                "data_controller": {"name": "54Bank Limited", "address": "Lagos, Nigeria", "email": "privacy@54bank.ng", "dpo": "Data Protection Officer"},
                "lawful_bases": LAWFUL_BASES,
                "processing_purposes": DATA_PURPOSES,
                "data_subject_rights": DSARHandler.VALID_TYPES,
                "retention_policies": RETENTION_POLICIES,
                "pii_categories": {k: {"sensitivity": v["sensitivity"]} for k, v in PII_FIELDS.items()},
                "third_party_disclosures": ["NIBSS", "Credit Bureaus", "CBN", "NFIU"],
                "complaint_authority": "NITDA (Nigeria Information Technology Development Agency)",
                "last_updated": "2026-01-01"
            })
        elif path == "/consents" and "user_id" in params:
            user_id = params["user_id"][0]
            self._json(200, {"user_id": user_id, "consents": consent_mgr.get_user_consents(user_id)})
        elif path == "/pii/fields":
            self._json(200, {"pii_fields": PII_FIELDS})
        elif path == "/retention-policies":
            self._json(200, {"policies": RETENTION_POLICIES})
        elif path == "/dsar/status" and "request_id" in params:
            req_id = params["request_id"][0]
            if req_id in dsar_handler.requests:
                self._json(200, dsar_handler.requests[req_id])
            else:
                self._json(404, {"error": "DSAR not found"})
        else:
            self._json(404, {"error": "Not found"})
    
    def do_POST(self):
        path = urlparse(self.path).path
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or "{}")
        
        if path == "/consents/grant":
            result = consent_mgr.grant_consent(
                body.get("user_id"), body.get("purpose"), body.get("legal_basis", "consent"),
                body.get("ip_address"), body.get("user_agent"))
            self._json(200 if "status" in result else 400, result)
        elif path == "/consents/revoke":
            result = consent_mgr.revoke_consent(body.get("user_id"), body.get("purpose"))
            self._json(200 if "status" in result else 400, result)
        elif path == "/consents/check":
            result = consent_mgr.check_consent(body.get("user_id"), body.get("purpose"))
            self._json(200, result)
        elif path == "/dsar/create":
            result = dsar_handler.create_request(body.get("user_id"), body.get("type"), body.get("details"))
            self._json(200 if "status" in result else 400, result)
        elif path == "/dsar/access":
            result = dsar_handler.process_access_request(body.get("user_id"))
            self._json(200, result)
        elif path == "/dsar/erasure":
            result = dsar_handler.process_erasure_request(body.get("user_id"))
            self._json(200, result)
        elif path == "/pii/mask":
            masked = PIIMaskingEngine.mask_dict(body.get("data", {}), body.get("fields"))
            self._json(200, {"masked": masked})
        elif path == "/dpia/generate":
            self._json(200, {
                "dpia_id": f"DPIA-{uuid.uuid4().hex[:8].upper()}",
                "project": body.get("project", "unnamed"),
                "assessment": {
                    "data_types": body.get("data_types", []),
                    "processing_scope": body.get("scope", "internal"),
                    "risk_level": "high" if any(f in body.get("data_types", []) for f in ["bvn", "nin", "biometric"]) else "medium",
                    "mitigations_required": [
                        "Field-level encryption for critical PII",
                        "Access logging for all PII queries",
                        "Data minimization review",
                        "Retention policy enforcement",
                        "Consent verification before processing"
                    ],
                    "ndpr_compliance_status": "requires_review",
                    "nitda_notification_required": True if body.get("scope") == "large_scale" else False,
                },
                "generated_at": datetime.now(timezone.utc).isoformat()
            })
        else:
            self._json(404, {"error": "Not found"})



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

# --- Rate Limiting ---
import time as _time
import threading as _threading

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


class _RateLimiter:
    """Token bucket rate limiter (100 req/s per IP)."""

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


def _graceful_shutdown(signum, frame):
    print(f"[ndpr-compliance-py] Received signal {signum}, shutting down gracefully...")
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


_event_bus = EventBus("compliance.screening", "ndpr-compliance")


# --- Data Flow Emit Point ---
def emit_processing_event(action: str, data: dict) -> None:
    """Called by handlers after successful processing."""
    _event_bus.emit("ndpr-compliance." + action, data)

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), NDPRHandler)
    logger.info(f"NDPR Compliance Service listening on :{PORT}")
    server.serve_forever()
