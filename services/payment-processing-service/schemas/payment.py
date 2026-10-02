import datetime
from pydantic import BaseModel, validator, model_validator
from utils import TransactionStatus, CurrencyEnum
from typing import Optional


_MAX_KOBO = 50_000_000_000_000  # ₦500B — CBN single-transaction ceiling


def _validate_kobo(v: int, field: str = "amount_kobo") -> int:
    if v is None:
        raise ValueError(f"{field} is required")
    if v <= 0:
        raise ValueError(f"{field} must be positive (got {v})")
    if v > _MAX_KOBO:
        raise ValueError(f"{field} {v} exceeds CBN ceiling of {_MAX_KOBO} kobo")
    return v


class TransactionEventSchema(BaseModel):
    transaction_id: str
    payer: str
    payee: str
    amount_kobo: int          # kobo integer — was str, now typed and arithmetic-safe
    status: TransactionStatus
    currency: CurrencyEnum
    completed_at: Optional[datetime.datetime]
    note: Optional[str]
    tag: Optional[str]
    tenant_id: str
    ledger_id: str
    # MN-10: optional fee leg — when present, transaction-ledger posts a
    # multi-leg journal (Dr payer fee / Cr fee-income) alongside the main leg.
    fee_amount_kobo: Optional[int] = None
    fee_account: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def _promote_amount(cls, data):
        if isinstance(data, dict) and "amount_kobo" not in data and "amount" in data:
            data = dict(data)
            data["amount_kobo"] = int(data.pop("amount"))
        return data

    @validator("amount_kobo")
    def validate_amount_kobo(cls, v):
        return _validate_kobo(v, "amount_kobo")


class InitiatePaymentSchema(BaseModel):
    payer: int | str
    payee: int | str
    payee_tenant_id: Optional[str] = None
    payee_bank_code: Optional[int] = None
    amount_kobo: int          # REQUIRED: kobo integer (1 NGN = 100 kobo)
    note: str
    pin: str

    @validator("amount_kobo")
    def validate_amount_kobo(cls, v):
        return _validate_kobo(v)


class InitiateSystemPayoutSchema(BaseModel):
    recipient: str
    amount_kobo: int
    note: str

    @validator("amount_kobo")
    def validate_amount_kobo(cls, v):
        return _validate_kobo(v)


def _promote_major_amount(cls, data):
    """Back-compat: legacy callers send `amount` in MAJOR units (naira).
    Promote to integer kobo with ROUND_HALF_UP (MN-10/F13-1, MN-16/F13-8)."""
    if isinstance(data, dict) and "amount_kobo" not in data and "amount" in data:
        from decimal import Decimal, ROUND_HALF_UP

        data = dict(data)
        major = data.pop("amount")
        data["amount_kobo"] = int(
            (Decimal(str(major)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )
    return data


class InitiateDepositSchema(BaseModel):
    recipient: int
    amount_kobo: int
    note: str
    # MN-07/MN-14: optional caller reference -> deterministic TB transfer id
    # (e.g. reversal:{transaction_id}) making replays ledger no-ops.
    reference: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def _promote_amount(cls, data):
        return _promote_major_amount(cls, data)

    @validator("amount_kobo")
    def validate_amount_kobo(cls, v):
        return _validate_kobo(v)


class InitiateDepositWithAccountNumberSchema(BaseModel):
    recipient_account_number: str
    amount_kobo: int
    note: str
    reference: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def _promote_amount(cls, data):
        return _promote_major_amount(cls, data)

    @validator("amount_kobo")
    def validate_amount_kobo(cls, v):
        return _validate_kobo(v)


class InitiateLoanPaymentSchema(BaseModel):
    loan_id: str
    payer: int
    amount_kobo: int
    pin: str

    @validator("amount_kobo")
    def validate_amount_kobo(cls, v):
        return _validate_kobo(v)


class InitiateLPOPaymentSchema(BaseModel):
    lpo_id: str
    payer: int
    pin: str


class InitiateInsurancePremiumPaymentSchema(BaseModel):
    insurance_policy_id: str
    payer: int
    pin: str


class SupplyChainFinancingPaymentSchema(BaseModel):
    financing_id: str
    payer: int
    pin: str


class ExternalParty(BaseModel):
    idType: str
    idValue: str


class ExternalAmount(BaseModel):
    currency: str
    amount_kobo: int          # kobo integer — was float, now exact

    @validator("amount_kobo")
    def validate_amount_kobo(cls, v):
        return _validate_kobo(v)

    @property
    def amount(self) -> float:
        return self.amount_kobo / 100


class ExternalTransferSchema(BaseModel):
    transactionId: str
    party: ExternalParty
    amount: ExternalAmount
    metadata: Optional[dict] = None


class ExternalDebitSchema(BaseModel):
    transactionId: str
    payer: str
    amount: ExternalAmount
    metadata: Optional[dict] = None
