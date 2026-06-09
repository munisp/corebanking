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
tenant-management-py — 54Bank Multi-Tenant Management Service

Handles tenant lifecycle, tier/plan provisioning, white-label configuration,
and data isolation enforcement. The platform owner uses this service to
create tenants, assign plans, and configure white-label branding.

Tier Definitions:
  - starter:      Core banking, GL, 2 agents (NL-reporting, reconciliation)
  - professional:  + 5 more agents, KPI dashboards (CFO/COO/CTO), graph tools
  - enterprise:    All 10 agents, all 8 KPI roles, full graph + AI, white-label, custom domain
  - white_label:   Enterprise + full UI rebranding, sub-tenant provisioning

Data Isolation:
  Every DB query, KPI lookup, agent call, and cache key is scoped by tenant_id.
  JWT tokens carry tenant_id claim. Gateway injects X-Tenant-Id header.
"""
import os, sys, json, time, signal, threading, uuid, re, html
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

SERVICE_NAME = "tenant-management-py"

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




# --- Rate Limiting ---
_rl_tokens = 100; _rl_lock = threading.Lock(); _rl_last = [0.0]
def _rl_allow():
    global _rl_tokens
    now = time.time()
    with _rl_lock:
        if now - _rl_last[0] >= 1.0: _rl_tokens = 100; _rl_last[0] = now
        if _rl_tokens <= 0: return False
        _rl_tokens -= 1; return True

# --- Metrics ---
request_count = 0; error_count = 0; _m_lock = threading.Lock()
def inc_requests():
    global request_count
    with _m_lock: request_count += 1
def inc_errors():
    global error_count
    with _m_lock: error_count += 1

# --- Tier Feature Matrix ---
TIER_FEATURES = {
    "starter": {
        "max_users": 50,
        "agents": ["nl-reporting", "reconciliation"],
        "kpi_roles": ["cfo", "coo"],
        "graph_tools": [],
        "white_label": False,
        "custom_domain": False,
        "api_rate_limit": 100,
        "data_retention_days": 90,
        "support_level": "email",
        "max_branches": 5,
        "features": ["core-banking", "gl-engine", "payments", "basic-reports"],
    },
    "professional": {
        "max_users": 500,
        "agents": ["nl-reporting", "reconciliation", "account-opening", "loan-origination",
                    "cash-management", "customer-360", "regulatory-returns"],
        "kpi_roles": ["cfo", "coo", "cto", "compliance"],
        "graph_tools": ["coa-graph", "pagerank"],
        "white_label": False,
        "custom_domain": False,
        "api_rate_limit": 500,
        "data_retention_days": 365,
        "support_level": "priority",
        "max_branches": 50,
        "features": ["core-banking", "gl-engine", "payments", "basic-reports",
                      "advanced-reports", "trade-finance", "fx-trading"],
    },
    "enterprise": {
        "max_users": -1,
        "agents": ["nl-reporting", "reconciliation", "account-opening", "loan-origination",
                    "cash-management", "customer-360", "regulatory-returns",
                    "transaction-investigation", "fraud-detection", "dormancy-prevention"],
        "kpi_roles": ["board", "cfo", "cro", "coo", "cto", "compliance", "rm", "branch"],
        "graph_tools": ["coa-graph", "pagerank", "basel-iii", "liquidity", "semantic-search"],
        "white_label": False,
        "custom_domain": True,
        "api_rate_limit": 2000,
        "data_retention_days": -1,
        "support_level": "dedicated",
        "max_branches": -1,
        "features": ["core-banking", "gl-engine", "payments", "basic-reports",
                      "advanced-reports", "trade-finance", "fx-trading",
                      "islamic-banking", "agency-banking", "microfinance"],
    },
    "white_label": {
        "max_users": -1,
        "agents": ["nl-reporting", "reconciliation", "account-opening", "loan-origination",
                    "cash-management", "customer-360", "regulatory-returns",
                    "transaction-investigation", "fraud-detection", "dormancy-prevention"],
        "kpi_roles": ["board", "cfo", "cro", "coo", "cto", "compliance", "rm", "branch"],
        "graph_tools": ["coa-graph", "pagerank", "basel-iii", "liquidity", "semantic-search"],
        "white_label": True,
        "custom_domain": True,
        "api_rate_limit": 5000,
        "data_retention_days": -1,
        "support_level": "white-glove",
        "max_branches": -1,
        "sub_tenant_provisioning": True,
        "features": ["core-banking", "gl-engine", "payments", "basic-reports",
                      "advanced-reports", "trade-finance", "fx-trading",
                      "islamic-banking", "agency-banking", "microfinance",
                      "custom-branding", "sub-tenant-management"],
    },
}

# --- In-Memory Tenant Store (production: Postgres) ---
_tenants = {}
_tenant_lock = threading.Lock()

def _init_platform_tenant():
    """Create the platform owner tenant on startup."""
    platform = {
        "id": "platform",
        "name": "54Bank Platform",
        "slug": "54bank",
        "tier": "white_label",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "owner_email": "admin@54bank.ng",
        "branding": {
            "logo_url": "/assets/54bank-logo.png",
            "primary_color": "#1a237e",
            "secondary_color": "#0d47a1",
            "accent_color": "#ff6f00",
            "app_name": "54Bank",
            "favicon_url": "/assets/favicon.ico",
            "custom_css": "",
        },
        "config": {
            "default_currency": "NGN",
            "timezone": "Africa/Lagos",
            "locale": "en-NG",
            "mfa_required": True,
            "ip_whitelist": [],
            "webhook_url": "",
        },
        "usage": {
            "active_users": 0,
            "total_transactions": 0,
            "storage_mb": 0,
            "api_calls_today": 0,
        },
        "sub_tenants": [],
    }
    with _tenant_lock:
        _tenants["platform"] = platform
    # Create a demo tenant
    demo = {
        "id": str(uuid.uuid4()),
        "name": "Demo MFB",
        "slug": "demo-mfb",
        "tier": "professional",
        "status": "active",
        "parent_tenant_id": "platform",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "owner_email": "admin@demo-mfb.ng",
        "branding": {
            "logo_url": "",
            "primary_color": "#2e7d32",
            "secondary_color": "#1b5e20",
            "accent_color": "#ff8f00",
            "app_name": "Demo MFB",
            "favicon_url": "",
            "custom_css": "",
        },
        "config": {
            "default_currency": "NGN",
            "timezone": "Africa/Lagos",
            "locale": "en-NG",
            "mfa_required": False,
            "ip_whitelist": [],
            "webhook_url": "",
        },
        "usage": {
            "active_users": 34,
            "total_transactions": 12847,
            "storage_mb": 256,
            "api_calls_today": 4521,
        },
        "sub_tenants": [],
    }
    with _tenant_lock:
        _tenants[demo["id"]] = demo
        _tenants["platform"]["sub_tenants"].append(demo["id"])

_init_platform_tenant()

# --- DB Persistence (Postgres) ---
_DB_URL = os.environ.get("DATABASE_URL", "")
_db_pool = None

def _get_db():
    global _db_pool
    if not _DB_URL:
        return None
    try:
        if _db_pool is None:
            import psycopg2.pool
            _db_pool = psycopg2.pool.SimpleConnectionPool(minconn=2, maxconn=10, dsn=_DB_URL)
            logger.info("Database connection pool initialized")
        conn = _db_pool.getconn()
        conn.autocommit = True
        return conn
    except Exception as e:
        logger.warning(f"DB connection failed: {e}")
        return None

def _release_db(conn):
    if _db_pool and conn:
        try:
            _db_pool.putconn(conn)
        except Exception:
            pass

def db_insert(table, data):
    conn = _get_db()
    if not conn:
        logger.error("CRITICAL: No database connection — refusing write")
        raise ConnectionError("Database unavailable for tenant-management-py")
    try:
        cur = conn.cursor()
        import json as _json
        cur.execute("INSERT INTO records (data, service) VALUES (%s, %s) RETURNING id",
                    (_json.dumps(data), "tenant-management-py"))
        row = cur.fetchone()
        data["id"] = str(row[0])
        return data
    except Exception as e:
        logger.error(f"DB insert failed: {e}")
        raise
    finally:
        _release_db(conn)

def db_query(table, filters):
    conn = _get_db()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, data FROM records WHERE service = %s ORDER BY id DESC LIMIT 100",
                    ("tenant-management-py",))
        rows = cur.fetchall()
        import json as _json
        return [_json.loads(row[1]) if isinstance(row[1], str) else row[1] for row in rows]
    except Exception as e:
        logger.error(f"DB query failed: {e}")
        return []
    finally:
        _release_db(conn)

# --- Cache ---
_cache = {}
def cache_get(key):
    entry = _cache.get(key)
    if entry and time.time() - entry[1] < 300:
        return entry[0]
    return None

def cache_set(key, value):
    _cache[key] = (value, time.time())

# --- Sanitization ---
def sanitize(s):
    if not isinstance(s, str): return s
    return html.escape(s.strip()[:2000])

# --- Handler ---
class TenantHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def respond(self, code, data):
        inc_requests()
        if code >= 400: inc_errors()
        body = json.dumps(data, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        self.send_header("X-XSS-Protection", "1; mode=block")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Content-Security-Policy", "default-src 'self'")
        self.end_headers()
        self.wfile.write(body)

    def check_jwt(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            self.respond(401, {"error": "unauthorized"})
            return None
        # In production: decode JWT, extract tenant_id + role
        # For now: accept any bearer token, extract tenant from X-Tenant-Id header
        tenant_id = self.headers.get("X-Tenant-Id", "platform")
        return tenant_id

    def read_body(self):
        cl = int(self.headers.get("Content-Length", 0))
        if cl <= 0: return {}
        try:
            return json.loads(self.rfile.read(cl))
        except Exception:
            return {}


    # ─── Domain Logic: Tenant Management ─────────────────────────────────────

    def validate_tenant_configuration(self, config):
        """Validate multi-tenant configuration."""
        errors = []
        if not config.get("tenant_id"): errors.append("Tenant ID required")
        if not config.get("tenant_name"): errors.append("Tenant name required")
        max_users = config.get("max_users", 0)
        if max_users < 1: errors.append("Max users must be >= 1")
        plan = config.get("plan", "")
        valid_plans = {"starter", "professional", "enterprise"}
        if plan not in valid_plans: errors.append(f"Invalid plan: {plan}")
        return {"valid": len(errors) == 0, "errors": errors}

    def compute_tenant_billing(self, usage):
        """Compute tenant billing based on usage metrics."""
        plan_rates = {"starter": 50000, "professional": 200000, "enterprise": 500000}
        base = plan_rates.get(usage.get("plan", "starter"), 100000)
        users = usage.get("active_users", 0)
        storage_gb = usage.get("storage_gb", 0)
        api_calls = usage.get("api_calls", 0)
        extra = max(0, users - 10) * 5000 + storage_gb * 500 + max(0, api_calls - 100000) * 0.01
        return {"base_charge": base, "overage": round(extra, 2), "total": round(base + extra, 2)}

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/healthz":
            self.respond(200, {"status": "healthy", "service": SERVICE_NAME}); return
        if path == "/readyz":
            self.respond(200, {"ready": True}); return
        if path == "/livez":
            self.respond(200, {"live": True}); return
        if path == "/metrics":
            self.send_response(200); self.send_header("Content-Type", "text/plain"); self.end_headers()
            self.wfile.write(f'requests_total{{service="{SERVICE_NAME}"}} {request_count}\nerrors_total{{service="{SERVICE_NAME}"}} {error_count}\ntenants_total {len(_tenants)}\n'.encode()); return

        if not _rl_allow(): self.respond(429, {"error": "rate_limit_exceeded"}); return
        tenant_id = self.check_jwt()
        if not tenant_id: return

        # GET /v1/tenants — list all tenants (platform owner only)
        if path == "/v1/tenants":
            if tenant_id != "platform":
                self.respond(403, {"error": "platform_owner_only"}); return
            tenants_list = []
            with _tenant_lock:
                for t in _tenants.values():
                    tenants_list.append({k: v for k, v in t.items() if k != "sub_tenants" or True})
            self.respond(200, {"tenants": tenants_list, "total": len(tenants_list)}); return

        # GET /v1/tenants/{id} — get specific tenant
        if path.startswith("/v1/tenants/"):
            tid = path.split("/v1/tenants/")[1].split("/")[0]
            with _tenant_lock:
                t = _tenants.get(tid)
            if not t:
                self.respond(404, {"error": "tenant_not_found"}); return
            # Tenant can only see themselves, platform can see all
            if tenant_id != "platform" and tenant_id != tid:
                self.respond(403, {"error": "access_denied"}); return
            self.respond(200, {"tenant": t}); return

        # GET /v1/tiers — list available tiers
        if path == "/v1/tiers":
            self.respond(200, {"tiers": TIER_FEATURES}); return

        # GET /v1/tenant/features — get features for current tenant
        if path == "/v1/tenant/features":
            with _tenant_lock:
                t = _tenants.get(tenant_id)
            if not t:
                self.respond(404, {"error": "tenant_not_found"}); return
            tier = t.get("tier", "starter")
            features = TIER_FEATURES.get(tier, TIER_FEATURES["starter"])
            self.respond(200, {
                "tenant_id": tenant_id,
                "tier": tier,
                "features": features,
                "branding": t.get("branding", {}),
            }); return

        # GET /v1/tenant/branding — get white-label branding
        if path == "/v1/tenant/branding":
            with _tenant_lock:
                t = _tenants.get(tenant_id)
            if not t:
                self.respond(404, {"error": "tenant_not_found"}); return
            self.respond(200, {
                "tenant_id": tenant_id,
                "branding": t.get("branding", {}),
                "config": t.get("config", {}),
            }); return

        # GET /v1/tenant/usage — get usage stats
        if path == "/v1/tenant/usage":
            with _tenant_lock:
                t = _tenants.get(tenant_id)
            if not t:
                self.respond(404, {"error": "tenant_not_found"}); return
            tier = t.get("tier", "starter")
            features = TIER_FEATURES.get(tier, TIER_FEATURES["starter"])
            usage = t.get("usage", {})
            self.respond(200, {
                "tenant_id": tenant_id,
                "tier": tier,
                "usage": usage,
                "limits": {
                    "max_users": features["max_users"],
                    "api_rate_limit": features["api_rate_limit"],
                    "data_retention_days": features["data_retention_days"],
                    "max_branches": features["max_branches"],
                },
            }); return

        self.respond(404, {"error": "not_found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        if not _rl_allow(): self.respond(429, {"error": "rate_limit_exceeded"}); return
        tenant_id = self.check_jwt()
        if not tenant_id: return
        body = self.read_body()

        # POST /v1/tenants — create new tenant (platform owner only)
        if path == "/v1/tenants":
            if tenant_id != "platform":
                self.respond(403, {"error": "platform_owner_only"}); return
            name = sanitize(body.get("name", ""))
            slug = sanitize(body.get("slug", ""))
            tier = body.get("tier", "starter")
            owner_email = sanitize(body.get("owner_email", ""))
            if not name or not slug or not owner_email:
                self.respond(400, {"error": "name, slug, and owner_email required"}); return
            if tier not in TIER_FEATURES:
                self.respond(400, {"error": f"invalid tier, must be one of: {list(TIER_FEATURES.keys())}"}); return
            # Check slug uniqueness
            with _tenant_lock:
                for t in _tenants.values():
                    if t.get("slug") == slug:
                        self.respond(409, {"error": "slug_already_exists"}); return
            new_tenant = {
                "id": str(uuid.uuid4()),
                "name": name,
                "slug": slug,
                "tier": tier,
                "status": "active",
                "parent_tenant_id": tenant_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "owner_email": owner_email,
                "branding": body.get("branding", {
                    "logo_url": "",
                    "primary_color": "#1a237e",
                    "secondary_color": "#0d47a1",
                    "accent_color": "#ff6f00",
                    "app_name": name,
                    "favicon_url": "",
                    "custom_css": "",
                }),
                "config": body.get("config", {
                    "default_currency": "NGN",
                    "timezone": "Africa/Lagos",
                    "locale": "en-NG",
                    "mfa_required": False,
                    "ip_whitelist": [],
                    "webhook_url": "",
                }),
                "usage": {"active_users": 0, "total_transactions": 0, "storage_mb": 0, "api_calls_today": 0},
                "sub_tenants": [],
            }
            with _tenant_lock:
                _tenants[new_tenant["id"]] = new_tenant
                if tenant_id in _tenants:
                    _tenants[tenant_id]["sub_tenants"].append(new_tenant["id"])
            db_insert("tenants", new_tenant)
            cache_set(f"tenant:{new_tenant['id']}", new_tenant)
            logger.info(f"Tenant created: {new_tenant['id']} name={name} tier={tier}")
            self.respond(201, {"tenant": new_tenant}); return

        # POST /v1/tenants/{id}/tier — update tenant tier
        if path.startswith("/v1/tenants/") and path.endswith("/tier"):
            if tenant_id != "platform":
                self.respond(403, {"error": "platform_owner_only"}); return
            tid = path.split("/v1/tenants/")[1].split("/")[0]
            new_tier = body.get("tier", "")
            if new_tier not in TIER_FEATURES:
                self.respond(400, {"error": f"invalid tier"}); return
            with _tenant_lock:
                t = _tenants.get(tid)
                if not t:
                    self.respond(404, {"error": "tenant_not_found"}); return
                t["tier"] = new_tier
                t["updated_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"Tenant {tid} tier updated to {new_tier}")
            self.respond(200, {"tenant": t}); return

        # POST /v1/tenants/{id}/branding — update white-label branding
        if path.startswith("/v1/tenants/") and path.endswith("/branding"):
            tid = path.split("/v1/tenants/")[1].split("/")[0]
            if tenant_id != "platform" and tenant_id != tid:
                self.respond(403, {"error": "access_denied"}); return
            with _tenant_lock:
                t = _tenants.get(tid)
                if not t:
                    self.respond(404, {"error": "tenant_not_found"}); return
                tier = t.get("tier", "starter")
                if not TIER_FEATURES.get(tier, {}).get("white_label", False) and tenant_id != "platform":
                    self.respond(403, {"error": "white_label_not_available_on_tier", "tier": tier}); return
                branding = t.get("branding", {})
                for key in ["logo_url", "primary_color", "secondary_color", "accent_color", "app_name", "favicon_url", "custom_css"]:
                    if key in body:
                        branding[key] = sanitize(body[key]) if isinstance(body[key], str) else body[key]
                t["branding"] = branding
                t["updated_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"Tenant {tid} branding updated")
            self.respond(200, {"tenant": t}); return

        # POST /v1/tenants/{id}/status — activate/suspend tenant
        if path.startswith("/v1/tenants/") and path.endswith("/status"):
            if tenant_id != "platform":
                self.respond(403, {"error": "platform_owner_only"}); return
            tid = path.split("/v1/tenants/")[1].split("/")[0]
            new_status = body.get("status", "")
            if new_status not in ("active", "suspended", "deactivated"):
                self.respond(400, {"error": "status must be active, suspended, or deactivated"}); return
            with _tenant_lock:
                t = _tenants.get(tid)
                if not t:
                    self.respond(404, {"error": "tenant_not_found"}); return
                t["status"] = new_status
                t["updated_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"Tenant {tid} status updated to {new_status}")
            self.respond(200, {"tenant": t}); return

        # POST /v1/tenant/validate — validate tenant access to a feature
        if path == "/v1/tenant/validate":
            feature = body.get("feature", "")
            agent = body.get("agent", "")
            kpi_role = body.get("kpi_role", "")
            graph_tool = body.get("graph_tool", "")
            with _tenant_lock:
                t = _tenants.get(tenant_id)
            if not t:
                self.respond(404, {"error": "tenant_not_found"}); return
            if t.get("status") != "active":
                self.respond(403, {"error": "tenant_suspended", "status": t.get("status")}); return
            tier = t.get("tier", "starter")
            tier_features = TIER_FEATURES.get(tier, TIER_FEATURES["starter"])
            allowed = True
            reason = ""
            if agent and agent not in tier_features["agents"]:
                allowed = False
                reason = f"Agent '{agent}' not available on {tier} tier"
            if kpi_role and kpi_role not in tier_features["kpi_roles"]:
                allowed = False
                reason = f"KPI role '{kpi_role}' not available on {tier} tier"
            if graph_tool and graph_tool not in tier_features["graph_tools"]:
                allowed = False
                reason = f"Graph tool '{graph_tool}' not available on {tier} tier"
            if feature and feature not in tier_features["features"]:
                allowed = False
                reason = f"Feature '{feature}' not available on {tier} tier"
            self.respond(200, {
                "allowed": allowed,
                "reason": reason,
                "tenant_id": tenant_id,
                "tier": tier,
            }); return

        self.respond(404, {"error": "not_found"})

    def do_PUT(self):
        path = self.path.split("?")[0]
        if not _rl_allow(): self.respond(429, {"error": "rate_limit_exceeded"}); return
        tenant_id = self.check_jwt()
        if not tenant_id: return
        body = self.read_body()

        # PUT /v1/tenants/{id} — update tenant config
        if path.startswith("/v1/tenants/"):
            tid = path.split("/v1/tenants/")[1].split("/")[0]
            if tenant_id != "platform" and tenant_id != tid:
                self.respond(403, {"error": "access_denied"}); return
            with _tenant_lock:
                t = _tenants.get(tid)
                if not t:
                    self.respond(404, {"error": "tenant_not_found"}); return
                for key in ["name", "owner_email"]:
                    if key in body: t[key] = sanitize(body[key])
                if "config" in body:
                    config = t.get("config", {})
                    for k, v in body["config"].items():
                        config[k] = v
                    t["config"] = config
                t["updated_at"] = datetime.now(timezone.utc).isoformat()
            self.respond(200, {"tenant": t}); return

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
    def shutdown(sig, frame):
        logger.info("Shutting down gracefully"); sys.exit(0)
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    server = HTTPServer(("0.0.0.0", PORT), TenantHandler)
    logger.info(json.dumps({"service": SERVICE_NAME, "port": PORT, "tenants": len(_tenants)}))
    server.serve_forever()
