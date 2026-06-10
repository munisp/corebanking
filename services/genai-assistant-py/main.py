import sys; sys.path.insert(0, '/home/ubuntu/repos/corebanking/libs/banking-rules-py')
#!/usr/bin/env python3
"""Generative AI — LLM chatbot, STR narrative generation, document understanding, compliance Q&A"""
import os, json, logging, uuid, re, time, hashlib, threading, math
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("genai-assistant-py")

PORT = int(os.environ.get("PORT", "8104"))

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


ALLOWED_TABLES = frozenset(["genai_assistant", "service_records", "audit_log"])

def _safe_table_name(table: str) -> str:
    """Validate table name to prevent SQL injection via table names"""
    import re
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', table):
        raise ValueError(f"Invalid table name: {table}")
    return table
SERVICE_NAME = "genai-assistant-py"
START_TIME = time.time()
_request_count = 0
_error_count = 0
_counter_lock = threading.Lock()

def mask_pii(value: str, field_type: str = "generic") -> str:
    if not value: return "***"
    if field_type in ("bvn", "nin"): return f"***{value[-4:]}" if len(value) >= 4 else "***"
    elif field_type == "phone": return f"+234***{value[-4:]}" if len(value) >= 4 else "+234***"
    elif field_type == "email" and "@" in value:
        local, domain = value.split("@", 1)
        return f"{local[0]}***@{domain}"
    return "***"

def sanitize_log(msg: str) -> str:
    msg = re.sub(r"\b\d{11}\b", lambda m: f"***{m.group()[-4:]}", msg)
    return re.sub(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", "***@***", msg)

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
                import psycopg2
                _db = psycopg2.connect(db_url); _db.autocommit = True
            except Exception as e:
                logger.error(f"DB connect failed: {e}")
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
    token = auth[7:]
    parts = token.split(".")
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

# ─── STR Narrative Generation ───
STR_TEMPLATES = {
    "structuring": "Transaction analysis indicates possible structuring activity. "
        "The account holder {account_holder} conducted {txn_count} transactions totaling "
        "₦{total_naira:,.2f} within {period_days} days, with {below_threshold_count} "
        "transactions deliberately kept below the ₦{threshold_naira:,.0f} reporting threshold. "
        "Pattern: {pattern_description}. Risk score: {risk_score}/100.",
    "unusual_volume": "Unusual transaction volume detected for {account_holder}. "
        "The account received {credit_count} credits totaling ₦{credit_naira:,.2f} and "
        "initiated {debit_count} debits totaling ₦{debit_naira:,.2f} in {period_days} days. "
        "This represents a {volume_increase_pct:.0f}% increase over the 90-day average. "
        "Flagged indicators: {indicators}.",
    "pep_transaction": "Politically Exposed Person transaction alert. {account_holder} "
        "(PEP tier: {pep_tier}) conducted a {txn_type} of ₦{amount_naira:,.2f} on {txn_date}. "
        "Source of funds declared as: {source_of_funds}. Enhanced due diligence status: {edd_status}. "
        "CBN circular reference: BSD/DIR/GEN/LAB/14/001.",
    "cross_border": "Cross-border transaction alert. {account_holder} initiated an international "
        "transfer of {currency} {amount:,.2f} (₦{naira_equivalent:,.2f}) to {destination_country}. "
        "Beneficiary: {beneficiary_name}. Purpose: {purpose}. "
        "OFAC/EU/UN sanctions screening: {sanctions_result}. NFIU reporting threshold check: {nfiu_check}.",
}

def generate_str_narrative(alert_type: str, context: dict) -> dict:
    """Generate Suspicious Transaction Report narrative from structured data."""
    errors = []
    if alert_type not in STR_TEMPLATES:
        errors.append(f"unknown_alert_type:{alert_type}, valid:{list(STR_TEMPLATES.keys())}")
    if not context.get("account_holder"):
        errors.append("account_holder_required")
    if errors:
        return {"valid": False, "errors": errors}

    template = STR_TEMPLATES[alert_type]
    context.setdefault("risk_score", 0)
    context.setdefault("period_days", 30)
    context.setdefault("txn_count", 0)

    try:
        narrative = template.format(**context)
    except KeyError as e:
        return {"valid": False, "errors": [f"missing_context_field:{e}"]}

    pii_redacted = mask_pii(context["account_holder"], "generic")
    filing_ref = f"STR-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

    return {
        "valid": True,
        "filing_reference": filing_ref,
        "alert_type": alert_type,
        "narrative": narrative,
        "narrative_pii_redacted": narrative.replace(context["account_holder"], pii_redacted),
        "word_count": len(narrative.split()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "regulatory_filing": "NFIU_STR",
        "cbn_reference": "AML/CFT_ACT_2022",
    }

# ─── Document Understanding ───
DOCUMENT_TYPES = {
    "utility_bill": {"required_fields": ["customer_name", "address", "account_number", "bill_date", "amount"],
                     "validity_days": 90, "accepted_providers": ["EKEDC", "IKEDC", "AEDC", "PHED", "BEDC"]},
    "bank_statement": {"required_fields": ["account_name", "account_number", "period_start", "period_end", "closing_balance"],
                       "validity_days": 180, "format": "PDF_or_original"},
    "tax_clearance": {"required_fields": ["taxpayer_name", "tin", "assessment_year", "amount_paid"],
                      "validity_days": 365, "issuer": "FIRS_or_state_IRS"},
    "cac_certificate": {"required_fields": ["company_name", "rc_number", "date_of_incorporation", "registered_address"],
                        "validity_days": -1, "issuer": "CAC"},
    "memart": {"required_fields": ["company_name", "objects", "authorized_capital", "directors"],
               "validity_days": -1, "issuer": "CAC"},
    "board_resolution": {"required_fields": ["company_name", "resolution_date", "signatories", "purpose"],
                         "validity_days": 365, "min_signatories": 2},
}

def extract_document_fields(doc_type: str, raw_text: str) -> dict:
    """Extract structured fields from document text using pattern matching."""
    if doc_type not in DOCUMENT_TYPES:
        return {"valid": False, "errors": [f"unsupported_document_type:{doc_type}"]}

    spec = DOCUMENT_TYPES[doc_type]
    extracted = {}
    confidence_scores = {}

    # Nigerian phone pattern
    phone_match = re.search(r'(?:0[789]\d{9}|\+234[789]\d{9})', raw_text)
    if phone_match:
        extracted["phone"] = phone_match.group()
        confidence_scores["phone"] = 0.95

    # Nigerian account number (NUBAN)
    acct_match = re.search(r'\b\d{10}\b', raw_text)
    if acct_match:
        extracted["account_number"] = acct_match.group()
        confidence_scores["account_number"] = 0.85

    # Amount in Naira
    amount_match = re.search(r'₦\s*([\d,]+(?:\.\d{2})?)', raw_text)
    if amount_match:
        extracted["amount"] = amount_match.group(1).replace(",", "")
        confidence_scores["amount"] = 0.90

    # Date patterns
    date_match = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', raw_text)
    if date_match:
        extracted["date"] = date_match.group()
        confidence_scores["date"] = 0.80

    # TIN (Tax Identification Number)
    tin_match = re.search(r'\b\d{8}-\d{4}\b', raw_text)
    if tin_match:
        extracted["tin"] = tin_match.group()
        confidence_scores["tin"] = 0.95

    # RC Number
    rc_match = re.search(r'RC\s*(\d{4,8})', raw_text, re.IGNORECASE)
    if rc_match:
        extracted["rc_number"] = f"RC{rc_match.group(1)}"
        confidence_scores["rc_number"] = 0.95

    missing = [f for f in spec["required_fields"] if f not in extracted]
    avg_confidence = sum(confidence_scores.values()) / len(confidence_scores) if confidence_scores else 0

    return {
        "valid": len(missing) == 0,
        "document_type": doc_type,
        "extracted_fields": extracted,
        "confidence_scores": confidence_scores,
        "average_confidence": round(avg_confidence, 3),
        "missing_fields": missing,
        "validity_days": spec["validity_days"],
    }

# ─── Compliance Q&A Knowledge Base ───
COMPLIANCE_KB = {
    "cbn_kyc_tiers": {
        "question_patterns": ["kyc tier", "tier 1", "tier 2", "tier 3", "account opening"],
        "answer": "CBN KYC Tiers: Tier 1 (₦300K daily, ₦50K single txn) requires name+phone+photo. "
                  "Tier 2 (₦500K daily) adds ID verification. Tier 3 (₦5M daily) requires full KYC "
                  "with BVN, address verification, and reference. Ref: CBN/DIR/GEN/CIR/07/020.",
    },
    "nfiu_thresholds": {
        "question_patterns": ["nfiu", "threshold", "reporting", "₦5m", "₦10m", "cash"],
        "answer": "NFIU reporting thresholds: Cash transactions ≥₦5,000,000 (individual) or "
                  "₦10,000,000 (corporate). Wire transfers ≥₦10,000,000. All suspicious transactions "
                  "regardless of amount. Filing deadline: 24 hours for STR, 7 days for CTR. "
                  "Ref: NFIU Act 2018, Section 2.",
    },
    "ndpr_data_retention": {
        "question_patterns": ["ndpr", "data retention", "privacy", "personal data", "consent"],
        "answer": "NDPR requires: Lawful basis for processing (consent/contract/legal/vital/public/legitimate). "
                  "Data minimization. Purpose limitation. Retention only as long as necessary. "
                  "72-hour breach notification to NITDA. Annual DPCO audit. "
                  "Ref: NDPR 2019, Nigeria Data Protection Act 2023.",
    },
    "aml_cft": {
        "question_patterns": ["aml", "cft", "money laundering", "terrorism financing", "pep"],
        "answer": "AML/CFT requirements under MLA (Prohibition) Act 2022: Customer Due Diligence (CDD) "
                  "for all accounts. Enhanced Due Diligence (EDD) for PEPs, high-risk countries, "
                  "complex transactions. Record retention: 5 years post-relationship. "
                  "Designated NFIU reporting officer required. Ref: CBN AML/CFT Regulation 2013.",
    },
    "bvn_requirements": {
        "question_patterns": ["bvn", "bank verification", "biometric"],
        "answer": "BVN (Bank Verification Number) is an 11-digit unique identifier linked to biometrics. "
                  "Required for Tier 2+ accounts. Validation via NIBSS BVN service. "
                  "Must match: name, DOB, phone, photo. Ref: CBN BVN Circular 2014.",
    },
}

def answer_compliance_question(question: str) -> dict:
    """Match compliance question to knowledge base using keyword scoring."""
    question_lower = question.lower()
    scores = {}

    for topic, kb_entry in COMPLIANCE_KB.items():
        score = 0
        for pattern in kb_entry["question_patterns"]:
            if pattern.lower() in question_lower:
                score += 1
        if score > 0:
            scores[topic] = score

    if not scores:
        return {
            "matched": False,
            "answer": "No matching compliance topic found. Available topics: " +
                      ", ".join(COMPLIANCE_KB.keys()),
            "suggestion": "Try asking about: KYC tiers, NFIU thresholds, NDPR, AML/CFT, or BVN",
        }

    best_topic = max(scores, key=scores.get)
    return {
        "matched": True,
        "topic": best_topic,
        "answer": COMPLIANCE_KB[best_topic]["answer"],
        "confidence": min(1.0, scores[best_topic] / len(COMPLIANCE_KB[best_topic]["question_patterns"])),
        "related_topics": [t for t in scores if t != best_topic],
    }

# ─── Conversation State Machine ───
CONV_TRANSITIONS = {
    "idle": ["greeting"],
    "greeting": ["question", "document_upload", "str_request"],
    "question": ["answer_provided", "clarification_needed"],
    "clarification_needed": ["question"],
    "answer_provided": ["question", "document_upload", "str_request", "farewell"],
    "document_upload": ["extraction_complete"],
    "extraction_complete": ["question", "farewell"],
    "str_request": ["str_generated"],
    "str_generated": ["question", "farewell"],
    "farewell": ["idle"],
}

def add_security_headers(handler):
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("X-Frame-Options", "DENY")
    handler.send_header("Content-Security-Policy", "default-src 'self'")


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
        if not _rl_allow():
            self.respond(429, {"error": "rate_limit_exceeded"}); return
        path = urlparse(self.path).path
        if path == "/healthz":
            db = get_db()
            self.respond(200, {"status": "healthy", "service": SERVICE_NAME, "version": "2.0.0",
                               "checks": {"database": "connected" if db else "not_configured"},
                               "capabilities": ["str_narrative", "document_understanding", "compliance_qa"],
                               "uptime_secs": round(time.time() - START_TIME)})
        elif path == "/readyz": self.respond(200, {"ready": True})
        elif path == "/livez": self.respond(200, {"alive": True})
        elif path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {_request_count}\nerrors_total{{service="{SERVICE_NAME}"}} {_error_count}\n'.encode())
        elif path == "/v1/capabilities":
            self.respond(200, {"capabilities": [
                {"name": "str_narrative", "description": "Generate STR narratives from structured alert data",
                 "endpoint": "/v1/str/generate", "alert_types": list(STR_TEMPLATES.keys())},
                {"name": "document_understanding", "description": "Extract fields from Nigerian banking documents",
                 "endpoint": "/v1/document/extract", "document_types": list(DOCUMENT_TYPES.keys())},
                {"name": "compliance_qa", "description": "Answer regulatory compliance questions",
                 "endpoint": "/v1/compliance/ask", "topics": list(COMPLIANCE_KB.keys())},
            ]})
        elif path == "/v1/document/types":
            self.respond(200, {"document_types": {k: {"required_fields": v["required_fields"], "validity_days": v["validity_days"]}
                                                   for k, v in DOCUMENT_TYPES.items()}})
        elif path == "/v1/compliance/topics":
            self.respond(200, {"topics": {k: {"patterns": v["question_patterns"]} for k, v in COMPLIANCE_KB.items()}})
        elif path == "/v1/conversation/states":
            self.respond(200, {"transitions": CONV_TRANSITIONS})
        else:
            self.respond(404, {"error": "not_found"})

    def do_POST(self):
        inc_requests()
        if not _rl_allow():
            self.respond(429, {"error": "rate_limit_exceeded"}); return
        content_length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(content_length).decode()) if content_length > 0 else {}
        except json.JSONDecodeError:
            self.respond(400, {"error": "invalid_json"}); return

        path = urlparse(self.path).path
        claims, err = validate_jwt(dict(self.headers))
        if err and path not in ("/v1/compliance/ask",):
            self.respond(401, {"error": "unauthorized", "detail": err}); return

        if path == "/v1/str/generate":
            result = generate_str_narrative(body.get("alert_type", ""), body.get("context", {}))
            self.respond(200 if result.get("valid") else 400, result)
        elif path == "/v1/document/extract":
            result = extract_document_fields(body.get("document_type", ""), body.get("text", ""))
            self.respond(200, result)
        elif path == "/v1/compliance/ask":
            result = answer_compliance_question(body.get("question", ""))
            self.respond(200, result)
        elif path == "/v1/create":
            try:
                body["id"] = f"GEN-{uuid.uuid4().hex[:12].upper()}"
                body["created_at"] = datetime.now(timezone.utc).isoformat()
                db_insert("genai_interactions", body)
                self.respond(201, {"created": True, "data": body})
            except ConnectionError:
                self.respond(503, {"error": "database_unavailable"})
            except Exception as e:
                logger.error(f"Write failed: {e}"); self.respond(500, {"error": "write_failed"})
        else:
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
    print(f"[genai-assistant-py] Received signal {signum}, shutting down gracefully...")
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
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "message": "GenAI assistant started",
                            "capabilities": ["str_narrative", "document_understanding", "compliance_qa"]}))
    server.serve_forever()
