import datetime
from decimal import Decimal, InvalidOperation

from pydantic import BaseModel, field_validator, model_validator
from utils import TransactionStatus, CurrencyEnum
from utils.config import MAX_TRANSACTION_AMOUNT_NAIRA
from typing import Optional


def validate_amount_str(v: str) -> str:
    """Strict money validation for the GL intake boundary.

    Rules: parseable as a finite Decimal, strictly positive, at most 2 decimal
    places (no sub-kobo amounts, no silent rounding), and bounded by the
    configured maximum. Anything else is rejected (422 at the Dapr/HTTP
    boundary) — negative/zero/unbounded amounts must never reach the GL,
    including via sign-flipped journals.
    """
    try:
        d = Decimal(str(v).strip())
    except (InvalidOperation, ValueError, AttributeError):
        raise ValueError("amount must be a valid decimal number")
    if not d.is_finite():
        raise ValueError("amount must be finite")
    if d.as_tuple().exponent < -2:
        raise ValueError("amount must have at most 2 decimal places")
    if d <= 0:
        raise ValueError("amount must be greater than zero")
    if d > MAX_TRANSACTION_AMOUNT_NAIRA:
        raise ValueError("amount exceeds the configured maximum")
    # Normalized plain decimal string (no exponent notation).
    return format(d.quantize(Decimal("0.01")), "f")


class TransactionEventSchema(BaseModel):
    transaction_id: str
    payer: str
    payee: str
    amount: Optional[str] = None
    status: TransactionStatus
    currency: CurrencyEnum
    completed_at: Optional[datetime.datetime]
    note: Optional[str]
    tag: Optional[str]
    tenant_id: str
    ledger_id: str
    # W9 pipeline interop: payment-processing-service publishes integer kobo
    # (`amount_kobo`); legacy publishers send `amount` as a naira string.
    amount_kobo: Optional[int] = None
    # MN-10: optional fee leg for multi-leg journals.
    fee_amount_kobo: Optional[int] = None
    fee_account: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def _validate_amount(cls, v):
        if v is None:
            return v
        return validate_amount_str(v)

    @model_validator(mode="after")
    def _normalize_amount(self):
        if self.amount is None and self.amount_kobo is not None:
            if self.amount_kobo <= 0:
                raise ValueError("amount_kobo must be greater than zero")
            self.amount = format(
                (Decimal(int(self.amount_kobo)) / 100).quantize(Decimal("0.01")), "f"
            )
        if self.amount is None:
            raise ValueError("either amount (naira) or amount_kobo is required")
        return self
