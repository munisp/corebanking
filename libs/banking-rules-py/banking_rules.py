"""
banking_rules — Shared Nigerian banking domain logic library.
All monetary amounts are in kobo (int) to avoid float precision errors.
Import this instead of copy-pasting domain logic into every service.
"""
import time
import re
import hashlib
from typing import Optional

# ─── Monetary Type ───────────────────────────────────────────────────────────

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
    def __mul__(self, factor): return AmountKobo(int(self._value * factor))
    def __gt__(self, other): return self._value > (other._value if isinstance(other, AmountKobo) else other)
    def __ge__(self, other): return self._value >= (other._value if isinstance(other, AmountKobo) else other)
    def __lt__(self, other): return self._value < (other._value if isinstance(other, AmountKobo) else other)
    def __le__(self, other): return self._value <= (other._value if isinstance(other, AmountKobo) else other)
    def __eq__(self, other): return self._value == (other._value if isinstance(other, AmountKobo) else other)
    def __int__(self): return self._value
    def __bool__(self): return self._value != 0


# ─── CBN Tiered KYC Limits ───────────────────────────────────────────────────

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


# ─── NUBAN Validation ────────────────────────────────────────────────────────

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


# ─── BVN / NIN Validation ────────────────────────────────────────────────────

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


# ─── NFIU Threshold Reporting ────────────────────────────────────────────────

def check_nfiu_threshold(amount_kobo: int, txn_type: str) -> tuple:
    """Check if transaction triggers NFIU Currency Transaction Report."""
    if txn_type in ("cash_deposit", "cash_withdrawal"):
        if amount_kobo >= 500_000_000:  # ₦5M
            return True, "NFIU: Cash transaction ≥₦5M requires CTR filing"
    elif txn_type in ("transfer", "wire"):
        if amount_kobo >= 1_000_000_000:  # ₦10M
            return True, "NFIU: Transfer ≥₦10M requires CTR filing"
    return False, ""

def generate_ctr(customer_id: str, txn_id: str, amount_kobo: int, txn_type: str) -> Optional[dict]:
    """Generate Currency Transaction Report for NFIU."""
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


# ─── AML Risk Scoring ────────────────────────────────────────────────────────

SANCTIONED_COUNTRIES = {"KP", "IR", "SY", "CU", "VE", "MM", "BY", "ZW", "SD"}

def compute_aml_risk_score(
    txn_amount_kobo: int, is_pep: bool = False, is_high_risk_country: bool = False,
    cash_intensive: bool = False, is_structuring: bool = False,
    has_adverse_media: bool = False, account_age_months: int = 12
) -> tuple:
    """Multi-factor AML risk scoring. Returns (score, indicators)."""
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


# ─── Financial Calculations ──────────────────────────────────────────────────

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
        if period == tenor_months: principal_part = balance
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

def compute_daily_accrual(balance_kobo: int, annual_rate_pct: float, day_basis: int = 365) -> int:
    """Daily interest accrual in kobo."""
    return int(balance_kobo * annual_rate_pct / 100.0 / day_basis)

def compute_provisioning_rate(days_past_due: int) -> float:
    """CBN Prudential Guidelines provisioning rates."""
    if days_past_due <= 90: return 1.0
    if days_past_due <= 180: return 10.0
    if days_past_due <= 360: return 50.0
    if days_past_due <= 720: return 75.0
    return 100.0

def compute_wht(interest_kobo: int) -> int:
    """Withholding Tax on interest — 10% per Nigerian tax law."""
    return int(interest_kobo * 0.10)


# ─── Velocity & Fraud Detection ──────────────────────────────────────────────

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
    """Multi-factor transaction fraud scoring. Returns (score, risk_level)."""
    score = 0.0
    if is_international: score += 20
    if is_new_beneficiary: score += 15
    if unusual_time: score += 10
    if device_changed: score += 25
    if failed_attempts >= 3: score += 30
    if amount_kobo > 500_000_000: score += 15
    risk = "low" if score < 40 else ("medium" if score < 70 else "high")
    return min(score, 100.0), risk


# ─── State Machine ───────────────────────────────────────────────────────────

BANKING_TRANSITIONS = {
    "draft": ["submitted", "cancelled"],
    "submitted": ["under_review", "rejected", "cancelled"],
    "under_review": ["approved", "rejected"],
    "approved": ["processing", "cancelled"],
    "processing": ["completed", "failed"],
    "completed": ["reversed"],
    "failed": ["submitted"],
}

def can_transition(from_state: str, to_state: str, transitions: dict = None) -> bool:
    """Check if state transition is allowed."""
    if transitions is None:
        transitions = BANKING_TRANSITIONS
    allowed = transitions.get(from_state, [])
    return to_state in allowed


# ─── Idempotency ─────────────────────────────────────────────────────────────

def compute_idempotency_hash(method: str, path: str, body: bytes) -> str:
    """Generate hash for idempotency deduplication when no key is provided."""
    return hashlib.sha256(f"{method}:{path}:{body}".encode()).hexdigest()[:32]


# ─── Maker-Checker ───────────────────────────────────────────────────────────

MAKER_CHECKER_THRESHOLDS = {
    "transfer": 100_000_000,      # ₦1M
    "loan_disburse": 100_000_000,  # ₦1M
    "gl_posting": 50_000_000,      # ₦500K
    "account_close": 0,            # Always
}

def requires_maker_checker(operation: str, amount_kobo: int) -> bool:
    """Determine if operation needs dual authorization per CBN guidelines."""
    threshold = MAKER_CHECKER_THRESHOLDS.get(operation, 100_000_000)
    return amount_kobo >= threshold


# ─── PII Masking (NDPR) ──────────────────────────────────────────────────────

def mask_pii(value: str, field_type: str = "generic") -> str:
    """Mask PII for logging per NDPR compliance."""
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
    """Remove PII patterns from log messages."""
    msg = re.sub(r"\b\d{11}\b", lambda m: f"***{m.group()[-4:]}", msg)
    msg = re.sub(r"\b\d{10}\b", lambda m: f"****{m.group()[-4:]}", msg)
    msg = re.sub(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", "***@***", msg)
    return msg


# ─── Reconciliation ──────────────────────────────────────────────────────────

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
