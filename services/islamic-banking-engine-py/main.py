import sys; sys.path.insert(0, '/home/ubuntu/repos/corebanking/libs/banking-rules-py')
#!/usr/bin/env python3
"""Non-interest banking — Murabaha, Ijara, Mudaraba, Musharaka, Zakat, Sukuk, Takaful"""
import os, json, logging, uuid, re, time, math, hashlib, threading
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from decimal import Decimal, ROUND_HALF_UP

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("islamic-banking-engine-py")

PORT = int(os.environ.get("PORT", "8103"))
SERVICE_NAME = "islamic-banking-engine-py"
START_TIME = time.time()
_request_count = 0
_error_count = 0
_counter_lock = threading.Lock()

# --- PII Masking (NDPR) ---
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
    return "***"

def sanitize_log(msg: str) -> str:
    msg = re.sub(r"\b\d{11}\b", lambda m: f"***{m.group()[-4:]}", msg)
    msg = re.sub(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", "***@***", msg)
    return msg

def inc_requests():
    global _request_count
    with _counter_lock: _request_count += 1

def inc_errors():
    global _error_count
    with _counter_lock: _error_count += 1

# ─── DB Layer ───
_db = None
def get_db():
    global _db
    if _db is None:
        db_url = os.environ.get("DATABASE_URL")
        if db_url:
            try:
                import psycopg2
                _db = psycopg2.connect(db_url)
                _db.autocommit = True
                logger.info("DB connected")
            except Exception as e:
                logger.error(f"DB connection failed: {e}")
    return _db

def db_insert(table, data):
    db = get_db()
    if not db:
        raise ConnectionError("database_unavailable")
    cur = db.cursor()
    cur.execute(f"INSERT INTO {table} (id, data, created_at) VALUES (%s, %s, NOW()) RETURNING id",
                (data.get("id", str(uuid.uuid4())), json.dumps(data)))
    return cur.fetchone()[0]

def db_query(table, limit=50):
    db = get_db()
    if not db:
        return [], 0
    cur = db.cursor()
    cur.execute(f"SELECT data FROM {table} ORDER BY created_at DESC LIMIT %s", (limit,))
    rows = [r[0] for r in cur.fetchall()]
    cur.execute(f"SELECT count(*) FROM {table}")
    total = cur.fetchone()[0]
    return rows, total

# ─── Cache Layer ───
_cache_pool = None
def cache_get(key):
    if not _cache_pool: return None
    try:
        import redis
        r = redis.Redis(connection_pool=_cache_pool)
        v = r.get(key)
        return v.decode() if v else None
    except Exception as e:
        logger.debug(f"cache_get error: {e}")
        return None

def cache_set(key, val, ttl=300):
    if not _cache_pool: return
    try:
        r = redis.Redis(connection_pool=_cache_pool)
        r.setex(key, ttl, val)
    except Exception as e:
        logger.debug(f"cache_set error: {e}")

# ─── JWT Auth ───
def validate_jwt(headers):
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None, "missing_bearer_token"
    token = auth[7:]
    parts = token.split(".")
    if len(parts) != 3:
        return None, "invalid_jwt_format"
    try:
        import base64
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=="))
        if payload.get("exp", float("inf")) < time.time():
            return None, "token_expired"
        return payload, None
    except Exception:
        return None, "jwt_decode_failed"

# ─── Rate Limiter ───
_rl_tokens = 100.0
_rl_last = time.time()
_rl_lock = threading.Lock()
def _rl_allow():
    global _rl_tokens, _rl_last
    with _rl_lock:
        now = time.time()
        _rl_tokens = min(100.0, _rl_tokens + (now - _rl_last) * 10)
        _rl_last = now
        if _rl_tokens >= 1:
            _rl_tokens -= 1
            return True
        return False

# ─── Shariah-Compliant Financial Calculations ───

def compute_murabaha(cost_price_kobo: int, profit_margin_pct: float, tenure_months: int) -> dict:
    """Murabaha (cost-plus financing): bank buys asset and sells to customer at markup."""
    errors = []
    if cost_price_kobo <= 0:
        errors.append("cost_price_must_be_positive")
    if profit_margin_pct < 0 or profit_margin_pct > 100:
        errors.append("profit_margin_must_be_0_to_100")
    if tenure_months < 1 or tenure_months > 360:
        errors.append("tenure_months_must_be_1_to_360")
    if errors:
        return {"valid": False, "errors": errors}

    profit_kobo = int(cost_price_kobo * profit_margin_pct / 100)
    selling_price_kobo = cost_price_kobo + profit_kobo
    monthly_installment_kobo = selling_price_kobo // tenure_months
    remainder_kobo = selling_price_kobo - (monthly_installment_kobo * tenure_months)

    schedule = []
    outstanding = selling_price_kobo
    for month in range(1, tenure_months + 1):
        payment = monthly_installment_kobo + (remainder_kobo if month == tenure_months else 0)
        outstanding -= payment
        schedule.append({
            "month": month,
            "installment_kobo": payment,
            "outstanding_kobo": max(0, outstanding),
            "cost_component_kobo": int(cost_price_kobo / tenure_months),
            "profit_component_kobo": payment - int(cost_price_kobo / tenure_months),
        })

    return {
        "valid": True,
        "contract_type": "murabaha",
        "cost_price_kobo": cost_price_kobo,
        "profit_kobo": profit_kobo,
        "selling_price_kobo": selling_price_kobo,
        "profit_margin_pct": profit_margin_pct,
        "tenure_months": tenure_months,
        "monthly_installment_kobo": monthly_installment_kobo,
        "schedule": schedule[:6],
        "total_payments": len(schedule),
    }

def compute_ijara(asset_value_kobo: int, rental_rate_pct: float, lease_months: int,
                  residual_value_pct: float = 10.0) -> dict:
    """Ijara (Islamic lease): bank buys asset, leases to customer, ownership transfers at end."""
    errors = []
    if asset_value_kobo <= 0:
        errors.append("asset_value_must_be_positive")
    if rental_rate_pct <= 0 or rental_rate_pct > 50:
        errors.append("rental_rate_must_be_0_to_50")
    if lease_months < 1 or lease_months > 360:
        errors.append("lease_months_must_be_1_to_360")
    if residual_value_pct < 0 or residual_value_pct > 100:
        errors.append("residual_value_pct_must_be_0_to_100")
    if errors:
        return {"valid": False, "errors": errors}

    residual_kobo = int(asset_value_kobo * residual_value_pct / 100)
    depreciable_kobo = asset_value_kobo - residual_kobo
    monthly_depreciation = depreciable_kobo // lease_months
    monthly_rental = int(asset_value_kobo * rental_rate_pct / 100 / 12)
    total_monthly = monthly_depreciation + monthly_rental

    # Takaful (Islamic insurance) estimate: 0.5% of asset value per year
    annual_takaful_kobo = int(asset_value_kobo * 0.005)
    monthly_takaful_kobo = annual_takaful_kobo // 12

    schedule = []
    outstanding = depreciable_kobo
    for month in range(1, min(lease_months + 1, 7)):
        outstanding -= monthly_depreciation
        schedule.append({
            "month": month,
            "rental_kobo": monthly_rental,
            "depreciation_kobo": monthly_depreciation,
            "takaful_kobo": monthly_takaful_kobo,
            "total_kobo": total_monthly + monthly_takaful_kobo,
            "outstanding_kobo": max(0, outstanding),
        })

    return {
        "valid": True,
        "contract_type": "ijara",
        "asset_value_kobo": asset_value_kobo,
        "residual_value_kobo": residual_kobo,
        "monthly_rental_kobo": monthly_rental,
        "monthly_depreciation_kobo": monthly_depreciation,
        "monthly_takaful_kobo": monthly_takaful_kobo,
        "total_monthly_kobo": total_monthly + monthly_takaful_kobo,
        "lease_months": lease_months,
        "total_lease_cost_kobo": (total_monthly + monthly_takaful_kobo) * lease_months,
        "schedule": schedule,
    }

def compute_mudaraba(investment_kobo: int, expected_return_pct: float,
                     profit_sharing_ratio: float, tenure_months: int) -> dict:
    """Mudaraba (profit-sharing): bank provides capital, customer manages business."""
    errors = []
    if investment_kobo <= 0:
        errors.append("investment_must_be_positive")
    if expected_return_pct < 0:
        errors.append("expected_return_must_be_non_negative")
    if profit_sharing_ratio <= 0 or profit_sharing_ratio >= 1:
        errors.append("profit_sharing_ratio_must_be_between_0_and_1")
    if tenure_months < 1 or tenure_months > 120:
        errors.append("tenure_months_must_be_1_to_120")
    if errors:
        return {"valid": False, "errors": errors}

    expected_profit_kobo = int(investment_kobo * expected_return_pct / 100)
    bank_share_kobo = int(expected_profit_kobo * profit_sharing_ratio)
    mudarib_share_kobo = expected_profit_kobo - bank_share_kobo
    effective_bank_return = (bank_share_kobo / investment_kobo * 100) if investment_kobo > 0 else 0

    # Loss allocation: bank bears all financial loss, mudarib loses effort
    loss_scenarios = []
    for loss_pct in [10, 25, 50, 75, 100]:
        loss_kobo = int(investment_kobo * loss_pct / 100)
        loss_scenarios.append({
            "loss_pct": loss_pct,
            "bank_loss_kobo": loss_kobo,
            "mudarib_loss": "effort_only",
            "remaining_capital_kobo": investment_kobo - loss_kobo,
        })

    return {
        "valid": True,
        "contract_type": "mudaraba",
        "investment_kobo": investment_kobo,
        "expected_return_pct": expected_return_pct,
        "expected_profit_kobo": expected_profit_kobo,
        "bank_profit_share_pct": profit_sharing_ratio * 100,
        "bank_share_kobo": bank_share_kobo,
        "mudarib_share_kobo": mudarib_share_kobo,
        "effective_bank_return_pct": round(effective_bank_return, 2),
        "tenure_months": tenure_months,
        "loss_allocation": "bank_bears_financial_loss",
        "loss_scenarios": loss_scenarios,
    }

def compute_musharaka(bank_contribution_kobo: int, customer_contribution_kobo: int,
                      expected_return_pct: float, tenure_months: int,
                      diminishing: bool = True) -> dict:
    """Musharaka (joint venture): both parties contribute capital and share profit/loss."""
    errors = []
    if bank_contribution_kobo <= 0:
        errors.append("bank_contribution_must_be_positive")
    if customer_contribution_kobo <= 0:
        errors.append("customer_contribution_must_be_positive")
    if tenure_months < 1 or tenure_months > 360:
        errors.append("tenure_months_must_be_1_to_360")
    if errors:
        return {"valid": False, "errors": errors}

    total_investment = bank_contribution_kobo + customer_contribution_kobo
    bank_ratio = bank_contribution_kobo / total_investment
    customer_ratio = customer_contribution_kobo / total_investment
    expected_profit = int(total_investment * expected_return_pct / 100)

    # Diminishing Musharaka: customer buys bank's share over time
    schedule = []
    if diminishing:
        monthly_buyout = bank_contribution_kobo // tenure_months
        bank_remaining = bank_contribution_kobo
        for month in range(1, min(tenure_months + 1, 7)):
            bank_share_pct = bank_remaining / total_investment * 100
            rental = int(bank_remaining * expected_return_pct / 100 / 12)
            bank_remaining -= monthly_buyout
            schedule.append({
                "month": month,
                "buyout_kobo": monthly_buyout,
                "rental_kobo": rental,
                "total_payment_kobo": monthly_buyout + rental,
                "bank_ownership_pct": round(max(0, bank_share_pct), 2),
                "customer_ownership_pct": round(100 - max(0, bank_share_pct), 2),
            })

    return {
        "valid": True,
        "contract_type": "musharaka_diminishing" if diminishing else "musharaka_permanent",
        "total_investment_kobo": total_investment,
        "bank_contribution_kobo": bank_contribution_kobo,
        "customer_contribution_kobo": customer_contribution_kobo,
        "bank_ratio": round(bank_ratio, 4),
        "customer_ratio": round(customer_ratio, 4),
        "expected_profit_kobo": expected_profit,
        "bank_profit_share_kobo": int(expected_profit * bank_ratio),
        "customer_profit_share_kobo": int(expected_profit * customer_ratio),
        "tenure_months": tenure_months,
        "schedule": schedule,
    }

def compute_zakat(assets: dict) -> dict:
    """Zakat calculation: 2.5% on net zakatable assets above nisab threshold."""
    # Nisab: value of 85g of gold or 595g of silver
    GOLD_PRICE_PER_GRAM_KOBO = 12_000_000  # ~₦120,000/g approx
    SILVER_PRICE_PER_GRAM_KOBO = 150_000   # ~₦1,500/g approx
    NISAB_GOLD_KOBO = 85 * GOLD_PRICE_PER_GRAM_KOBO
    NISAB_SILVER_KOBO = 595 * SILVER_PRICE_PER_GRAM_KOBO

    cash_kobo = assets.get("cash_kobo", 0)
    gold_kobo = assets.get("gold_value_kobo", 0)
    silver_kobo = assets.get("silver_value_kobo", 0)
    investments_kobo = assets.get("investment_value_kobo", 0)
    receivables_kobo = assets.get("trade_receivables_kobo", 0)
    inventory_kobo = assets.get("inventory_value_kobo", 0)
    debts_kobo = assets.get("debts_owed_kobo", 0)
    expenses_kobo = assets.get("immediate_expenses_kobo", 0)

    total_assets = cash_kobo + gold_kobo + silver_kobo + investments_kobo + receivables_kobo + inventory_kobo
    total_deductions = debts_kobo + expenses_kobo
    net_zakatable = max(0, total_assets - total_deductions)

    nisab = min(NISAB_GOLD_KOBO, NISAB_SILVER_KOBO)  # Use lower (silver) nisab
    is_eligible = net_zakatable >= nisab
    zakat_amount_kobo = int(net_zakatable * 2.5 / 100) if is_eligible else 0

    # Distribution categories (Quran 9:60)
    categories = [
        {"name": "fuqara", "description": "The poor", "share_pct": 12.5},
        {"name": "masakin", "description": "The needy", "share_pct": 12.5},
        {"name": "amil", "description": "Zakat administrators", "share_pct": 12.5},
        {"name": "muallaf", "description": "New Muslims", "share_pct": 12.5},
        {"name": "riqab", "description": "Freeing captives", "share_pct": 12.5},
        {"name": "gharimin", "description": "Debtors", "share_pct": 12.5},
        {"name": "fi_sabilillah", "description": "In Allah's cause", "share_pct": 12.5},
        {"name": "ibn_sabil", "description": "Wayfarers", "share_pct": 12.5},
    ]
    distribution = [{**c, "amount_kobo": int(zakat_amount_kobo * c["share_pct"] / 100)} for c in categories]

    return {
        "total_assets_kobo": total_assets,
        "total_deductions_kobo": total_deductions,
        "net_zakatable_kobo": net_zakatable,
        "nisab_threshold_kobo": nisab,
        "is_eligible": is_eligible,
        "zakat_rate_pct": 2.5,
        "zakat_amount_kobo": zakat_amount_kobo,
        "distribution": distribution,
        "hawl_requirement": "One lunar year of possession",
    }

def compute_sukuk_yield(face_value_kobo: int, coupon_rate_pct: float,
                        tenure_years: int, payment_frequency: str = "semi_annual") -> dict:
    """Sukuk (Islamic bond) yield computation."""
    errors = []
    if face_value_kobo <= 0:
        errors.append("face_value_must_be_positive")
    if coupon_rate_pct <= 0 or coupon_rate_pct > 30:
        errors.append("coupon_rate_must_be_0_to_30")
    if tenure_years < 1 or tenure_years > 30:
        errors.append("tenure_must_be_1_to_30_years")
    if errors:
        return {"valid": False, "errors": errors}

    freq_map = {"annual": 1, "semi_annual": 2, "quarterly": 4}
    freq = freq_map.get(payment_frequency, 2)
    periodic_rate = coupon_rate_pct / freq / 100
    total_periods = tenure_years * freq
    periodic_payment_kobo = int(face_value_kobo * periodic_rate)

    schedule = []
    for period in range(1, min(total_periods + 1, 9)):
        schedule.append({
            "period": period,
            "profit_payment_kobo": periodic_payment_kobo,
            "principal_return_kobo": face_value_kobo if period == total_periods else 0,
            "total_kobo": periodic_payment_kobo + (face_value_kobo if period == total_periods else 0),
        })

    return {
        "valid": True,
        "instrument_type": "sukuk",
        "sukuk_structure": "ijara_sukuk",
        "face_value_kobo": face_value_kobo,
        "coupon_rate_pct": coupon_rate_pct,
        "tenure_years": tenure_years,
        "payment_frequency": payment_frequency,
        "periodic_payment_kobo": periodic_payment_kobo,
        "total_profit_kobo": periodic_payment_kobo * total_periods,
        "total_return_kobo": (periodic_payment_kobo * total_periods) + face_value_kobo,
        "yield_to_maturity_pct": coupon_rate_pct,
        "schedule": schedule,
    }

def compute_takaful_premium(sum_insured_kobo: int, risk_category: str,
                            takaful_type: str = "general") -> dict:
    """Takaful (Islamic cooperative insurance) premium computation."""
    base_rates = {
        "general": {"low": 0.5, "medium": 1.0, "high": 2.0, "critical": 3.5},
        "family": {"low": 0.8, "medium": 1.5, "high": 2.5, "critical": 4.0},
        "motor": {"low": 1.0, "medium": 2.0, "high": 3.0, "critical": 5.0},
    }
    rates = base_rates.get(takaful_type, base_rates["general"])
    rate = rates.get(risk_category, rates["medium"])

    annual_contribution_kobo = int(sum_insured_kobo * rate / 100)
    tabarru_ratio = 0.6  # Donation portion
    savings_ratio = 0.3  # Investment portion
    admin_ratio = 0.1    # Wakala fee

    return {
        "sum_insured_kobo": sum_insured_kobo,
        "takaful_type": takaful_type,
        "risk_category": risk_category,
        "rate_pct": rate,
        "annual_contribution_kobo": annual_contribution_kobo,
        "monthly_contribution_kobo": annual_contribution_kobo // 12,
        "allocation": {
            "tabarru_kobo": int(annual_contribution_kobo * tabarru_ratio),
            "savings_kobo": int(annual_contribution_kobo * savings_ratio),
            "wakala_fee_kobo": int(annual_contribution_kobo * admin_ratio),
        },
        "surplus_distribution": "shared_among_participants",
        "shariah_compliance": "no_riba_no_gharar_no_maysir",
    }

# ─── Shariah Compliance Screening ───
PROHIBITED_SECTORS = [
    "alcohol", "tobacco", "pork", "gambling", "conventional_banking",
    "conventional_insurance", "adult_entertainment", "weapons",
]
DEBT_RATIO_LIMIT = 0.33  # Max 33% debt-to-assets
IMPURE_INCOME_LIMIT = 0.05  # Max 5% income from non-compliant sources

def screen_shariah_compliance(company: dict) -> dict:
    """Screen company/investment for Shariah compliance."""
    sector = company.get("sector", "").lower()
    debt_ratio = company.get("debt_to_assets_ratio", 0)
    impure_income_ratio = company.get("non_compliant_income_ratio", 0)
    interest_income_ratio = company.get("interest_income_ratio", 0)

    violations = []
    if sector in PROHIBITED_SECTORS:
        violations.append(f"prohibited_sector:{sector}")
    if debt_ratio > DEBT_RATIO_LIMIT:
        violations.append(f"debt_ratio_exceeds_33pct:{debt_ratio:.2%}")
    if impure_income_ratio > IMPURE_INCOME_LIMIT:
        violations.append(f"impure_income_exceeds_5pct:{impure_income_ratio:.2%}")
    if interest_income_ratio > IMPURE_INCOME_LIMIT:
        violations.append(f"interest_income_exceeds_5pct:{interest_income_ratio:.2%}")

    compliant = len(violations) == 0
    purification_amount_kobo = 0
    if not compliant and impure_income_ratio > 0:
        revenue = company.get("annual_revenue_kobo", 0)
        purification_amount_kobo = int(revenue * impure_income_ratio)

    return {
        "company": company.get("name", "unknown"),
        "shariah_compliant": compliant,
        "violations": violations,
        "screening_criteria": {
            "sector_check": sector not in PROHIBITED_SECTORS,
            "debt_ratio_check": debt_ratio <= DEBT_RATIO_LIMIT,
            "impure_income_check": impure_income_ratio <= IMPURE_INCOME_LIMIT,
            "interest_income_check": interest_income_ratio <= IMPURE_INCOME_LIMIT,
        },
        "purification_amount_kobo": purification_amount_kobo,
        "recommendation": "approved" if compliant else "rejected",
    }

# ─── State Machine ───
VALID_TRANSITIONS = {
    "draft": ["submitted"],
    "submitted": ["shariah_review"],
    "shariah_review": ["approved", "rejected", "revision_required"],
    "revision_required": ["submitted"],
    "approved": ["disbursed"],
    "disbursed": ["active"],
    "active": ["matured", "defaulted", "early_settled"],
    "matured": ["closed"],
    "early_settled": ["closed"],
    "defaulted": ["restructured", "written_off"],
    "restructured": ["active"],
    "rejected": [],
    "closed": [],
    "written_off": [],
}

def validate_transition(current: str, target: str) -> tuple:
    if current not in VALID_TRANSITIONS:
        return False, f"unknown_state:{current}"
    allowed = VALID_TRANSITIONS[current]
    if target not in allowed:
        return False, f"invalid_transition:{current}->{target}, allowed:{allowed}"
    return True, None

# ─── Security Headers ───
def add_security_headers(handler):
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("X-Frame-Options", "DENY")
    handler.send_header("Content-Security-Policy", "default-src 'self'")
    handler.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")


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

    def _json(self, code, data):
        self.respond(code, data)

    def get_tenant_id(self):
        return self.headers.get("X-Tenant-Id", "default")

    def do_GET(self):
        inc_requests()
        if not _rl_allow():
            self.respond(429, {"error": "rate_limit_exceeded"})
            return
        path = urlparse(self.path).path
        params = parse_qs(urlparse(self.path).query)

        if path == "/healthz":
            db = get_db()
            db_status = "connected" if db else "not_configured"
            self.respond(200, {
                "status": "healthy",
                "service": SERVICE_NAME,
                "version": "2.0.0",
                "checks": {"database": db_status},
                "supported_contracts": ["murabaha", "ijara", "mudaraba", "musharaka", "sukuk", "takaful"],
                "uptime_secs": round(time.time() - START_TIME),
            })
        elif path == "/readyz":
            self.respond(200, {"ready": True})
        elif path == "/livez":
            self.respond(200, {"alive": True})
        elif path == "/metrics":
            body = (
                f'requests_total{{service="{SERVICE_NAME}"}} {_request_count}\n'
                f'errors_total{{service="{SERVICE_NAME}"}} {_error_count}\n'
            )
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(body.encode())
        elif path == "/v1/contracts/types":
            self.respond(200, {
                "contract_types": [
                    {"type": "murabaha", "description": "Cost-plus financing", "risk_sharing": "customer_bears_price_risk"},
                    {"type": "ijara", "description": "Islamic lease", "risk_sharing": "bank_owns_asset_during_lease"},
                    {"type": "mudaraba", "description": "Profit-sharing partnership", "risk_sharing": "bank_bears_financial_loss"},
                    {"type": "musharaka", "description": "Joint venture / diminishing partnership", "risk_sharing": "proportional_to_contribution"},
                    {"type": "sukuk", "description": "Islamic bond / asset-backed security", "risk_sharing": "shared_ownership_of_underlying_asset"},
                    {"type": "takaful", "description": "Islamic cooperative insurance", "risk_sharing": "mutual_aid_among_participants"},
                ],
                "shariah_board": "independent_advisory",
                "cbn_regulation": "non_interest_banking_guidelines_2011",
            })
        elif path == "/v1/prohibited-sectors":
            self.respond(200, {
                "prohibited_sectors": PROHIBITED_SECTORS,
                "screening_thresholds": {
                    "debt_to_assets_max": DEBT_RATIO_LIMIT,
                    "impure_income_max": IMPURE_INCOME_LIMIT,
                },
            })
        elif path == "/v1/contract/states":
            self.respond(200, {"transitions": VALID_TRANSITIONS})
        elif path in ("/v1/records", "/v1/list"):
            claims, err = validate_jwt(dict(self.headers))
            if err:
                self.respond(401, {"error": "unauthorized", "detail": err})
                return
            items, total = db_query("islamic_banking")
            self.respond(200, {"items": items, "total": total})
        else:
            self.respond(404, {"error": "not_found", "path": path})

    def do_POST(self):
        inc_requests()
        if not _rl_allow():
            self.respond(429, {"error": "rate_limit_exceeded"})
            return

        content_length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(content_length).decode()) if content_length > 0 else {}
        except json.JSONDecodeError:
            self.respond(400, {"error": "invalid_json"})
            return

        path = urlparse(self.path).path
        claims, err = validate_jwt(dict(self.headers))
        if err and path not in ("/v1/zakat/calculate",):
            self.respond(401, {"error": "unauthorized", "detail": err})
            return

        if path == "/v1/murabaha/calculate":
            result = compute_murabaha(
                body.get("cost_price_kobo", 0),
                body.get("profit_margin_pct", 0),
                body.get("tenure_months", 0),
            )
            self.respond(200, result)
        elif path == "/v1/ijara/calculate":
            result = compute_ijara(
                body.get("asset_value_kobo", 0),
                body.get("rental_rate_pct", 0),
                body.get("lease_months", 0),
                body.get("residual_value_pct", 10.0),
            )
            self.respond(200, result)
        elif path == "/v1/mudaraba/calculate":
            result = compute_mudaraba(
                body.get("investment_kobo", 0),
                body.get("expected_return_pct", 0),
                body.get("profit_sharing_ratio", 0),
                body.get("tenure_months", 0),
            )
            self.respond(200, result)
        elif path == "/v1/musharaka/calculate":
            result = compute_musharaka(
                body.get("bank_contribution_kobo", 0),
                body.get("customer_contribution_kobo", 0),
                body.get("expected_return_pct", 0),
                body.get("tenure_months", 0),
                body.get("diminishing", True),
            )
            self.respond(200, result)
        elif path == "/v1/zakat/calculate":
            result = compute_zakat(body)
            self.respond(200, result)
        elif path == "/v1/sukuk/calculate":
            result = compute_sukuk_yield(
                body.get("face_value_kobo", 0),
                body.get("coupon_rate_pct", 0),
                body.get("tenure_years", 0),
                body.get("payment_frequency", "semi_annual"),
            )
            self.respond(200, result)
        elif path == "/v1/takaful/calculate":
            result = compute_takaful_premium(
                body.get("sum_insured_kobo", 0),
                body.get("risk_category", "medium"),
                body.get("takaful_type", "general"),
            )
            self.respond(200, result)
        elif path == "/v1/shariah/screen":
            result = screen_shariah_compliance(body)
            self.respond(200, result)
        elif path == "/v1/contract/transition":
            current = body.get("current_state", "")
            target = body.get("target_state", "")
            valid, err = validate_transition(current, target)
            if valid:
                self.respond(200, {"transition": f"{current}->{target}", "allowed": True})
            else:
                self.respond(400, {"error": err, "allowed": False})
        elif path == "/v1/create":
            try:
                contract_id = f"ISL-{uuid.uuid4().hex[:12].upper()}"
                body["id"] = contract_id
                body["state"] = "draft"
                body["created_at"] = datetime.now(timezone.utc).isoformat()
                result = db_insert("islamic_banking", body)
                self.respond(201, {"created": True, "contract_id": contract_id, "data": body})
            except ConnectionError:
                self.respond(503, {"error": "database_unavailable"})
            except Exception as e:
                logger.error(f"Write failed: {e}")
                self.respond(500, {"error": "write_failed"})
        else:
            self.respond(404, {"error": "not_found", "path": path})



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



# ─── Enhanced Request Validation ─────────────────────────────────────────────

def validate_request_with_idempotency(method: str, headers: dict, body: dict, service_name: str) -> tuple:
    """Unified request validation with idempotency check."""
    # Check idempotency on writes
    if method in ("POST", "PUT"):
        idem_key = headers.get("Idempotency-Key") or headers.get("idempotency-key")
        if idem_key:
            is_dup, cached = check_idempotency(idem_key)
            if is_dup:
                return True, cached  # Return cached response
    return False, None

def validate_amount_kobo(amount, field_name: str = "amount") -> tuple:
    """Validate monetary amount is integer kobo (not float)."""
    if isinstance(amount, float):
        # Auto-convert float naira to kobo
        amount = int(round(amount * 100))
    if not isinstance(amount, int):
        return False, f"{field_name} must be an integer (kobo)"
    if amount < 0:
        return False, f"{field_name} cannot be negative"
    return True, amount


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
    print(f"[islamic-banking-engine-py] Received signal {signum}, shutting down gracefully...")
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
    logger.info(json.dumps({
        "service": SERVICE_NAME, "port": PORT,
        "contracts": ["murabaha", "ijara", "mudaraba", "musharaka", "sukuk", "takaful"],
        "message": "Non-interest banking engine started",
    }))
    server.serve_forever()
